"""Testes de contrato de API (Fase 2) para garantir conformidade estrita entre Backend e Clientes (Tablet/Web)."""
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.routers.contracts import (
    ChallengeResponse,
    EventDetail,
    RecognizeResponse,
    EnrollResponse,
    RevokeConsentResponse,
)


@pytest.fixture
def client():
    return TestClient(app)


def test_openapi_schema_contains_all_contracts(client):
    """Garante que a documentação OpenAPI gerada pelo FastAPI expõe formalmente os schemas de contrato."""
    response = client.get("/openapi.json")
    assert response.status_code == 200
    schema = response.json()

    assert "components" in schema
    assert "schemas" in schema["components"]
    schemas = schema["components"]["schemas"]

    # Verifica se os schemas centrais estão publicados no OpenAPI
    assert "ChallengeResponse" in schemas, "ChallengeResponse deve estar publicado no OpenAPI"
    assert "RecognizeResponse" in schemas, "RecognizeResponse deve estar publicado no OpenAPI"
    assert "EnrollResponse" in schemas, "EnrollResponse deve estar publicado no OpenAPI"
    assert "RevokeConsentResponse" in schemas, "RevokeConsentResponse deve estar publicado no OpenAPI"
    assert "EventDetail" in schemas, "EventDetail deve estar publicado no OpenAPI"


def test_challenge_response_contract_matches_tablet_expectations():
    """Valida o contrato de desafio temporal (usado pelo hook useRecognize no Tablet)."""
    payload = {
        "challenge_id": "chal_1234567890abcdef",
        "expires_at": 1757960000,
        "ttl_seconds": 60,
    }
    model = ChallengeResponse(**payload)
    assert model.challenge_id == "chal_1234567890abcdef"
    assert model.expires_at == 1757960000
    assert model.ttl_seconds == 60

    # Quebra de contrato: omissão de challenge_id deve falhar
    with pytest.raises(Exception):
        ChallengeResponse(expires_at=1757960000, ttl_seconds=60)


def test_recognize_response_contract_check_in_and_check_out():
    """Valida o contrato da resposta de reconhecimento para eventos de check_in e check_out."""
    payload_check_in = {
        "recognized": True,
        "profile_id": "00000000-0000-0000-0000-000000000001",
        "name": "Aluno Exemplo",
        "confidence": 0.94,
        "distance": 0.22,
        "cosine_similarity": 0.88,
        "event": {
            "action": "check_in",
            "session_id": 42,
            "timestamp": "2026-09-15T14:30:00Z",
        },
    }
    model = RecognizeResponse(**payload_check_in)
    assert model.recognized is True
    assert model.event.action == "check_in"
    assert model.event.session_id == 42

    payload_check_out = {
        "recognized": True,
        "profile_id": "00000000-0000-0000-0000-000000000001",
        "name": "Aluno Exemplo",
        "event": {
            "action": "check_out",
            "profile_id": "00000000-0000-0000-0000-000000000001",
            "session_id": 42,
            "duration_minutes": 12.5,
        },
    }
    model_out = RecognizeResponse(**payload_check_out)
    assert model_out.event.action == "check_out"
    assert model_out.event.duration_minutes == 12.5
    assert model_out.event.profile_id == "00000000-0000-0000-0000-000000000001"


def test_recognize_response_contract_debounced_and_unrecognized():
    """Valida o contrato para status de debounce temporal e rosto não reconhecido."""
    debounced_payload = {
        "recognized": True,
        "event": {
            "action": "debounced",
            "wait_seconds": 45,
        },
    }
    model_debounced = RecognizeResponse(**debounced_payload)
    assert model_debounced.event.action == "debounced"
    assert model_debounced.event.wait_seconds == 45

    unrecognized_payload = {
        "recognized": False,
        "status": "not_recognized",
        "message": "Rosto não reconhecido na base.",
    }
    model_unrecognized = RecognizeResponse(**unrecognized_payload)
    assert model_unrecognized.recognized is False
    assert model_unrecognized.status == "not_recognized"


def test_enroll_response_contract():
    """Valida o contrato retornado após cadastro ou recadastro biométrico."""
    payload = {
        "profile_id": "00000000-0000-0000-0000-000000000002",
        "name": "Maria Silva",
        "photos_used": 3,
    }
    model = EnrollResponse(**payload)
    assert model.profile_id == "00000000-0000-0000-0000-000000000002"
    assert model.name == "Maria Silva"
    assert model.photos_used == 3

    # Quebra de contrato: fotos_used faltando deve falhar
    with pytest.raises(Exception):
        EnrollResponse(profile_id="uuid", name="Maria")


def test_event_detail_fractional_duration_and_extra_fields():
    """Garante que EventDetail aceita durações fracionárias (float) e ignora campos extras com segurança."""
    event = EventDetail(
        action="check_out",
        profile_id="00000000-0000-0000-0000-000000000001",
        session_id=99,
        duration_minutes=0.3,
        unanticipated_extra_field="tolerated",
    )
    assert event.action == "check_out"
    assert event.duration_minutes == 0.3
    assert event.session_id == 99

    # Zero minutos (saída quase imediata)
    event_zero = EventDetail(action="check_out", duration_minutes=0.0)
    assert event_zero.duration_minutes == 0.0

    # Minutos normais (ex: 45.7 min)
    event_normal = EventDetail(action="check_out", duration_minutes=45.7)
    assert event_normal.duration_minutes == 45.7


def test_revoke_consent_contract_resilience():
    """Valida que RevokeConsentResponse aceita tanto payloads com quanto sem 'name'."""
    payload_full = {
        "revoked": True,
        "profile_id": "00000000-0000-0000-0000-000000000003",
        "name": "João Santos",
        "revoked_at": "2026-09-15T15:00:00Z",
        "message": "Consentimento revogado.",
    }
    m1 = RevokeConsentResponse(**payload_full)
    assert m1.revoked is True
    assert m1.name == "João Santos"

    payload_minimal = {
        "revoked": True,
        "profile_id": "00000000-0000-0000-0000-000000000003",
        "message": "Consentimento revogado.",
    }
    m2 = RevokeConsentResponse(**payload_minimal)
    assert m2.revoked is True
    assert m2.name is None


def test_recognize_checkout_response_serialization_with_float_duration():
    """Garante que o modelo de resposta do FastAPI serializa checkout com float sem erro 500."""
    from unittest.mock import patch, MagicMock
    from fastapi.testclient import TestClient
    from app.main import app
    from app.config import settings

    client = TestClient(app, raise_server_exceptions=True)

    # Simula inferência com sucesso
    fake_ident = {
        "recognized": True,
        "status": "ok",
        "profile_id": "00000000-0000-0000-0000-000000000001",
        "name": "Aluno Checkout Teste",
        "confidence": 0.96,
        "distance": 0.18,
        "cosine_similarity": 0.91,
    }
    # Simula evento de checkout retornando duration_minutes fracionário (ex: 15.4 min)
    fake_event = {
        "action": "check_out",
        "profile_id": "00000000-0000-0000-0000-000000000001",
        "session_id": 501,
        "timestamp": "2026-09-15T19:00:00Z",
        "duration_minutes": 15.4,
    }

    from io import BytesIO
    from PIL import Image

    buf = BytesIO()
    Image.new("RGB", (100, 100)).save(buf, format="JPEG")
    valid_jpeg = buf.getvalue()

    mock_db = MagicMock()

    with (
        patch.object(settings, "kiosk_api_key", "test-secret-kiosk"),
        patch("app.routers.recognize.identify_frames", return_value=fake_ident),
        patch("app.routers.recognize.register_event", return_value=fake_event),
        patch("app.routers.recognize.get_client", return_value=mock_db),
        patch("app.routers.recognize.verify_and_consume_challenge", return_value=(True, "ok")),
    ):
        # Envia requisição simulando o Tablet Kiosk clicando em "Saída"
        res = client.post(
            "/api/v1/recognize",
            headers={"X-Kiosk-Key": "test-secret-kiosk"},
            data={"action": "check_out", "challenge_id": "test_chal_123"},
            files={"frame": ("frame.jpg", valid_jpeg, "image/jpeg")},
        )

        assert res.status_code == 200, f"Checkout falhou com status {res.status_code}: {res.text}"
        data = res.json()
        assert data["recognized"] is True
        assert data["event"]["action"] == "check_out"
        assert data["event"]["duration_minutes"] == 15.4
        assert data["name"] == "Aluno Checkout Teste"
