"""Testes unitários para a Fase P3: Manutenção, Retenção de Dados LGPD e Governança/Fairness de IA."""
from __future__ import annotations

from unittest.mock import MagicMock, patch
import pytest

from app.routers.maintenance import purge_old_face_logs, run_maintenance_cleanup
from scripts.fairness_audit import evaluate_biometric_fairness


# ── Testes de Retenção de Dados e Expurgo de Logs (LGPD Art. 16) ───────────────


def test_purge_old_face_logs_success():
    """Garante que registros de face_logs anteriores ao cutoff são excluídos corretamente."""
    mock_db = MagicMock()
    mock_table = MagicMock()
    mock_delete = MagicMock()
    mock_lt = MagicMock()

    mock_db.table.return_value = mock_table
    mock_table.delete.return_value = mock_delete
    mock_delete.lt.return_value = mock_lt
    mock_lt.execute.return_value = MagicMock(data=[{"id": 1}, {"id": 2}, {"id": 3}])

    with patch("app.routers.maintenance.get_client", return_value=mock_db):
        purged = purge_old_face_logs("2026-06-15T00:00:00Z")
        assert purged == 3
        mock_table.delete.assert_called_once()
        mock_delete.lt.assert_called_once_with("created_at", "2026-06-15T00:00:00Z")


def test_purge_old_face_logs_handles_error_gracefully():
    """Em caso de falha de banco no purge, a rotina não deve quebrar a aplicação."""
    mock_db = MagicMock()
    mock_db.table.side_effect = Exception("Database timeout")

    with patch("app.routers.maintenance.get_client", return_value=mock_db):
        purged = purge_old_face_logs("2026-06-15T00:00:00Z")
        assert purged == 0


def test_run_maintenance_cleanup_invokes_log_purge():
    """Valida que o endpoint de cleanup executa o expurgo de logs e inclui a métrica na resposta."""
    with (
        patch("app.routers.maintenance.close_stale_sessions", return_value={"auto_closed": 2}),
        patch("app.routers.maintenance.invalidate_embeddings_cache"),
        patch("app.routers.maintenance.purge_old_face_logs", return_value=5) as mock_purge,
    ):
        res = run_maintenance_cleanup()
        assert res["status"] == "ok"
        assert res["sessions_sweep"]["auto_closed"] == 2
        assert res["cache_invalidated"] is True
        assert res["purged_face_logs"] == 5
        assert mock_purge.called


# ── Testes de Avaliação de Viés e Governança de IA (NIST AI RMF) ───────────────


def test_evaluate_biometric_fairness_passes_criteria():
    """Valida que a auditoria sintética de fairness gera relatório aprovado com métricas estatísticas."""
    report = evaluate_biometric_fairness(num_subjects=30, samples_per_subject=5, threshold=0.68)

    assert report["status"] == "PASS"
    assert "metrics" in report
    assert report["metrics"]["fnmr_standard"] <= 0.01
    assert report["metrics"]["fmr_impostor"] == 0.0
    assert report["metrics"]["separation_margin"] > 0.40
    assert "governance_evaluation" in report
