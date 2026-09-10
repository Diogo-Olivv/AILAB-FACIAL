"""Testes unitários de infraestrutura, desempenho, warmup, OIDC e pgvector."""
from __future__ import annotations

import base64
import json
from unittest.mock import MagicMock, patch
import numpy as np
import pytest
from fastapi import HTTPException

from app.config import settings
from app.deps import verify_cron_or_api_key
from app.routers.health import health, readiness
from app.routers.maintenance import run_maintenance_cleanup
from app.services.face_service import (
    _match_face_pgvector,
    is_model_loaded,
    warmup,
)


# ── 1. Testes de Warmup e Readiness Probe ─────────────────────────────────────


def test_health_liveness_and_readiness():
    """Testa endpoints de liveness (health) e readiness (readiness)."""
    res_live = health()
    assert res_live == {"status": "ok"}

    with patch("app.routers.health.is_model_loaded", return_value=True):
        res_ready = readiness()
        assert res_ready == {"status": "ready", "models_loaded": True}

    with patch("app.routers.health.is_model_loaded", return_value=False):
        res_warming = readiness()
        assert res_warming == {"status": "warming_up", "models_loaded": False}


def test_warmup_pipeline_execution():
    """Garante que warmup exercita detecção, reconhecimento e algoritmos de vivacidade."""
    mock_fa = MagicMock()
    mock_rec = MagicMock()
    mock_fa.models = {"recognition": mock_rec}

    with (
        patch("app.services.face_service._analyzer_instance", return_value=mock_fa),
        patch("app.services.face_service.check_image_quality") as mock_fiqa,
        patch("app.services.face_service.verify_liveness", return_value=(True, 0.9, "ok")) as mock_pad,
    ):
        warmup()

        # Detecção executada
        mock_fa.get.assert_called_once()
        # Reconhecimento executado
        mock_rec.get_feat.assert_called_once()
        # FIQA e PAD aquecidos
        mock_fiqa.assert_called_once()
        mock_pad.assert_called_once()


# ── 2. Testes de Autenticação Cloud Scheduler OIDC e API Key ──────────────────


def test_verify_cron_or_api_key_with_valid_api_key():
    """Permite acesso quando X-API-Key válida é fornecida."""
    with patch.object(settings, "api_key", "secret-test-key"):
        # Não deve lançar exceção
        verify_cron_or_api_key(api_key="secret-test-key", authorization=None)


def test_verify_cron_or_api_key_rejects_empty_or_invalid():
    """Rejeita chamada sem credenciais ou com token inválido."""
    with patch.object(settings, "api_key", "secret-test-key"):
        with pytest.raises(HTTPException) as exc:
            verify_cron_or_api_key(api_key="wrong-key", authorization=None)
        assert exc.value.status_code == 401


def test_verify_cron_or_api_key_with_valid_google_oidc():
    """Valida token JWT emitido pelo Google Cloud para o Cloud Scheduler."""
    # Simula payload JWT de conta de serviço Google
    header = base64.urlsafe_b64encode(b'{"alg":"RS256"}').decode().rstrip("=")
    claims = {
        "iss": "https://accounts.google.com",
        "email": "ailab-scheduler@gserviceaccount.com",
        "aud": "https://ailab-facial-backend.a.run.app",
    }
    payload = base64.urlsafe_b64encode(json.dumps(claims).encode()).decode().rstrip("=")
    fake_jwt = f"{header}.{payload}.fake_signature"

    with (
        patch.object(settings, "api_key", "secret-key"),
        patch.object(settings, "cloud_scheduler_sa_email", "ailab-scheduler@gserviceaccount.com"),
    ):
        # Deve passar na validação OIDC
        verify_cron_or_api_key(api_key=None, authorization=f"Bearer {fake_jwt}")


def test_verify_cron_or_api_key_rejects_unauthorized_service_account():
    """Rejeita token OIDC emitido para Service Account não autorizada."""
    header = base64.urlsafe_b64encode(b'{"alg":"RS256"}').decode().rstrip("=")
    claims = {
        "iss": "https://accounts.google.com",
        "email": "attacker@evil.com",
    }
    payload = base64.urlsafe_b64encode(json.dumps(claims).encode()).decode().rstrip("=")
    fake_jwt = f"{header}.{payload}.fake_signature"

    with (
        patch.object(settings, "api_key", "secret-key"),
        patch.object(settings, "cloud_scheduler_sa_email", "ailab-scheduler@gserviceaccount.com"),
    ):
        with pytest.raises(HTTPException) as exc:
            verify_cron_or_api_key(api_key=None, authorization=f"Bearer {fake_jwt}")
        assert exc.value.status_code == 403


# ── 3. Testes de Busca Vetorial pgvector e Fallback ───────────────────────────


def test_match_face_pgvector_success():
    """Testa consulta via RPC match_face retornando top-1 similaridade cosseno."""
    mock_db = MagicMock()
    mock_rpc = MagicMock()
    mock_db.rpc.return_value = mock_rpc
    mock_rpc.execute.return_value = MagicMock(
        data=[
            {
                "profile_id": "prof-uuid-123",
                "name": "Maria Silva",
                "avatar_url": None,
                "similarity": 0.85,
            }
        ]
    )

    query_enc = np.ones(512, dtype=np.float64) / np.sqrt(512)

    with patch("app.services.face_service.get_client", return_value=mock_db):
        res = _match_face_pgvector(query_enc)

        assert res is not None
        assert res["recognized"] is True
        assert res["profile_id"] == "prof-uuid-123"
        assert res["name"] == "Maria Silva"
        assert res["cosine_similarity"] == 0.85
        assert res["confidence"] > 0.80


def test_match_face_pgvector_fallback_on_exception():
    """Se a RPC do pgvector falhar (ex: extensão não habilitada), retorna None acionando fallback."""
    mock_db = MagicMock()
    mock_db.rpc.side_effect = Exception("function match_face does not exist")

    query_enc = np.ones(512, dtype=np.float64) / np.sqrt(512)

    with patch("app.services.face_service.get_client", return_value=mock_db):
        res = _match_face_pgvector(query_enc)
        # Deve capturar a exceção e retornar None para acionar o fallback em memória
        assert res is None


# ── 4. Teste de Manutenção e Sweep de Sessões ─────────────────────────────────


def test_maintenance_cleanup_endpoint():
    """Testa endpoint POST /api/v1/maintenance/cleanup chamando sweeper e invalidando cache."""
    with (
        patch("app.routers.maintenance.close_stale_sessions", return_value={"closed": 3}) as mock_sweep,
        patch("app.routers.maintenance.invalidate_embeddings_cache") as mock_cache_inv,
    ):
        data = run_maintenance_cleanup()
        assert data["status"] == "ok"
        assert data["sessions_sweep"] == {"closed": 3}
        assert data["cache_invalidated"] is True
        mock_sweep.assert_called_once()
        mock_cache_inv.assert_called_once()
