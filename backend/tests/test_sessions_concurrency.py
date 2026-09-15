"""Testes unitários de concorrência, histerese, integridade do banco e ciclo de vida de sessões."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch
import pytest

from app.config import settings
from app.services.session_service import (
    UTC,
    close_stale_sessions,
    register_event,
    total_hours,
)


# ── Testes de Histerese e Debounce Anti-Flip-Flop ─────────────────────────────


def test_register_event_debounce_prevents_flip_flop():
    """Garante que requisições em rajada (duplo clique / jitter) não oscilam entrada/saída."""
    profile_id = "user-uuid-1"
    now = datetime.now(UTC)

    # Mock de último evento recente (há 5 segundos)
    recent_ts = now - timedelta(seconds=5)
    with patch("app.services.session_service._last_event_ts", return_value=recent_ts):
        with patch.object(settings, "debounce_seconds", 60):
            res = register_event(profile_id)
            assert res["action"] == "debounced"
            assert res["profile_id"] == profile_id
            assert res["wait_seconds"] > 0


def test_register_event_prevents_immediate_accidental_checkout():
    """Se o usuário acabou de abrir a sessão há 10s, alternância automática deve debounciar."""
    profile_id = "user-uuid-2"
    now = datetime.now(UTC)
    check_in_dt = now - timedelta(seconds=10)

    # Simula sessão aberta recentemente
    open_sess = {"id": 101, "check_in": check_in_dt.isoformat()}

    with (
        patch("app.services.session_service._last_event_ts", return_value=None),
        patch("app.services.session_service._open_session", return_value=open_sess),
        patch.object(settings, "debounce_seconds", 60),
    ):
        # Chamada sem action explícito (tentativa de alternar para saída)
        res = register_event(profile_id, action=None)
        assert res["action"] == "debounced"
        assert res["wait_seconds"] > 0


# ── Teste de Concorrência: Captura de Colisão 23505 (Índice Único) ────────────


def test_register_event_handles_concurrent_insert_collision():
    """Garante que colisão no índice parcial UNIQUE idx_sessions_profile_single_open é tratada."""
    profile_id = "user-uuid-3"
    mock_db = MagicMock()

    # Simula erro de chave duplicada do PostgreSQL (23505) lançado na inserção
    mock_db.table.return_value.insert.return_value.execute.side_effect = Exception(
        'duplicate key value violates unique constraint "idx_sessions_profile_single_open" (23505)'
    )

    with (
        patch("app.services.session_service.get_client", return_value=mock_db),
        patch("app.services.session_service._last_event_ts", return_value=None),
        patch("app.services.session_service._open_session", return_value=None),
    ):
        # A requisição deve ser tratada como já presente sem lançar exceção
        res = register_event(profile_id, action="check_in")
        assert res["action"] == "already_in"
        assert res["profile_id"] == profile_id


# ── Teste de Total de Horas: Turnos Noturnos e Consulta Mensal ───────────────


def test_total_hours_night_shift_across_midnight():
    """Turno noturno que cruza a meia-noite (22:00 às 04:00) deve computar 6.0 horas em UTC."""
    profile_id = "user-uuid-night"
    mock_db = MagicMock()

    # Sessão das 22h00 de 10/09 às 04h00 de 11/09
    sessions_data = [{
        "check_in": "2026-09-10T22:00:00+00:00",
        "check_out": "2026-09-11T04:00:00+00:00",
    }]
    mock_db.table.return_value.select.return_value.eq.return_value.not_.is_.return_value.is_.return_value.execute.return_value.data = (
        sessions_data
    )

    with patch("app.services.session_service.get_client", return_value=mock_db):
        hours = total_hours(profile_id)
        assert hours == 6.0


def test_total_hours_month_filter_no_day_32_error():
    """Garante que a query mensal não usa f'{prefix}-32' e calcula limites ISO válidos."""
    profile_id = "user-uuid-month"
    mock_db = MagicMock()
    mock_q = MagicMock()
    mock_db.table.return_value.select.return_value.eq.return_value.not_.is_.return_value.is_.return_value = (
        mock_q
    )
    mock_q.gte.return_value.lt.return_value.execute.return_value.data = []

    with patch("app.services.session_service.get_client", return_value=mock_db):
        # Teste para Fevereiro (onde dia 32 causava crash sintático)
        total_hours(profile_id, year=2026, month=2)
        mock_q.gte.assert_called_with("check_in", "2026-02-01T00:00:00Z")
        mock_q.gte.return_value.lt.assert_called_with("check_in", "2026-03-01T00:00:00Z")

        # Teste para Dezembro (virada para Janeiro do ano seguinte)
        total_hours(profile_id, year=2026, month=12)
        mock_q.gte.assert_called_with("check_in", "2026-12-01T00:00:00Z")
        mock_q.gte.return_value.lt.assert_called_with("check_in", "2027-01-01T00:00:00Z")


# ── Teste de Sweep Justo com Teto e auto_closed ──────────────────────────────


def test_close_stale_sessions_sets_voided_at_and_zero_hours():
    """Sessões esquecidas devem ser anuladas (voided_at preenchido) contando 0 horas.

    Comportamento documentado no README: saída esquecida → 0 horas creditadas.
    O campo voided_at indica que a sessão não deve ser contabilizada nos relatórios.
    """
    mock_db = MagicMock()

    # Sessão aberta iniciada há 14 horas
    now = datetime.now(UTC)
    stale_check_in = (now - timedelta(hours=14)).isoformat()
    mock_db.table.return_value.select.return_value.is_.return_value.lt.return_value.execute.return_value.data = [
        {"id": 55, "check_in": stale_check_in}
    ]

    with patch("app.services.session_service.get_client", return_value=mock_db):
        res = close_stale_sessions()
        assert res["auto_closed"] == 1

        # Verifica que o update foi chamado com voided_at e auto_closed=True
        update_call = mock_db.table.return_value.update
        assert update_call.called
        update_payload = update_call.call_args[0][0]
        assert update_payload["auto_closed"] is True
        assert "voided_at" in update_payload, (
            "voided_at deve ser preenchido para garantir 0 horas creditadas (conforme README)"
        )
        assert "check_out" in update_payload
        # voided_at e check_out devem ser iguais (timestamp do momento do sweep)
        assert update_payload["voided_at"] == update_payload["check_out"]


# ── Testes de Encerramento Manual de Sessão por Tutor (/sessions/tutor-close) ─


def test_tutor_close_session_unauthorized():
    """Endpoint /sessions/tutor-close exige autenticação de tutor (HTTP 401 sem token)."""
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app, raise_server_exceptions=False)
    res = client.post(
        "/api/v1/sessions/tutor-close",
        json={"profile_id": "334e33f9-3bd0-478e-8e05-e68a4e11ee5a", "action": "checkout"},
    )
    assert res.status_code == 401


def test_tutor_close_session_invalid_action():
    """Ação inválida deve ser rejeitada com validação Pydantic 422."""
    from fastapi.testclient import TestClient
    from app.main import app

    # Mock do tutor auth para passar da dependência verify_tutor_token
    mock_user = MagicMock()
    mock_user.id = "tutor-uuid"
    mock_user.app_metadata = {"role": "tutor"}
    mock_resp = MagicMock()
    mock_resp.user = mock_user

    mock_client = MagicMock()
    mock_client.auth.get_user.return_value = mock_resp

    with patch("app.db.supabase_client.get_client", return_value=mock_client):
        client = TestClient(app, raise_server_exceptions=False)
        res = client.post(
            "/api/v1/sessions/tutor-close",
            headers={"Authorization": "Bearer valid.tutor.jwt"},
            json={"profile_id": "334e33f9-3bd0-478e-8e05-e68a4e11ee5a", "action": "invalid_action"},
        )
        assert res.status_code == 422


def test_tutor_close_session_checkout_success():
    """Tutor encerra sessão com 'checkout': atualiza check_out e retorna sucesso."""
    from fastapi.testclient import TestClient
    from app.main import app

    mock_user = MagicMock()
    mock_user.id = "tutor-uuid"
    mock_user.app_metadata = {"role": "tutor"}
    mock_resp = MagicMock()
    mock_resp.user = mock_user

    mock_db = MagicMock()
    mock_db.auth.get_user.return_value = mock_resp
    # Mock da tabela sessions update: .update().eq().is_().execute() -> data=[{"id": 495}]
    mock_query = mock_db.table.return_value.update.return_value.eq.return_value.is_.return_value
    mock_query.execute.return_value.data = [{"id": 495}]

    with (
        patch("app.db.supabase_client.get_client", return_value=mock_db),
        patch("app.routers.recognize.get_client", return_value=mock_db),
    ):
        client = TestClient(app, raise_server_exceptions=False)
        res = client.post(
            "/api/v1/sessions/tutor-close",
            headers={"Authorization": "Bearer valid.tutor.jwt"},
            json={"profile_id": "334e33f9-3bd0-478e-8e05-e68a4e11ee5a", "action": "checkout"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["action"] == "checkout"
        assert data["updated_rows"] == 1

        # Garante que o update foi chamado com check_out e sem voided_at
        update_args = mock_db.table.return_value.update.call_args[0][0]
        assert "check_out" in update_args
        assert "voided_at" not in update_args


def test_tutor_close_session_void_success():
    """Tutor anula sessão com 'void': atualiza check_out, voided_at e auto_closed=True."""
    from fastapi.testclient import TestClient
    from app.main import app

    mock_user = MagicMock()
    mock_user.id = "tutor-uuid"
    mock_user.app_metadata = {"role": "tutor"}
    mock_resp = MagicMock()
    mock_resp.user = mock_user

    mock_db = MagicMock()
    mock_db.auth.get_user.return_value = mock_resp
    mock_query = mock_db.table.return_value.update.return_value.eq.return_value.is_.return_value
    mock_query.execute.return_value.data = [{"id": 495}]

    with (
        patch("app.db.supabase_client.get_client", return_value=mock_db),
        patch("app.routers.recognize.get_client", return_value=mock_db),
    ):
        client = TestClient(app, raise_server_exceptions=False)
        res = client.post(
            "/api/v1/sessions/tutor-close",
            headers={"Authorization": "Bearer valid.tutor.jwt"},
            json={"profile_id": "334e33f9-3bd0-478e-8e05-e68a4e11ee5a", "action": "void"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["action"] == "void"
        assert data["updated_rows"] == 1

        # Garante que o update foi chamado com check_out, voided_at e auto_closed
        update_args = mock_db.table.return_value.update.call_args[0][0]
        assert "check_out" in update_args
        assert "voided_at" in update_args
        assert update_args["auto_closed"] is True

