"""Testes unitários de Segurança e LGPD: autenticação fail-closed, timing-safe e direitos do titular."""
from __future__ import annotations

from unittest.mock import MagicMock, patch
from fastapi import HTTPException
import pytest

from app.config import settings
from app.deps import verify_api_key, verify_cron_or_api_key, verify_kiosk_key, verify_tutor_token
from app.routers.profiles import delete_profile, get_profile, refresh_embedding_route, revoke_consent
from app.services.enroll_service import EnrollError, ProfileNotFound


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


# ── Testes de Separação de Privilégios (P0) ───────────────────────────────────


def test_verify_kiosk_key_accepts_valid_kiosk_key():
    """Chave de kiosk válida deve ser aceita em verify_kiosk_key."""
    with patch.object(settings, "kiosk_api_key", "kiosk-secret-xyz"):
        # Não deve levantar exceção
        verify_kiosk_key(kiosk_key="kiosk-secret-xyz", legacy_key=None)


def test_verify_kiosk_key_accepts_legacy_api_key_as_fallback():
    """Durante a transição, X-API-Key legada deve ser aceita em verify_kiosk_key."""
    with (
        patch.object(settings, "kiosk_api_key", ""),  # kiosk_api_key não configurada
        patch.object(settings, "api_key", "legacy-api-key"),
    ):
        verify_kiosk_key(kiosk_key=None, legacy_key="legacy-api-key")


def test_verify_kiosk_key_rejects_when_no_keys_configured():
    """Fail-closed: se nenhuma chave estiver configurada, deve retornar HTTP 500."""
    with (
        patch.object(settings, "kiosk_api_key", ""),
        patch.object(settings, "api_key", ""),
    ):
        with pytest.raises(HTTPException) as exc:
            verify_kiosk_key(kiosk_key="any-key", legacy_key=None)
        assert exc.value.status_code == 500


def test_verify_kiosk_key_rejects_wrong_key():
    """Chave de kiosk incorreta deve retornar HTTP 401."""
    with patch.object(settings, "kiosk_api_key", "correct-kiosk-key"):
        with pytest.raises(HTTPException) as exc:
            verify_kiosk_key(kiosk_key="wrong-key", legacy_key=None)
        assert exc.value.status_code == 401


def test_verify_tutor_token_rejects_missing_authorization():
    """Token ausente deve retornar HTTP 401."""
    with pytest.raises(HTTPException) as exc:
        verify_tutor_token(authorization=None)
    assert exc.value.status_code == 401


def test_verify_tutor_token_rejects_non_bearer():
    """Header sem 'Bearer ' prefix deve retornar HTTP 401."""
    with pytest.raises(HTTPException) as exc:
        verify_tutor_token(authorization="Token abc123")
    assert exc.value.status_code == 401


def test_verify_tutor_token_rejects_user_without_tutor_role():
    """Usuário autenticado sem role=tutor em app_metadata deve receber HTTP 403."""
    mock_user = MagicMock()
    mock_user.id = "user-uuid"
    mock_user.email = "aluno@lab.com"
    mock_user.app_metadata = {"role": "member"}  # não é tutor

    mock_response = MagicMock()
    mock_response.user = mock_user

    mock_client = MagicMock()
    mock_client.auth.get_user.return_value = mock_response

    with patch("app.db.supabase_client.get_client", return_value=mock_client):
        with pytest.raises(HTTPException) as exc:
            verify_tutor_token(authorization="Bearer valid.jwt.token")
        assert exc.value.status_code == 403


def test_verify_tutor_token_accepts_tutor_role():
    """Usuário com role=tutor deve ser aceito e retornar claims com user_id."""
    mock_user = MagicMock()
    mock_user.id = "tutor-uuid"
    mock_user.email = "professor@lab.com"
    mock_user.app_metadata = {"role": "tutor"}

    mock_response = MagicMock()
    mock_response.user = mock_user

    mock_client = MagicMock()
    mock_client.auth.get_user.return_value = mock_response

    with patch("app.db.supabase_client.get_client", return_value=mock_client):
        claims = verify_tutor_token(authorization="Bearer valid.jwt.token")
        assert claims["user_id"] == "tutor-uuid"
        assert claims["role"] == "tutor"
        assert claims["email"] == "professor@lab.com"


def test_verify_cron_fails_closed_when_service_url_empty():
    """Fail-closed: OIDC sem SERVICE_URL configurada deve retornar HTTP 500."""
    with (
        patch.object(settings, "api_key", ""),  # sem API key
        patch.object(settings, "service_url", ""),  # sem audiência OIDC
    ):
        with pytest.raises(HTTPException) as exc:
            verify_cron_or_api_key(api_key=None, authorization="Bearer any.token.here")
        assert exc.value.status_code == 500


# ── Testes de Integração de Rota (TestClient) ────────────────────────────────


def test_enroll_endpoint_rejects_kiosk_key():
    """Requisição POST /enroll portando apenas X-Kiosk-Key deve ser rejeitada com HTTP 401."""
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app, raise_server_exceptions=False)
    with patch.object(settings, "kiosk_api_key", "valid-kiosk-token-123"):
        res = client.post(
            "/api/v1/enroll",
            headers={"X-Kiosk-Key": "valid-kiosk-token-123"},
            data={"name": "Aluno Teste", "matricula": "123456789", "consent": "true"},
        )
        assert res.status_code == 401
        assert "tutor" in res.json().get("detail", "").lower()


def test_cors_fail_closed_when_empty():
    """Quando cors_origins está vazio, preflight OPTIONS não deve conter allow-origin: *."""
    from fastapi.testclient import TestClient
    from app.main import app

    with patch.object(settings, "cors_origins", ""):
        client = TestClient(app)
        res = client.options(
            "/api/v1/recognize",
            headers={
                "Origin": "https://evil.com",
                "Access-Control-Request-Method": "POST",
            },
        )
        allow_origin = res.headers.get("access-control-allow-origin")
        assert allow_origin != "*", "CORS não pode permitir wildcard * quando cors_origins estiver vazia"
        assert allow_origin != "https://evil.com"


def test_oidc_cleanup_does_not_leak_exception_details():
    """Falha de validação OIDC não deve vazar tracebacks ou mensagens cruas de exceção no detail."""
    import sys
    from types import ModuleType
    from fastapi.testclient import TestClient
    from app.main import app

    mock_id_token = MagicMock()
    mock_id_token.verify_oauth2_token.side_effect = ValueError("CRITICAL_INTERNAL_CRYPTO_TRACE_LEAK")
    mock_requests = MagicMock()
    mock_requests.Request.return_value = MagicMock()

    google_mod = ModuleType("google")
    google_oauth2_mod = ModuleType("google.oauth2")
    google_oauth2_mod.id_token = mock_id_token
    google_auth_mod = ModuleType("google.auth")
    google_auth_transport_mod = ModuleType("google.auth.transport")
    google_auth_transport_mod.requests = mock_requests
    google_mod.oauth2 = google_oauth2_mod
    google_mod.auth = google_auth_mod
    google_auth_mod.transport = google_auth_transport_mod

    modules_backup = {}
    for key in ("google", "google.oauth2", "google.oauth2.id_token",
                "google.auth", "google.auth.transport", "google.auth.transport.requests"):
        modules_backup[key] = sys.modules.get(key)

    sys.modules["google"] = google_mod
    sys.modules["google.oauth2"] = google_oauth2_mod
    sys.modules["google.oauth2.id_token"] = mock_id_token
    sys.modules["google.auth"] = google_auth_mod
    sys.modules["google.auth.transport"] = google_auth_transport_mod
    sys.modules["google.auth.transport.requests"] = mock_requests

    try:
        client = TestClient(app, raise_server_exceptions=False)
        with (
            patch.object(settings, "service_url", "https://ailab.run.app"),
            patch.object(settings, "api_key", "secret-key"),
        ):
            res = client.post(
                "/api/v1/maintenance/cleanup",
                headers={"Authorization": "Bearer bad.token.here"},
            )
            assert res.status_code == 401
            detail = res.json().get("detail", "")
            assert "CRITICAL_INTERNAL_CRYPTO_TRACE_LEAK" not in detail
            assert "ValueError" not in detail
            assert detail == "Token OIDC inválido ou assinatura não verificada."
    finally:
        for key, val in modules_backup.items():
            if val is None:
                sys.modules.pop(key, None)
            else:
                sys.modules[key] = val


# ── Testes de Defesa em Profundidade: Mídia & Kiosk Auth ──────────────────────


def test_validate_image_decompression_bomb_rejection():
    """Garante que imagens com dimensões anômalas (> 4096px) sejam rejeitadas para evitar OOM."""
    import io
    from PIL import Image
    from app.deps import validate_image

    # Imagem válida normal (100x100)
    buf = io.BytesIO()
    Image.new("RGB", (100, 100)).save(buf, format="JPEG")
    valid_bytes = buf.getvalue()
    validate_image("image/jpeg", len(valid_bytes), valid_bytes)

    # Imagem perigosa com dimensões excessivas (5000x100)
    buf_huge = io.BytesIO()
    Image.new("RGB", (5000, 100)).save(buf_huge, format="JPEG")
    huge_bytes = buf_huge.getvalue()
    with pytest.raises(HTTPException) as exc_info:
        validate_image("image/jpeg", len(huge_bytes), huge_bytes)
    assert exc_info.value.status_code == 400
    assert "excedem o limite operacional" in exc_info.value.detail


def test_session_stats_accepts_kiosk_key():
    """Garante que /api/v1/sessions/stats/{profile_id} aceita X-Kiosk-Key do tablet."""
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app, raise_server_exceptions=False)
    with (
        patch.object(settings, "kiosk_api_key", "kiosk-secret-key-123"),
        patch("app.routers.recognize.total_hours", return_value={"hours": 12.5}),
    ):
        # Com X-Kiosk-Key válida
        res = client.get(
            "/api/v1/sessions/stats/some-uuid",
            headers={"X-Kiosk-Key": "kiosk-secret-key-123"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["profile_id"] == "some-uuid"
        assert data["total_hours"] == {"hours": 12.5}

        # Sem chave de autenticação deve falhar com 401
        res_no_key = client.get("/api/v1/sessions/stats/some-uuid")
        assert res_no_key.status_code == 401


def test_validate_image_magic_bytes_enforcement():
    """Garante rejeição de arquivos com magic bytes ausentes, corrompidos ou em conflito com Content-Type."""
    from app.deps import validate_image

    # 1. Arquivo com bytes aleatórios (sem magic bytes válidos) deve ser rejeitado com 400
    fake_bytes = b"NOT_AN_IMAGE_RANDOM_DATA_12345678"
    with pytest.raises(HTTPException) as exc_info:
        validate_image("image/jpeg", len(fake_bytes), fake_bytes)
    assert exc_info.value.status_code == 400
    assert "magic bytes" in exc_info.value.detail.lower()

    # 2. Arquivo PNG enviado com Content-Type JPEG deve ser rejeitado com 400
    png_header = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"
    with pytest.raises(HTTPException) as exc_info:
        validate_image("image/jpeg", len(png_header), png_header)
    assert exc_info.value.status_code == 400
    assert "conflito" in exc_info.value.detail.lower()


# ── Testes de Renovação Biométrica (Refresh Embedding) ─────────────────────────


@pytest.mark.anyio
async def test_refresh_embedding_route_rejects_less_than_3_frames():
    """Deve rejeitar com HTTP 400 se menos de 3 fotos forem enviadas."""
    from starlette.datastructures import UploadFile
    from io import BytesIO

    frames = [
        UploadFile(filename="f1.jpg", file=BytesIO(b"data1")),
        UploadFile(filename="f2.jpg", file=BytesIO(b"data2")),
    ]
    with pytest.raises(HTTPException) as exc:
        await refresh_embedding_route(profile_id="uuid-1", frames=frames)
    assert exc.value.status_code == 400
    assert "ao menos 3 fotos" in exc.value.detail


@pytest.mark.anyio
async def test_refresh_embedding_route_rejects_excess_frames():
    """Deve rejeitar com HTTP 400 se mais fotos que max_enroll_frames forem enviadas."""
    from starlette.datastructures import UploadFile
    from io import BytesIO

    frames = [
        UploadFile(filename=f"f{i}.jpg", file=BytesIO(b"data"))
        for i in range(settings.max_enroll_frames + 1)
    ]
    with pytest.raises(HTTPException) as exc:
        await refresh_embedding_route(profile_id="uuid-1", frames=frames)
    assert exc.value.status_code == 400
    assert "Excesso de fotos" in exc.value.detail


@pytest.mark.anyio
async def test_refresh_embedding_route_profile_not_found():
    """ProfileNotFound no serviço deve retornar HTTP 404."""
    from starlette.datastructures import UploadFile
    from io import BytesIO

    frames = [
        UploadFile(filename=f"f{i}.jpg", file=BytesIO(b"\xff\xd8\xff\xe0" + b"\x00" * 30), headers={"content-type": "image/jpeg"})
        for i in range(3)
    ]
    with (
        patch("app.routers.profiles.validate_image"),
        patch("app.routers.profiles.refresh_embedding", side_effect=ProfileNotFound("uuid-999")),
    ):
        with pytest.raises(HTTPException) as exc:
            await refresh_embedding_route(profile_id="uuid-999", frames=frames)
        assert exc.value.status_code == 404
        assert "Perfil não encontrado" in exc.value.detail


@pytest.mark.anyio
async def test_refresh_embedding_route_enroll_error():
    """EnrollError no serviço (ex: inconsistência ou troca de identidade) deve retornar HTTP 422."""
    from starlette.datastructures import UploadFile
    from io import BytesIO

    frames = [
        UploadFile(filename=f"f{i}.jpg", file=BytesIO(b"\xff\xd8\xff\xe0" + b"\x00" * 30), headers={"content-type": "image/jpeg"})
        for i in range(3)
    ]
    with (
        patch("app.routers.profiles.validate_image"),
        patch("app.routers.profiles.refresh_embedding", side_effect=EnrollError("Inconsistência intra-burst")),
    ):
        with pytest.raises(HTTPException) as exc:
            await refresh_embedding_route(profile_id="uuid-1", frames=frames)
        assert exc.value.status_code == 422
        assert "Inconsistência intra-burst" in exc.value.detail


@pytest.mark.anyio
async def test_refresh_embedding_route_success():
    """Atualização biométrica bem-sucedida deve retornar dados do perfil e contagem de fotos."""
    from starlette.datastructures import UploadFile
    from io import BytesIO

    frames = [
        UploadFile(filename=f"f{i}.jpg", file=BytesIO(b"\xff\xd8\xff\xe0" + b"\x00" * 30), headers={"content-type": "image/jpeg"})
        for i in range(3)
    ]
    expected_result = {"profile_id": "uuid-1", "name": "Aluno Teste", "photos_used": 3}
    with (
        patch("app.routers.profiles.validate_image"),
        patch("app.routers.profiles.refresh_embedding", return_value=expected_result),
    ):
        res = await refresh_embedding_route(profile_id="uuid-1", frames=frames)
        assert res == expected_result




