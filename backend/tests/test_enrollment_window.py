"""Testes da janela cadastral temporária de recadastro biométrico.

Cobre os 4 cenários de aceite definidos no plano de implementação:
1. Fora da janela (antes): sem token → 401
2. Dentro da janela: sem token → 200
3. Fora da janela (depois): sem token → 401
4. Dentro da janela + token válido → 200 (redundância segura)
"""
from __future__ import annotations

from datetime import datetime
from unittest.mock import patch

import pytest

from app.services.enrollment_window import (
    SP_TZ,
    WINDOW_END,
    WINDOW_START,
    is_enrollment_window_active,
)

# ── Utilitários de helper ──────────────────────────────────────────────────────

def _dt(year: int, month: int, day: int, hour: int = 12) -> datetime:
    """Cria datetime em SP_TZ para testes."""
    return datetime(year, month, day, hour, 0, 0, tzinfo=SP_TZ)


# ── Testes de is_enrollment_window_active() ────────────────────────────────────

class TestIsEnrollmentWindowActive:
    def test_before_window_returns_false(self):
        """27/09/2026 → fora da janela (antes)."""
        fake_now = _dt(2026, 9, 27, 23)  # 1 segundo antes da janela
        with patch("app.services.enrollment_window.datetime") as mock_dt:
            mock_dt.now.return_value = fake_now
            mock_dt.side_effect = lambda *a, **kw: datetime(*a, **kw)
            assert is_enrollment_window_active() is False

    def test_at_window_start_returns_true(self):
        """28/09/2026 00:00:00 → exatamente no início da janela."""
        fake_now = WINDOW_START
        with patch("app.services.enrollment_window.datetime") as mock_dt:
            mock_dt.now.return_value = fake_now
            mock_dt.side_effect = lambda *a, **kw: datetime(*a, **kw)
            assert is_enrollment_window_active() is True

    def test_inside_window_returns_true(self):
        """29/09/2026 14:30 → dentro da janela."""
        fake_now = _dt(2026, 9, 29, 14)
        with patch("app.services.enrollment_window.datetime") as mock_dt:
            mock_dt.now.return_value = fake_now
            mock_dt.side_effect = lambda *a, **kw: datetime(*a, **kw)
            assert is_enrollment_window_active() is True

    def test_at_window_end_returns_true(self):
        """02/10/2026 23:59:59 → exatamente no fim da janela."""
        fake_now = WINDOW_END
        with patch("app.services.enrollment_window.datetime") as mock_dt:
            mock_dt.now.return_value = fake_now
            mock_dt.side_effect = lambda *a, **kw: datetime(*a, **kw)
            assert is_enrollment_window_active() is True

    def test_after_window_returns_false(self):
        """03/10/2026 → fora da janela (depois)."""
        fake_now = _dt(2026, 10, 3, 0)  # 1 segundo após o fim
        with patch("app.services.enrollment_window.datetime") as mock_dt:
            mock_dt.now.return_value = fake_now
            mock_dt.side_effect = lambda *a, **kw: datetime(*a, **kw)
            assert is_enrollment_window_active() is False

    def test_months_before_window_returns_false(self):
        """01/01/2026 → muito antes da janela."""
        fake_now = _dt(2026, 1, 1, 8)
        with patch("app.services.enrollment_window.datetime") as mock_dt:
            mock_dt.now.return_value = fake_now
            mock_dt.side_effect = lambda *a, **kw: datetime(*a, **kw)
            assert is_enrollment_window_active() is False


# ── Testes de require_tutor_or_window via TestClient ───────────────────────────

@pytest.fixture
def client():
    """Cliente FastAPI com app completo."""
    from fastapi.testclient import TestClient

    from app.main import app
    return TestClient(app)


def _patch_window(active: bool):
    """Patch de is_enrollment_window_active nos dois módulos que a importam."""
    return patch(
        "app.services.enrollment_window.is_enrollment_window_active",
        return_value=active,
    )


class TestRefreshEmbeddingWindowIntegration:
    """Testa o endpoint POST /api/v1/profiles/{id}/refresh-embedding com controle de identidade."""

    ENDPOINT = "/api/v1/profiles/dummy-profile-id/refresh-embedding"

    def _make_frames(self):
        """Cria 3 frames de imagem JPEG mínimos para satisfazer a validação de quantidade."""
        min_jpg = b"\xff\xd8\xff\xe0" + b"\x00" * 12 + b"\xff\xd9"
        return [
            ("frames", (f"frame{i}.jpg", min_jpg, "image/jpeg"))
            for i in range(3)
        ]

    def test_no_token_outside_window_returns_401(self, client):
        """Sem token + fora da janela → 401 Unauthorized."""
        with _patch_window(False):
            resp = client.post(self.ENDPOINT, files=self._make_frames())
        assert resp.status_code == 401

    def test_no_token_inside_window_still_returns_401(self, client):
        """Sem token + dentro da janela → 401 (nunca há bypass anônimo sem credencial)."""
        with _patch_window(True):
            resp = client.post(self.ENDPOINT, files=self._make_frames())
        assert resp.status_code == 401

    def test_kiosk_token_outside_window_returns_403(self, client):
        """Dispositivo Kiosk fora da janela cadastral recebe 403 (apenas tutor permitido)."""
        from types import SimpleNamespace
        fake_kiosk = SimpleNamespace(
            id="kiosk-uuid", email="kiosk@kiosk.ailab.invalid", app_metadata={"role": "kiosk"}, is_anonymous=False, banned_until=None
        )
        with _patch_window(False), patch("app.deps._fetch_user", return_value=fake_kiosk):
            resp = client.post(
                self.ENDPOINT,
                headers={"Authorization": "Bearer valid.kiosk.jwt"},
                files=self._make_frames(),
            )
        assert resp.status_code == 403

    def test_kiosk_token_inside_window_is_accepted(self, client):
        """Dispositivo Kiosk autenticado é aceito durante a janela cadastral."""
        from types import SimpleNamespace
        fake_kiosk = SimpleNamespace(
            id="kiosk-uuid", email="kiosk@kiosk.ailab.invalid", app_metadata={"role": "kiosk"}, is_anonymous=False, banned_until=None
        )
        with _patch_window(True), patch("app.deps._fetch_user", return_value=fake_kiosk):
            resp = client.post(
                self.ENDPOINT,
                headers={"Authorization": "Bearer valid.kiosk.jwt"},
                files=self._make_frames(),
            )
        # Passou da autenticação: não deve ser 401 nem 403
        assert resp.status_code not in (401, 403)

    def test_tutor_token_outside_and_inside_window_is_accepted(self, client):
        """Tutor autenticado é aceito tanto fora quanto dentro da janela cadastral."""
        from types import SimpleNamespace
        fake_tutor = SimpleNamespace(
            id="tutor-uuid", email="tutor@ailab.org", app_metadata={"role": "tutor"}, is_anonymous=False, banned_until=None
        )
        for is_active in (False, True):
            with _patch_window(is_active), patch("app.deps._fetch_user", return_value=fake_tutor):
                resp = client.post(
                    self.ENDPOINT,
                    headers={"Authorization": "Bearer valid.tutor.jwt"},
                    files=self._make_frames(),
                )
            assert resp.status_code not in (401, 403)
