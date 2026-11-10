"""Testes unitários de Segurança e LGPD: autenticação fail-closed, timing-safe e direitos do titular."""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from app.config import settings
from app.deps import (
    clear_identity_cache_for_testing,
    verify_admin_or_scheduler,
    verify_kiosk_identity,
    verify_tutor_token,
)
from app.routers.profiles import (
    delete_profile,
    get_profile,
    refresh_embedding_route,
    revoke_consent,
)
from app.services.enroll_service import EnrollError, ProfileNotFound

# ── Testes de Autenticação Segura, Fail-Closed & Identidade Real ──────────────


def _make_user(user_id="user-123", email="user@lab.com", role="tutor", banned_until=None, is_anonymous=False, in_user_meta=False):
    from types import SimpleNamespace
    app_meta = {} if in_user_meta else ({"role": role} if role else {})
    user_meta = ({"role": role} if (in_user_meta and role) else {})
    return SimpleNamespace(
        id=user_id,
        email=email,
        app_metadata=app_meta,
        user_metadata=user_meta,
        banned_until=banned_until,
        is_anonymous=is_anonymous,
    )


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


def test_verify_tutor_token_rejects_user_metadata_role():
    """Defesa contra elevação: role em user_metadata JAMAIS autoriza tutor (HTTP 403)."""
    fake_user = _make_user(role="tutor", in_user_meta=True)
    with patch("app.deps._fetch_user", return_value=fake_user):
        with pytest.raises(HTTPException) as exc:
            verify_tutor_token(authorization="Bearer jwt.with.user_meta.only")
        assert exc.value.status_code == 403
        assert "tutor" in exc.value.detail.lower()


def test_verify_tutor_token_rejects_banned_user():
    """Usuário com conta banida/bloqueada deve ser rejeitado com HTTP 403."""
    from datetime import datetime, timedelta, timezone
    future_ban = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()
    fake_user = _make_user(role="tutor", banned_until=future_ban)
    with patch("app.deps._fetch_user", return_value=fake_user):
        with pytest.raises(HTTPException) as exc:
            verify_tutor_token(authorization="Bearer valid.jwt")
        assert exc.value.status_code == 403


def test_verify_tutor_token_accepts_valid_tutor():
    """Tutor com role em app_metadata é aceito e retorna claims com user_id."""
    fake_user = _make_user(user_id="prof-1", email="prof@ailab.org", role="tutor")
    with patch("app.deps._fetch_user", return_value=fake_user):
        claims = verify_tutor_token(authorization="Bearer valid.tutor.jwt")
        assert claims["user_id"] == "prof-1"
        assert claims["role"] == "tutor"
        assert claims["email"] == "prof@ailab.org"


def test_verify_kiosk_identity_accepts_kiosk_and_caches():
    """Kiosk com role em app_metadata é aceito e armazena em cache curto de validação."""
    clear_identity_cache_for_testing()
    fake_kiosk = _make_user(user_id="kiosk-dev-1", email="tablet@kiosk.ailab.invalid", role="kiosk")
    with patch("app.deps._fetch_user", return_value=fake_kiosk) as mock_fetch:
        claims1 = verify_kiosk_identity(authorization="Bearer token.kiosk.123")
        assert claims1["user_id"] == "kiosk-dev-1"
        assert claims1["role"] == "kiosk"

        # Segunda chamada com o mesmo token não deve consultar Supabase Auth novamente
        claims2 = verify_kiosk_identity(authorization="Bearer token.kiosk.123")
        assert claims2["user_id"] == "kiosk-dev-1"
        assert mock_fetch.call_count == 1


def test_verify_kiosk_identity_rejects_non_kiosk_role():
    """Tutor ou outro usuário sem role=kiosk deve receber HTTP 403 em rotas exclusivas de kiosk."""
    clear_identity_cache_for_testing()
    fake_tutor = _make_user(role="tutor")
    with patch("app.deps._fetch_user", return_value=fake_tutor):
        with pytest.raises(HTTPException) as exc:
            verify_kiosk_identity(authorization="Bearer token.tutor.123")
        assert exc.value.status_code == 403


def test_shared_keys_rejected_everywhere():
    """Chaves compartilhadas legadas (X-API-Key, X-Kiosk-Key) são sumariamente rejeitadas."""
    with pytest.raises(HTTPException) as exc1:
        verify_tutor_token(authorization=None)
    assert exc1.value.status_code == 401

    with pytest.raises(HTTPException) as exc2:
        verify_kiosk_identity(authorization=None)
    assert exc2.value.status_code == 401


# ── Testes dos Endpoints de Direitos do Titular LGPD (RPCs Atômicas) ─────────


def test_get_profile_not_found():
    """Perfil inexistente deve retornar HTTP 404."""
    mock_db = MagicMock()
    mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []

    with patch("app.routers.profiles.get_client", return_value=mock_db):
        with pytest.raises(HTTPException) as exc_info:
            get_profile("non-existent-uuid")
        assert exc_info.value.status_code == 404


def test_revoke_consent_success():
    """Revogação de consentimento executa RPC revoke_profile_consent atômica."""
    mock_db = MagicMock()
    mock_db.rpc.return_value.execute.return_value.data = {
        "found": True,
        "name": "Maria Silva",
        "revoked_at": "2026-11-10T10:00:00Z",
        "embeddings_deleted": 1,
    }

    with (
        patch("app.routers.profiles.get_client", return_value=mock_db),
        patch("app.routers.profiles.invalidate_embeddings_cache") as mock_invalidate,
    ):
        res = revoke_consent("uuid-123", tutor={"user_id": "tutor-uuid"})

        assert res["revoked"] is True
        assert res["profile_id"] == "uuid-123"
        assert "revogado" in res["message"].lower()
        mock_db.rpc.assert_called_with("revoke_profile_consent", {
            "p_profile_id": "uuid-123",
            "p_actor": "tutor-uuid",
        })
        assert mock_invalidate.called


def test_delete_profile_success():
    """Eliminação definitiva executa RPC delete_profile_cascade atômica."""
    mock_db = MagicMock()
    mock_db.rpc.return_value.execute.return_value.data = {
        "found": True,
        "deleted": True,
        "sessions": 5,
        "face_logs": 5,
        "embeddings": 1,
    }

    with (
        patch("app.routers.profiles.get_client", return_value=mock_db),
        patch("app.routers.profiles.invalidate_embeddings_cache") as mock_invalidate,
    ):
        res = delete_profile("uuid-456", tutor={"user_id": "tutor-uuid"})

        assert res["deleted"] is True
        assert res["profile_id"] == "uuid-456"
        mock_db.rpc.assert_called_with("delete_profile_cascade", {
            "p_profile_id": "uuid-456",
            "p_actor": "tutor-uuid",
        })
        assert mock_invalidate.called


def test_delete_profile_conflict_when_has_justifications():
    """Recusa (HTTP 409) exclusão quando perfil possui justificativas ativas de frequência."""
    mock_db = MagicMock()
    mock_db.rpc.return_value.execute.return_value.data = {
        "found": True,
        "deleted": False,
        "reason": "has_justifications",
    }

    with patch("app.routers.profiles.get_client", return_value=mock_db):
        with pytest.raises(HTTPException) as exc:
            delete_profile("uuid-456", tutor={"user_id": "tutor-uuid"})
        assert exc.value.status_code == 409
        assert "justificativas" in exc.value.detail.lower()


def test_verify_cron_fails_closed_when_service_url_empty():
    """Fail-closed: OIDC sem SERVICE_URL configurada deve retornar HTTP 500."""
    with (
        patch.object(settings, "admin_api_key", ""),
        patch.object(settings, "service_url", ""),
    ):
        with pytest.raises(HTTPException) as exc:
            verify_admin_or_scheduler(admin_key=None, authorization="Bearer any.token.here")
        assert exc.value.status_code == 500


# ── Testes de Integração de Rota (TestClient) ────────────────────────────────


def test_enroll_endpoint_rejects_kiosk_identity_or_missing_auth():
    """Requisição POST /enroll portando identidade de Kiosk deve ser rejeitada com HTTP 403."""
    from fastapi.testclient import TestClient

    from app.main import app

    client = TestClient(app, raise_server_exceptions=False)
    fake_kiosk = _make_user(role="kiosk")
    with patch("app.deps._fetch_user", return_value=fake_kiosk):
        res = client.post(
            "/api/v1/enroll",
            headers={"Authorization": "Bearer valid.kiosk.jwt"},
            data={"name": "Aluno Teste", "matricula": "123456789", "consent": "true"},
        )
        assert res.status_code == 403
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
            patch.object(settings, "cloud_scheduler_sa_email", "ailab-scheduler@gserviceaccount.com"),
            patch.object(settings, "admin_api_key", "secret-key"),
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


def test_session_stats_accepts_kiosk_identity_and_rejects_kiosk_key():
    """Garante que /api/v1/sessions/stats/{profile_id} aceita JWT de Kiosk e rejeita X-Kiosk-Key."""
    from fastapi.testclient import TestClient

    from app.main import app

    client = TestClient(app, raise_server_exceptions=False)
    fake_kiosk = _make_user(role="kiosk")
    with (
        patch("app.deps._fetch_user", return_value=fake_kiosk),
        patch("app.routers.recognize.total_hours", return_value=12.5),
    ):
        # Com JWT de Kiosk válido
        res = client.get(
            "/api/v1/sessions/stats/some-uuid",
            headers={"Authorization": "Bearer valid.kiosk.jwt"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["profile_id"] == "some-uuid"
        assert data["total_hours"] == 12.5

        # Com chave legada X-Kiosk-Key deve falhar com 401
        res_legacy = client.get(
            "/api/v1/sessions/stats/some-uuid",
            headers={"X-Kiosk-Key": "kiosk-secret-key-123"},
        )
        assert res_legacy.status_code == 401


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
    from io import BytesIO

    from starlette.datastructures import UploadFile

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
    from io import BytesIO

    from starlette.datastructures import UploadFile

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
    from io import BytesIO

    from starlette.datastructures import UploadFile

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
    from io import BytesIO

    from starlette.datastructures import UploadFile

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
    from io import BytesIO

    from starlette.datastructures import UploadFile

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






# ── Testes da Guarda de Upload ASGI (UploadGuardMiddleware) ───────────────────


def test_upload_guard_rejects_multipart_without_bearer():
    """UploadGuardMiddleware rejeita multipart sem cabeçalho Authorization: Bearer."""
    from fastapi.testclient import TestClient

    from app.main import app

    client = TestClient(app, raise_server_exceptions=False)
    # POST com multipart sem Authorization
    res = client.post(
        "/api/v1/recognize",
        files={"frame": ("cam.jpg", b"fake", "image/jpeg")},
    )
    assert res.status_code == 401
    assert "credencial ausente" in res.json().get("detail", "").lower()


def test_upload_guard_rejects_oversized_content_length():
    """UploadGuardMiddleware rejeita requisições cujo Content-Length excede o limite (HTTP 413)."""
    from fastapi.testclient import TestClient

    from app.main import app

    client = TestClient(app, raise_server_exceptions=False)
    fake_kiosk = _make_user(role="kiosk")
    with patch("app.deps._fetch_user", return_value=fake_kiosk):
        res = client.post(
            "/api/v1/recognize",
            headers={
                "Authorization": "Bearer valid.kiosk.jwt",
                "Content-Length": str(settings.max_upload_bytes + 1024),
                "Content-Type": "multipart/form-data; boundary=boundary",
            },
            content=b"--boundary--",
        )
        assert res.status_code == 413
        assert "excede o limite" in res.json().get("detail", "").lower()
