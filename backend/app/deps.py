"""Dependências de autenticação/autorização e validações compartilhadas.

Modelo de identidade (não há chave compartilhada entre clientes):
  - verify_tutor_token        → JWT do Supabase Auth com app_metadata.role == "tutor"
  - verify_kiosk_identity     → JWT do Supabase Auth com app_metadata.role == "kiosk"
                                (uma conta por dispositivo, revogável individualmente)
  - verify_kiosk_or_tutor     → qualquer um dos dois
  - verify_admin_or_scheduler → X-Admin-Key (segredo só de operação) ou OIDC do Cloud Scheduler

O JWT nunca é decodificado localmente sem verificação: a validação é delegada ao
Supabase Auth (assinatura, expiração e existência da conta). O papel vem
exclusivamente de app_metadata; user_metadata nunca concede autorização.
"""
from __future__ import annotations

import concurrent.futures
import hashlib
import logging
import secrets
import threading
import time
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException, Security
from fastapi.security.api_key import APIKeyHeader

from app.config import settings

log = logging.getLogger(__name__)

ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "application/octet-stream",
}
MAX_IMAGE_BYTES = 5 * 1024 * 1024  # 5 MB
MAX_IMAGE_DIMENSION = 4096  # Limite máximo em pixels para qualquer dimensão (L ou A)
MAX_IMAGE_PIXELS = 4096 * 4096  # 16 MP máximo (proteção contra Decompression Bomb)

_admin_key_header = APIKeyHeader(name="X-Admin-Key", auto_error=False)
_bearer_header = APIKeyHeader(name="Authorization", auto_error=False)

_auth_executor = concurrent.futures.ThreadPoolExecutor(max_workers=4, thread_name_prefix="auth")

# Cache curto da validação de JWT de kiosk: evita uma ida ao Auth por frame.
# Consequência assumida: um dispositivo revogado para em até kiosk_token_cache_seconds.
_kiosk_cache_lock = threading.Lock()
_kiosk_cache: dict[str, tuple[float, dict]] = {}
_KIOSK_CACHE_MAX = 512


def clear_identity_cache_for_testing() -> None:
    with _kiosk_cache_lock:
        _kiosk_cache.clear()


def _extract_bearer(authorization: str | None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Credencial ausente. Autentique-se para continuar.")
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Bearer token vazio.")
    return token


def _fetch_user(token: str) -> Any:
    """Consulta o Supabase Auth, que valida assinatura, expiração e existência da conta."""
    from app.db.supabase_client import get_client  # importação tardia evita ciclos

    response = get_client().auth.get_user(token)
    return None if response is None else getattr(response, "user", None)


def _is_banned(user: Any) -> bool:
    banned_until = getattr(user, "banned_until", None)
    if not banned_until:
        return False
    if isinstance(banned_until, str):
        try:
            banned_until = datetime.fromisoformat(banned_until.replace("Z", "+00:00"))
        except ValueError:
            return True  # valor ilegível: trata como bloqueado (fail-closed)
    if isinstance(banned_until, datetime):
        if banned_until.tzinfo is None:
            banned_until = banned_until.replace(tzinfo=timezone.utc)
        return banned_until > datetime.now(timezone.utc)
    return False


def _resolve_identity(token: str) -> dict:
    """Valida o token no Supabase Auth e devolve {user_id, email, role}.

    Fail-closed: qualquer falha vira 401/403/503; nunca há identidade presumida.
    """
    future = _auth_executor.submit(_fetch_user, token)
    try:
        user = future.result(timeout=settings.auth_timeout_seconds)
    except concurrent.futures.TimeoutError as exc:
        future.cancel()
        log.error("Validação de identidade excedeu %.1fs.", settings.auth_timeout_seconds)
        raise HTTPException(status_code=503, detail="Serviço de autenticação indisponível.") from exc
    except HTTPException:
        raise
    except Exception as exc:
        log.warning("Falha na validação do token: %s", type(exc).__name__)
        raise HTTPException(status_code=401, detail="Sessão inválida ou expirada.") from exc

    if user is None:
        raise HTTPException(status_code=401, detail="Sessão inválida ou expirada.")
    if getattr(user, "is_anonymous", False) is True:
        raise HTTPException(status_code=403, detail="Acesso negado.")
    if _is_banned(user):
        raise HTTPException(status_code=403, detail="Acesso negado.")

    app_metadata = getattr(user, "app_metadata", None) or {}
    role = app_metadata.get("role", "") if isinstance(app_metadata, dict) else ""
    return {
        "user_id": str(getattr(user, "id", "")),
        "email": getattr(user, "email", "") or "",
        "role": role if isinstance(role, str) else "",
    }


# ── Tutor ─────────────────────────────────────────────────────────────────────

def verify_tutor_token(
    authorization: str | None = Security(_bearer_header),
) -> dict:
    """Exige JWT válido do Supabase Auth com app_metadata.role == 'tutor'."""
    token = _extract_bearer(authorization)
    claims = _resolve_identity(token)
    if claims["role"] != "tutor":
        log.warning("Rota de tutor negada para papel '%s'.", claims["role"] or "(nenhum)")
        raise HTTPException(
            status_code=403,
            detail="Acesso negado. Apenas tutores autorizados podem executar esta operação.",
        )
    return claims


# ── Kiosk (identidade por dispositivo) ────────────────────────────────────────


def _cached_kiosk_identity(token: str) -> dict:
    key = hashlib.sha256(token.encode("utf-8")).hexdigest()
    now = time.monotonic()
    with _kiosk_cache_lock:
        entry = _kiosk_cache.get(key)
        if entry and entry[0] > now:
            return entry[1]

    claims = _resolve_identity(token)
    if claims["role"] == "kiosk" and settings.kiosk_token_cache_seconds > 0:
        with _kiosk_cache_lock:
            if len(_kiosk_cache) >= _KIOSK_CACHE_MAX:
                for stale in [k for k, (exp, _) in _kiosk_cache.items() if exp <= now]:
                    _kiosk_cache.pop(stale, None)
                if len(_kiosk_cache) >= _KIOSK_CACHE_MAX:
                    _kiosk_cache.clear()
            _kiosk_cache[key] = (now + settings.kiosk_token_cache_seconds, claims)
    return claims


def verify_kiosk_identity(
    authorization: str | None = Security(_bearer_header),
) -> dict:
    """Exige JWT de conta de dispositivo (role == 'kiosk')."""
    token = _extract_bearer(authorization)
    claims = _cached_kiosk_identity(token)
    if claims["role"] != "kiosk":
        raise HTTPException(status_code=403, detail="Acesso restrito a dispositivos autorizados.")
    return claims


def verify_kiosk_or_tutor(
    authorization: str | None = Security(_bearer_header),
) -> dict:
    """Aceita dispositivo provisionado ou tutor autenticado."""
    token = _extract_bearer(authorization)
    claims = _cached_kiosk_identity(token)
    if claims["role"] not in ("kiosk", "tutor"):
        raise HTTPException(status_code=403, detail="Acesso negado.")
    return claims


def require_tutor_or_window(
    authorization: str | None = Security(_bearer_header),
) -> dict:
    """Recadastro: tutor sempre; durante a janela cadastral, também um kiosk provisionado.

    Nunca há acesso sem identidade: fora ou dentro da janela, a requisição precisa
    vir de um tutor ou de um dispositivo autenticado.
    """
    from app.services.enrollment_window import (
        enrollment_window_status,
        is_enrollment_window_active,
    )

    if is_enrollment_window_active():
        claims = verify_kiosk_or_tutor(authorization=authorization)
        return {**claims, **enrollment_window_status()}
    return verify_tutor_token(authorization=authorization)


# ── Manutenção (agendador / operação) ─────────────────────────────────────────


def verify_admin_or_scheduler(
    admin_key: str | None = Security(_admin_key_header),
    authorization: str | None = Security(_bearer_header),
) -> None:
    """Valida X-Admin-Key ou token OIDC do Cloud Scheduler.

    A chave administrativa é um segredo exclusivo de operação: nunca é distribuída
    a kiosks, apps ou navegadores, e é diferente de qualquer credencial de cliente.
    """
    if admin_key:
        if settings.admin_api_key and secrets.compare_digest(admin_key, settings.admin_api_key):
            return
        raise HTTPException(status_code=401, detail="Credencial administrativa inválida.")

    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1].strip()

        try:
            from google.auth.transport import requests as google_requests
            from google.oauth2 import id_token
        except ImportError as exc:
            raise HTTPException(
                status_code=500,
                detail="Biblioteca google-auth não instalada. Validação OIDC impossível.",
            ) from exc

        if not settings.service_url or not settings.cloud_scheduler_sa_email:
            raise HTTPException(
                status_code=500,
                detail=(
                    "SERVICE_URL e CLOUD_SCHEDULER_SA_EMAIL são obrigatórios para validar OIDC "
                    "(sem audiência e conta definidas a validação seria insegura)."
                ),
            )

        try:
            req = google_requests.Request()
            claims = id_token.verify_oauth2_token(token, req, audience=settings.service_url)
        except Exception as exc:
            log.warning("Falha na validação do token OIDC: %s", type(exc).__name__)
            raise HTTPException(
                status_code=401,
                detail="Token OIDC inválido ou assinatura não verificada.",
            ) from exc

        if claims.get("email") != settings.cloud_scheduler_sa_email or claims.get("email_verified") is False:
            raise HTTPException(status_code=403, detail="Service Account do Cloud Scheduler não autorizada.")
        return

    raise HTTPException(status_code=401, detail="Acesso não autorizado.")


# ── Validação de Mídia ────────────────────────────────────────────────────────


def check_image_magic_bytes(data: bytes) -> str:
    """Valida os magic bytes da imagem retornando o formato ('jpeg', 'png', 'webp').

    Rejeita com HTTPException 400 se a assinatura binária for inválida ou não suportada.
    """
    if len(data) < 12:
        raise HTTPException(400, "Arquivo muito curto para conter cabeçalho de imagem válido.")
    if data.startswith(b"\xff\xd8\xff"):
        return "jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if data.startswith(b"RIFF") and data[8:12] == b"WEBP":
        return "webp"
    raise HTTPException(400, "Assinatura binária (magic bytes) inválida ou formato não reconhecido.")


def validate_image(
    content_type: str | None,
    size: int,
    raw_bytes: bytes | None = None,
) -> None:
    """Rejeita tipos de mídia não suportados, magic bytes inválidos, imagens acima de 5MB ou com dimensões anômalas."""
    if content_type is not None and content_type.lower() not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(415, f"Tipo de mídia não suportado: {content_type}")
    if size > MAX_IMAGE_BYTES:
        raise HTTPException(413, "Imagem excede o limite de 5 MB.")
    if raw_bytes is not None:
        detected_format = check_image_magic_bytes(raw_bytes)
        if content_type:
            ct = content_type.lower()
            if ct in ("image/jpeg", "image/jpg") and detected_format != "jpeg":
                raise HTTPException(400, "Conflito entre Content-Type e assinatura binária (esperado JPEG).")
            if ct == "image/png" and detected_format != "png":
                raise HTTPException(400, "Conflito entre Content-Type e assinatura binária (esperado PNG).")
            if ct == "image/webp" and detected_format != "webp":
                raise HTTPException(400, "Conflito entre Content-Type e assinatura binária (esperado WebP).")

        import io

        from PIL import Image

        try:
            with Image.open(io.BytesIO(raw_bytes)) as img:
                w, h = img.size
                if w > MAX_IMAGE_DIMENSION or h > MAX_IMAGE_DIMENSION or (w * h) > MAX_IMAGE_PIXELS:
                    raise HTTPException(
                        400,
                        f"Dimensões da imagem ({w}x{h}) excedem o limite operacional máximo ({MAX_IMAGE_DIMENSION}px).",
                    )
        except HTTPException:
            raise
        except Exception as exc:
            log.warning("Falha na validação das dimensões da imagem: %s", exc)
            raise HTTPException(400, "Arquivo de imagem corrompido ou formato inválido.") from exc
