"""Singleton do cliente Supabase (service_role — nunca expor ao frontend)."""
from __future__ import annotations

from typing import TYPE_CHECKING, Any

from app.config import settings

if TYPE_CHECKING:
    from supabase import Client

_client: Any = None


def get_client() -> Any:
    global _client
    if _client is None:
        try:
            from supabase import create_client
        except ImportError as exc:
            raise RuntimeError(
                "supabase nao instalado. Execute: pip install supabase"
            ) from exc
        _client = create_client(settings.supabase_url, settings.supabase_service_key)
    return _client
