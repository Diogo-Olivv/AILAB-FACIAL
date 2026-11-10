"""Provisionamento e revogação de identidade de dispositivos (kiosks).

Cada totem tem a sua própria conta no Supabase Auth com app_metadata.role == "kiosk".
Só um tutor autenticado cria, lista ou revoga dispositivos. A credencial inicial é
devolvida UMA vez, na criação, e nunca é gravada pelo backend nem escrita em log.
"""
from __future__ import annotations

import logging
import re
import secrets
import uuid

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field

from app.config import settings
from app.db.supabase_client import get_client
from app.deps import clear_identity_cache_for_testing, verify_tutor_token
from app.routers.recognize import check_rate_limit

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/kiosks", tags=["kiosks"])

_LABEL_RE = re.compile(r"^[\w .\-]{1,60}$", re.UNICODE)
_LIST_PAGE_SIZE = 200
_LIST_MAX_PAGES = 10


class KioskProvisionRequest(BaseModel):
    label: str = Field(..., min_length=1, max_length=60, description="Nome do dispositivo (ex.: 'Totem da entrada')")


class KioskCredential(BaseModel):
    kiosk_id: str
    label: str
    email: str
    password: str = Field(..., description="Credencial inicial, exibida uma única vez")


class KioskInfo(BaseModel):
    kiosk_id: str
    label: str
    created_at: str | None = None
    last_sign_in_at: str | None = None
    disabled: bool = False


def _app_metadata(user) -> dict:
    meta = getattr(user, "app_metadata", None) or {}
    return meta if isinstance(meta, dict) else {}


def _iso(value) -> str | None:
    if value is None:
        return None
    return value.isoformat() if hasattr(value, "isoformat") else str(value)


def _audit(action: str, actor: str, target: str, detail: dict | None = None) -> None:
    """Trilha de auditoria; falha aqui não desfaz a operação principal."""
    try:
        get_client().table("admin_audit_log").insert(
            {"action": action, "actor": actor, "target": target, "detail": detail or {}}
        ).execute()
    except Exception as exc:  # noqa: BLE001
        log.warning("Falha ao registrar auditoria de '%s': %s", action, type(exc).__name__)


@router.post("", response_model=KioskCredential, status_code=201)
def provision_kiosk(body: KioskProvisionRequest, tutor: dict = Depends(verify_tutor_token)):
    """Cria a conta de um dispositivo e devolve a credencial inicial (uma única vez)."""
    check_rate_limit(tutor["user_id"], limit=10, bucket="kiosk-provision")

    label = body.label.strip()
    if not _LABEL_RE.fullmatch(label):
        raise HTTPException(status_code=400, detail="Nome do dispositivo inválido.")

    email = f"kiosk-{uuid.uuid4().hex[:16]}@{settings.kiosk_email_domain}"
    password = secrets.token_urlsafe(36)

    try:
        res = get_client().auth.admin.create_user(
            {
                "email": email,
                "password": password,
                "email_confirm": True,
                "app_metadata": {"role": "kiosk", "label": label, "provisioned_by": tutor["user_id"]},
            }
        )
    except Exception as exc:  # noqa: BLE001
        log.error("Falha ao criar conta de dispositivo: %s", type(exc).__name__)
        raise HTTPException(status_code=502, detail="Não foi possível criar o dispositivo agora.") from exc

    user = getattr(res, "user", None)
    kiosk_id = str(getattr(user, "id", "") or "")
    if not kiosk_id:
        raise HTTPException(status_code=502, detail="Não foi possível criar o dispositivo agora.")

    _audit("kiosk_provision", tutor["user_id"], kiosk_id, {"label": label})
    log.info("Dispositivo provisionado.")
    return KioskCredential(kiosk_id=kiosk_id, label=label, email=email, password=password)


@router.get("", response_model=list[KioskInfo], dependencies=[Depends(verify_tutor_token)])
def list_kiosks():
    """Lista os dispositivos provisionados (sem credenciais)."""
    kiosks: list[KioskInfo] = []
    try:
        admin = get_client().auth.admin
        for page in range(1, _LIST_MAX_PAGES + 1):
            users = admin.list_users(page=page, per_page=_LIST_PAGE_SIZE) or []
            for user in users:
                meta = _app_metadata(user)
                if meta.get("role") != "kiosk":
                    continue
                kiosks.append(
                    KioskInfo(
                        kiosk_id=str(user.id),
                        label=str(meta.get("label") or "Dispositivo"),
                        created_at=_iso(getattr(user, "created_at", None)),
                        last_sign_in_at=_iso(getattr(user, "last_sign_in_at", None)),
                        disabled=bool(getattr(user, "banned_until", None)),
                    )
                )
            if len(users) < _LIST_PAGE_SIZE:
                break
    except Exception as exc:  # noqa: BLE001
        log.error("Falha ao listar dispositivos: %s", type(exc).__name__)
        raise HTTPException(status_code=502, detail="Não foi possível listar os dispositivos agora.") from exc
    return kiosks


@router.delete("/{kiosk_id}", status_code=204)
def revoke_kiosk(kiosk_id: str, tutor: dict = Depends(verify_tutor_token)):
    """Revoga um dispositivo: a conta é removida e as sessões deixam de valer.

    Só contas com papel `kiosk` podem ser removidas por esta rota — ela nunca
    apaga a conta de um tutor.
    """
    try:
        uuid.UUID(kiosk_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Identificador inválido.") from exc

    admin = get_client().auth.admin
    try:
        res = admin.get_user_by_id(kiosk_id)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=404, detail="Dispositivo não encontrado.") from exc

    user = getattr(res, "user", None)
    if user is None or _app_metadata(user).get("role") != "kiosk":
        raise HTTPException(status_code=404, detail="Dispositivo não encontrado.")

    try:
        admin.delete_user(kiosk_id)
    except Exception as exc:  # noqa: BLE001
        log.error("Falha ao revogar dispositivo: %s", type(exc).__name__)
        raise HTTPException(status_code=502, detail="Não foi possível revogar o dispositivo agora.") from exc

    # A validação em cache deste processo é descartada; outras instâncias expiram
    # em até kiosk_token_cache_seconds.
    clear_identity_cache_for_testing()
    _audit("kiosk_revoke", tutor["user_id"], kiosk_id)
    return Response(status_code=204)
