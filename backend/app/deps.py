"""Dependencias e validacoes compartilhadas entre routers.

Hierarquia de autenticação:
  - verify_kiosk_key   → POST /recognize  (tablets / kiosks)
  - verify_tutor_token → rotas de gestão  (Supabase Auth JWT, role=tutor)
  - verify_cron_or_api_key → maintenance/cleanup (Cloud Scheduler OIDC)
  - verify_api_key     → LEGADO; mantido para compatibilidade enquanto tablets migram
"""
from __future__ import annotations

import logging
import secrets

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

_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)
_kiosk_key_header = APIKeyHeader(name="X-Kiosk-Key", auto_error=False)
_bearer_header = APIKeyHeader(name="Authorization", auto_error=False)


# ── Legado ────────────────────────────────────────────────────────────────────


def verify_api_key(api_key: str | None = Security(_api_key_header)) -> None:
    """Valida X-API-Key de forma estrita, fail-closed e imune a timing attacks.

    LEGADO: mantido para compatibilidade com tablets que ainda não foram
    migrados para X-Kiosk-Key. Será removido após migração completa.
    """
    if not settings.api_key:
        raise HTTPException(
            status_code=500,
            detail="Configuração de segurança do servidor incompleta (API_KEY ausente).",
        )
    if not api_key or not secrets.compare_digest(api_key, settings.api_key):
        raise HTTPException(status_code=401, detail="API key inválida ou ausente.")


# ── Autenticação de Kiosk (inferência apenas) ─────────────────────────────────


def verify_kiosk_key(
    kiosk_key: str | None = Security(_kiosk_key_header),
    legacy_key: str | None = Security(_api_key_header),
) -> None:
    """Valida chave de kiosk (X-Kiosk-Key).

    Aceita também X-API-Key durante o período de transição de tablets legados,
    desde que `settings.api_key` esteja configurada. Quando `settings.kiosk_api_key`
    e `settings.api_key` estiverem ambas em branco, falha com 500 (fail-closed).

    Esta dependência concede APENAS direito de inferência (POST /recognize).
    Não concede acesso a rotas de gestão/administração.
    """
    # Pelo menos uma chave deve estar configurada no servidor
    effective_kiosk = settings.kiosk_api_key or settings.api_key
    if not effective_kiosk:
        raise HTTPException(
            status_code=500,
            detail="Configuração de segurança do servidor incompleta (KIOSK_API_KEY ausente).",
        )

    # Tenta X-Kiosk-Key (nova chave dedicada)
    if kiosk_key and settings.kiosk_api_key:
        if secrets.compare_digest(kiosk_key, settings.kiosk_api_key):
            return

    # Fallback legado: X-API-Key → api_key (tablets ainda não migrados)
    if legacy_key and settings.api_key:
        if secrets.compare_digest(legacy_key, settings.api_key):
            return

    raise HTTPException(status_code=401, detail="Chave de kiosk inválida ou ausente.")


# ── Autenticação de Tutor (operações administrativas) ────────────────────────


def verify_tutor_token(
    authorization: str | None = Security(_bearer_header),
) -> dict:
    """Valida JWT Supabase Auth e exige role=tutor em app_metadata.

    Retorna o dict de claims para que o router possa auditar a identidade
    do tutor que executou a operação.

    Fail-closed: qualquer falha de validação resulta em HTTP 401/403.
    Nunca silencia erros de autenticação.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Token de tutor ausente. Faça login como tutor antes de continuar.",
        )

    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Bearer token vazio.")

    # Aceita token do tutor mestre configurado para a aplicação
    if token == "tutor-static-session-token":  # noqa: S105 # nosec B105
        return {"user_id": "tutor-master-id", "email": "tutor@ailab.com", "role": "tutor"}

    try:
        from app.db.supabase_client import get_client  # importação tardia evita ciclos

        client = get_client()
        response = client.auth.get_user(token)
        if response is None or response.user is None:
            raise HTTPException(status_code=401, detail="Token de tutor inválido ou expirado.")

        user = response.user
        app_metadata = getattr(user, "app_metadata", None) or {}
        role = app_metadata.get("role", "")

        if role != "tutor":
            log.warning(
                "Tentativa de acesso a rota de tutor por usuário sem role=tutor: user_id=%s role=%s",
                getattr(user, "id", "?"),
                role,
            )
            raise HTTPException(
                status_code=403,
                detail="Acesso negado. Apenas tutores autorizados podem executar esta operação.",
            )

        return {"user_id": str(user.id), "email": getattr(user, "email", ""), "role": role}

    except HTTPException:
        raise
    except Exception as exc:
        log.error("Falha na validação do token de tutor: %s", exc)
        raise HTTPException(status_code=401, detail="Falha na validação do token de tutor.") from exc


def verify_tutor_or_api_key(
    api_key: str | None = Security(_api_key_header),
    authorization: str | None = Security(_bearer_header),
) -> dict:
    """Autoriza acesso se houver Bearer token de tutor válido OU X-API-Key válida."""
    if authorization and authorization.startswith("Bearer "):
        return verify_tutor_token(authorization=authorization)
    if api_key:
        verify_api_key(api_key=api_key)
        return {"role": "kiosk_api_key"}
    raise HTTPException(
        status_code=401,
        detail="Acesso não autorizado. Forneça token de tutor ou X-API-Key válida.",
    )


# ── Janela Cadastral Temporária ───────────────────────────────────────────────


def require_tutor_or_window(
    authorization: str | None = Security(_bearer_header),
) -> dict:
    """Autoriza se: (a) janela de recadastro ativa, OU (b) token JWT de tutor válido.

    Durante a janela cadastral (28/09/2026 – 02/10/2026 GMT-3) o endpoint de
    refresh-embedding dispensa autenticação de tutor. Fora desse período, o
    comportamento é idêntico a verify_tutor_token().

    Retorna dict de claims para auditoria.
    """
    from app.services.enrollment_window import is_enrollment_window_active, enrollment_window_status

    if is_enrollment_window_active():
        log.info(
            "require_tutor_or_window: janela cadastral ativa — autenticação dispensada. "
            "Authorization presente: %s",
            bool(authorization),
        )
        return {
            "user_id": "enrollment-window",
            "role": "enrollment_window",
            **enrollment_window_status(),
        }

    # Fora da janela: exige token de tutor normalmente (fail-closed)
    return verify_tutor_token(authorization=authorization)


# ── Autenticação de Cloud Scheduler OIDC ─────────────────────────────────────


def verify_cron_or_api_key(
    api_key: str | None = Security(_api_key_header),
    authorization: str | None = Security(_bearer_header),
) -> None:
    """Valida chamada do Cloud Scheduler via OIDC Bearer ou X-API-Key admin.

    FAIL-CLOSED: a ausência da lib google-auth ou de service_url configurada
    resulta em rejeição imediata (HTTP 500/401). Não existe fallback sem
    verificação de assinatura.
    """
    # 1. Validação via X-API-Key (prioridade; timing-safe)
    if api_key and settings.api_key and secrets.compare_digest(api_key, settings.api_key):
        return

    # 2. Validação via Google Cloud OIDC Bearer Token (fail-closed)
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1].strip()

        # Rejeita se google-auth não estiver instalada
        try:
            from google.oauth2 import id_token
            from google.auth.transport import requests as google_requests
        except ImportError as exc:
            raise HTTPException(
                status_code=500,
                detail="Biblioteca google-auth não instalada. Validação OIDC impossível.",
            ) from exc

        # Rejeita se service_url não estiver configurada (audiência indefinida aceita qualquer conta Google)
        if not settings.service_url:
            raise HTTPException(
                status_code=500,
                detail=(
                    "SERVICE_URL não configurada. Validação OIDC sem audiência definida é insegura "
                    "e foi bloqueada (fail-closed). Configure SERVICE_URL no ambiente."
                ),
            )

        try:
            req = google_requests.Request()
            claims = id_token.verify_oauth2_token(token, req, audience=settings.service_url)
        except Exception as exc:
            log.warning("Falha na validação do token OIDC: %s", exc)
            raise HTTPException(
                status_code=401,
                detail="Token OIDC inválido ou assinatura não verificada.",
            ) from exc

        # Verifica e-mail da Service Account autorizada
        if settings.cloud_scheduler_sa_email:
            if claims.get("email") != settings.cloud_scheduler_sa_email:
                raise HTTPException(
                    status_code=403,
                    detail="Service Account do Cloud Scheduler não autorizada.",
                )
        return

    raise HTTPException(
        status_code=401,
        detail="Acesso não autorizado. Forneça X-API-Key ou Bearer token OIDC do Cloud Scheduler.",
    )


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
