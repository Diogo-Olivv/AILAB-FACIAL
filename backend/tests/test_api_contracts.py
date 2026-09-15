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
            "session_id": 42,
            "duration_minutes": 180,
        },
    }
    model_out = RecognizeResponse(**payload_check_out)
    assert model_out.event.action == "check_out"
    assert model_out.event.duration_minutes == 180


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
