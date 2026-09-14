"""Testes unitários e de integração para o Desafio Temporal e Nonce Anti-Injeção Digital (F-002 / P1-4)."""
from __future__ import annotations

import io
import time
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from PIL import Image
import pytest

from app.config import settings
from app.main import app
from app.services.challenge_service import (
    clear_consumed_cache_for_testing,
    create_capture_challenge,
    verify_and_consume_challenge,
)


@pytest.fixture(autouse=True)
def _reset_challenge_cache():
    """Garante isolamento do cache de nonces consumidos entre os testes."""
    clear_consumed_cache_for_testing()
    yield
    clear_consumed_cache_for_testing()


def _dummy_image_bytes() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (100, 100)).save(buf, format="JPEG")
    return buf.getvalue()


# ── Testes de Unidade do Serviço de Desafio ───────────────────────────────────


def test_create_capture_challenge_structure():
    """Gera desafio e valida integridade da estrutura retornada."""
    res = create_capture_challenge(ttl_seconds=15)
    assert "challenge_id" in res
    assert "expires_at" in res
    assert res["ttl_seconds"] == 15
    assert res["expires_at"] > int(time.time())

    parts = res["challenge_id"].split(".")
    assert len(parts) == 2, "Token deve ser composto por payload.signature"


def test_verify_and_consume_challenge_success():
    """Valida que um desafio fresco e legítimo é consumido com sucesso."""
    challenge = create_capture_challenge(ttl_seconds=30)
    token = challenge["challenge_id"]

    valid, reason = verify_and_consume_challenge(token)
    assert valid is True
    assert reason == "OK"


def test_verify_and_consume_challenge_anti_replay():
    """Garante que reutilizar o mesmo token falha na segunda tentativa (Anti-Replay)."""
    challenge = create_capture_challenge(ttl_seconds=30)
    token = challenge["challenge_id"]

    # Primeiro uso: sucesso
    valid1, reason1 = verify_and_consume_challenge(token)
    assert valid1 is True

    # Segundo uso com o mesmo token: rejeição imediata
    valid2, reason2 = verify_and_consume_challenge(token)
    assert valid2 is False
    assert "replay" in reason2.lower() or "já utilizado" in reason2.lower()


def test_verify_and_consume_challenge_rejects_missing_or_empty():
    """Garante rejeição para token ausente, vazio ou contendo apenas espaços."""
    valid, reason = verify_and_consume_challenge(None)
    assert valid is False
    assert "ausente" in reason.lower()

    valid2, reason2 = verify_and_consume_challenge("   ")
    assert valid2 is False
    assert "ausente" in reason2.lower()


def test_verify_and_consume_challenge_rejects_tampered_signature():
    """Garante que alteração em qualquer byte do token invalida a assinatura HMAC."""
    challenge = create_capture_challenge(ttl_seconds=30)
    token = challenge["challenge_id"]
    payload_b64, sig_b64 = token.split(".")

    # Adulteração na assinatura (garante que o caractere sempre mude)
    flipped_char = "B" if sig_b64[0] == "A" else "A"
    tampered_sig = flipped_char + sig_b64[1:]
    tampered_token = f"{payload_b64}.{tampered_sig}"

    valid, reason = verify_and_consume_challenge(tampered_token)
    assert valid is False
    assert "inválida" in reason.lower() or "forjada" in reason.lower()


def test_verify_and_consume_challenge_rejects_expired():
    """Garante rejeição quando o tempo do desafio expirou (now > exp)."""
    # Cria desafio com TTL de 1 segundo
    challenge = create_capture_challenge(ttl_seconds=1)
    token = challenge["challenge_id"]

    # Simula passagem de tempo de 2 segundos no futuro
    future_time = time.time() + 2.5
    with patch("time.time", return_value=future_time):
        valid, reason = verify_and_consume_challenge(token)
        assert valid is False
        assert "expirado" in reason.lower()


# ── Testes de Integração nas Rotas da API (TestClient) ────────────────────────


def test_challenge_endpoint_requires_kiosk_key():
    """GET/POST /api/v1/recognize/challenge exige autenticação de Kiosk."""
    client = TestClient(app, raise_server_exceptions=False)
    with patch.object(settings, "kiosk_api_key", "secret-kiosk-999"):
        res_no_auth = client.post("/api/v1/recognize/challenge")
        assert res_no_auth.status_code == 401

        # Com autenticação válida via X-Kiosk-Key
        res_auth = client.post(
            "/api/v1/recognize/challenge",
            headers={"X-Kiosk-Key": "secret-kiosk-999"},
        )
        assert res_auth.status_code == 200
        body = res_auth.json()
        assert "challenge_id" in body
        assert body["ttl_seconds"] == settings.challenge_ttl_seconds


def test_recognize_rejects_request_without_challenge():
    """POST /api/v1/recognize sem challenge_id deve retornar HTTP 403 quando enforce_capture_challenge=True."""
    client = TestClient(app, raise_server_exceptions=False)
    img_data = _dummy_image_bytes()

    with (
        patch.object(settings, "kiosk_api_key", "secret-kiosk-999"),
        patch.object(settings, "enforce_capture_challenge", True),
    ):
        res = client.post(
            "/api/v1/recognize",
            headers={"X-Kiosk-Key": "secret-kiosk-999"},
            files={"frame": ("cam.jpg", img_data, "image/jpeg")},
            data={"action": "check_in"},
        )
        assert res.status_code == 403
        assert "desafio de captura" in res.json().get("detail", "").lower()


def test_recognize_rejects_replayed_challenge():
    """POST /api/v1/recognize com challenge_id reutilizado deve falhar com HTTP 403 no segundo envio."""
    client = TestClient(app, raise_server_exceptions=False)
    img_data = _dummy_image_bytes()

    with (
        patch.object(settings, "kiosk_api_key", "secret-kiosk-999"),
        patch.object(settings, "enforce_capture_challenge", True),
        patch("app.routers.recognize.identify_frames", return_value={"recognized": False, "status": "no_face"}),
    ):
        # 1. Emite desafio legítimo
        ch_res = client.post(
            "/api/v1/recognize/challenge",
            headers={"X-Kiosk-Key": "secret-kiosk-999"},
        )
        challenge_id = ch_res.json()["challenge_id"]

        # 2. Primeira requisição: consome o desafio
        res1 = client.post(
            "/api/v1/recognize",
            headers={"X-Kiosk-Key": "secret-kiosk-999"},
            files={"frame": ("cam.jpg", img_data, "image/jpeg")},
            data={"action": "check_in", "challenge_id": challenge_id},
        )
        assert res1.status_code == 200

        # 3. Segunda requisição com o mesmo challenge_id: deve ser barrada por replay
        res2 = client.post(
            "/api/v1/recognize",
            headers={"X-Kiosk-Key": "secret-kiosk-999"},
            files={"frame": ("cam.jpg", img_data, "image/jpeg")},
            data={"action": "check_in", "challenge_id": challenge_id},
        )
        assert res2.status_code == 403
        assert "replay" in res2.json().get("detail", "").lower() or "já utilizado" in res2.json().get("detail", "").lower()


def test_recognize_accepts_when_challenge_enforcement_disabled():
    """Quando enforce_capture_challenge=False, requisição sem challenge_id deve ser processada normalmente."""
    client = TestClient(app, raise_server_exceptions=False)
    img_data = _dummy_image_bytes()

    with (
        patch.object(settings, "kiosk_api_key", "secret-kiosk-999"),
        patch.object(settings, "enforce_capture_challenge", False),
        patch("app.routers.recognize.identify_frames", return_value={"recognized": False, "status": "no_face"}),
    ):
        res = client.post(
            "/api/v1/recognize",
            headers={"X-Kiosk-Key": "secret-kiosk-999"},
            files={"frame": ("cam.jpg", img_data, "image/jpeg")},
            data={"action": "check_in"},
        )
        assert res.status_code == 200


def test_recognize_accepts_challenge_via_header_token():
    """Garante que o desafio pode ser fornecido via cabeçalho HTTP X-Challenge-Token."""
    from app.routers.recognize import clear_rate_limits_for_testing

    clear_rate_limits_for_testing()
    client = TestClient(app, raise_server_exceptions=False)
    img_data = _dummy_image_bytes()

    with (
        patch.object(settings, "kiosk_api_key", "secret-kiosk-999"),
        patch.object(settings, "enforce_capture_challenge", True),
        patch("app.routers.recognize.identify_frames", return_value={"recognized": True, "status": "ok"}),
    ):
        # 1. Obtém desafio
        ch_res = client.post("/api/v1/recognize/challenge", headers={"X-Kiosk-Key": "secret-kiosk-999"})
        challenge_id = ch_res.json()["challenge_id"]

        # 2. Envia via header X-Challenge-Token (sem challenge_id no form data)
        res = client.post(
            "/api/v1/recognize",
            headers={
                "X-Kiosk-Key": "secret-kiosk-999",
                "X-Challenge-Token": challenge_id,
            },
            files={"frame": ("cam.jpg", img_data, "image/jpeg")},
            data={"action": "check_in"},
        )
        assert res.status_code == 200
        assert res.json().get("recognized") is True


def test_recognize_rate_limiting_exceeded_returns_429():
    """Garante que requisições acima do limite configurado retornam HTTP 429 Too Many Requests."""
    from app.routers.recognize import clear_rate_limits_for_testing

    clear_rate_limits_for_testing()
    client = TestClient(app, raise_server_exceptions=False)
    img_data = _dummy_image_bytes()

    with (
        patch.object(settings, "kiosk_api_key", "secret-kiosk-999"),
        patch.object(settings, "enforce_capture_challenge", False),
        patch.object(settings, "rate_limit_per_minute", 3),
        patch("app.routers.recognize.identify_frames", return_value={"recognized": False, "status": "no_face"}),
    ):
        # 3 requisições permitidas
        for _ in range(3):
            r = client.post(
                "/api/v1/recognize",
                headers={"X-Kiosk-Key": "secret-kiosk-999"},
                files={"frame": ("cam.jpg", img_data, "image/jpeg")},
            )
            assert r.status_code == 200

        # A 4ª requisição deve estourar o limite (HTTP 429)
        r4 = client.post(
            "/api/v1/recognize",
            headers={"X-Kiosk-Key": "secret-kiosk-999"},
            files={"frame": ("cam.jpg", img_data, "image/jpeg")},
        )
        assert r4.status_code == 429
        assert "muitas requisições" in r4.json().get("detail", "").lower()

