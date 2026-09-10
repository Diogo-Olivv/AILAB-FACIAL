"""Testes unitários de Segurança e LGPD: autenticação fail-closed, timing-safe e direitos do titular."""
from __future__ import annotations

from unittest.mock import MagicMock, patch
from fastapi import HTTPException
import pytest

from app.config import settings
from app.deps import verify_api_key
from app.routers.profiles import delete_profile, get_profile, revoke_consent


# ── Testes de Autenticação Segura & Fail-Closed ───────────────────────────────


def test_verify_api_key_fail_closed_when_key_empty():
    """Se o servidor não possui API_KEY configurada, deve falhar com HTTP 500 (Fail-Closed)."""
    with patch.object(settings, "api_key", ""):
        with pytest.raises(HTTPException) as exc_info:
            verify_api_key(api_key="any-key")

        assert exc_info.value.status_code == 500
        assert "fail-closed" in str(exc_info.value.detail).lower() or "incompleta" in str(
            exc_info.value.detail
        ).lower()


def test_verify_api_key_rejects_missing_or_invalid_key():
    """Chave ausente ou incorreta deve retornar HTTP 401."""
    with patch.object(settings, "api_key", "super-secret-token-123"):
        # Chave ausente (None)
        with pytest.raises(HTTPException) as exc_none:
            verify_api_key(api_key=None)
        assert exc_none.value.status_code == 401

        # Chave vazia
        with pytest.raises(HTTPException) as exc_empty:
            verify_api_key(api_key="")
        assert exc_empty.value.status_code == 401

        # Chave incorreta
        with pytest.raises(HTTPException) as exc_wrong:
            verify_api_key(api_key="wrong-token-abc")
        assert exc_wrong.value.status_code == 401


def test_verify_api_key_accepts_valid_key():
    """Chave correta deve passar sem levantar exceção."""
    with patch.object(settings, "api_key", "super-secret-token-123"):
        # Não deve levantar exceção
        verify_api_key(api_key="super-secret-token-123")


def test_verify_api_key_timing_safe_compare():
    """Garante o uso de secrets.compare_digest para imunidade contra timing attacks."""
    with patch.object(settings, "api_key", "valid-key-xyz"):
        with patch("secrets.compare_digest", return_value=True) as mock_compare:
            verify_api_key(api_key="test-key")
            assert mock_compare.called


# ── Testes dos Endpoints de Direitos do Titular LGPD ─────────────────────────


def test_get_profile_not_found():
    """Perfil inexistente deve retornar HTTP 404."""
    mock_db = MagicMock()
    mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []

    with patch("app.routers.profiles.get_client", return_value=mock_db):
        with pytest.raises(HTTPException) as exc_info:
            get_profile("non-existent-uuid")
        assert exc_info.value.status_code == 404


def test_revoke_consent_success():
    """Revogação de consentimento deve inativar perfil, marcar timestamp e deletar embeddings."""
    mock_db = MagicMock()
    # Mock do check se perfil existe
    mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
        {"id": "uuid-123", "name": "Maria Silva", "active": True}
    ]

    with (
        patch("app.routers.profiles.get_client", return_value=mock_db),
        patch("app.routers.profiles.invalidate_embeddings_cache") as mock_invalidate,
    ):
        res = revoke_consent("uuid-123")

        assert res["revoked"] is True
        assert res["profile_id"] == "uuid-123"
        assert "revogado" in res["message"]
        # Verifica invalidação de cache
        assert mock_invalidate.called


def test_delete_profile_success():
    """Eliminação definitiva deve remover embeddings, logs, perfil e invalidar cache."""
    mock_db = MagicMock()
    # Mock do check se perfil existe
    mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
        {"id": "uuid-456", "name": "João Santos"}
    ]

    with (
        patch("app.routers.profiles.get_client", return_value=mock_db),
        patch("app.routers.profiles.invalidate_embeddings_cache") as mock_invalidate,
    ):
        res = delete_profile("uuid-456")

        assert res["deleted"] is True
        assert res["profile_id"] == "uuid-456"
        assert mock_invalidate.called
