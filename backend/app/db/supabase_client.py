"""Singleton do cliente Supabase (service_role — nunca expor ao frontend)."""
from __future__ import annotations

from supabase import Client, create_client

from app.config import settings

_client: Client | None = None


def get_client() -> Client:
    global _client
    if _client is None:
        _client = create_client(settings.supabase_url, settings.supabase_service_key)
    return _client
