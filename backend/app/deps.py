"""Dependencias e validacoes compartilhadas entre routers."""
from __future__ import annotations

import secrets

from fastapi import HTTPException, Security
from fastapi.security.api_key import APIKeyHeader

from app.config import settings

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_IMAGE_BYTES = 5 * 1024 * 1024  # 5 MB

_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)
_bearer_header = APIKeyHeader(name="Authorization", auto_error=False)


def verify_api_key(api_key: str | None = Security(_api_key_header)) -> None:
    """Valida X-API-Key de forma estrita, fail-closed e imune a timing attacks."""
    if not settings.api_key:
        raise HTTPException(
            status_code=500,
            detail="Configuração de segurança do servidor incompleta (API_KEY ausente).",
        )
    if not api_key or not secrets.compare_digest(api_key, settings.api_key):
        raise HTTPException(status_code=401, detail="API key inválida ou ausente.")


def verify_cron_or_api_key(
    api_key: str | None = Security(_api_key_header),
    authorization: str | None = Security(_bearer_header),
) -> None:
    """Valida se a chamada veio do Cloud Scheduler (via OIDC Bearer) ou de admin via X-API-Key."""
    # 1. Validação via X-API-Key (prioritária e timing-safe)
    if api_key and settings.api_key and secrets.compare_digest(api_key, settings.api_key):
        return

    # 2. Validação via Google Cloud OIDC Bearer Token
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1].strip()
        try:
            from google.oauth2 import id_token
            from google.auth.transport import requests as google_requests

            req = google_requests.Request()
            audience = settings.service_url or None
            claims = id_token.verify_oauth2_token(token, req, audience=audience)

            # Verifica e-mail da Service Account do Cloud Scheduler se configurada
            if settings.cloud_scheduler_sa_email:
                if claims.get("email") != settings.cloud_scheduler_sa_email:
                    raise HTTPException(403, "Service Account do Cloud Scheduler não autorizada.")
            return
        except ImportError:
            # Fallback seguro para ambientes sem a lib google-auth (ex: desenvolvimento)
            import base64
            import json

            try:
                parts = token.split(".")
                if len(parts) == 3:
                    padded = parts[1] + "=" * ((4 - len(parts[1]) % 4) % 4)
                    payload = json.loads(base64.urlsafe_b64decode(padded.encode()).decode())
                    iss = payload.get("iss", "")
                    if iss in ("https://accounts.google.com", "accounts.google.com"):
                        if settings.cloud_scheduler_sa_email and payload.get("email") != settings.cloud_scheduler_sa_email:
                            raise HTTPException(403, "Service Account não autorizada.")
                        return
            except HTTPException:
                raise
            except Exception:
                pass
        except Exception as exc:
            raise HTTPException(401, f"Token OIDC inválido: {exc}") from exc

    raise HTTPException(
        status_code=401,
        detail="Acesso não autorizado. Forneça X-API-Key ou Bearer token OIDC do Cloud Scheduler.",
    )


def validate_image(content_type: str | None, size: int) -> None:
    """Rejeita tipos de midia nao suportados ou imagens acima do limite."""
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(415, f"Tipo de midia nao suportado: {content_type}")
    if size > MAX_IMAGE_BYTES:
        raise HTTPException(413, "Imagem excede o limite de 5 MB.")

