"""Dependencias e validacoes compartilhadas entre routers."""
from __future__ import annotations

from fastapi import HTTPException, Security
from fastapi.security.api_key import APIKeyHeader

from app.config import settings

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_IMAGE_BYTES = 5 * 1024 * 1024  # 5 MB

_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def verify_api_key(api_key: str | None = Security(_api_key_header)) -> None:
    """Valida X-API-Key quando a variavel API_KEY estiver configurada."""
    if settings.api_key and api_key != settings.api_key:
        raise HTTPException(status_code=401, detail="API key invalida ou ausente.")


def validate_image(content_type: str | None, size: int) -> None:
    """Rejeita tipos de midia nao suportados ou imagens acima do limite."""
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(415, f"Tipo de midia nao suportado: {content_type}")
    if size > MAX_IMAGE_BYTES:
        raise HTTPException(413, "Imagem excede o limite de 5 MB.")
