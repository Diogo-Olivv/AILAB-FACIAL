"""Provisionamento de kiosk, ordem autenticação → upload e sonda de prontidão."""
from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.deps import clear_identity_cache_for_testing
from app.main import app
from app.routers.health import reset_readiness_cache_for_testing
from app.routers.recognize import clear_rate_limits_for_testing

def _real_jpeg() -> bytes:
    import io

    from PIL import Image

    buffer = io.BytesIO()
    Image.new("RGB", (32, 32), (120, 90, 60)).save(buffer, format="JPEG")
    return buffer.getvalue()


MIN_JPG = _real_jpeg()
KIOSK_UUID = "11111111-2222-4333-8444-555555555555"


def _user(role: str | None, user_id: str = "user-1", **extra):
    return SimpleNamespace(
        id=user_id,
        email=f"{user_id}@example.test",
        app_metadata={"role": role} if role else {},
        user_metadata=extra.pop("user_metadata", {}),
        banned_until=extra.pop("banned_until", None),
        is_anonymous=False,
        **extra,
    )


@pytest.fixture(autouse=True)
def _reset_state():
    clear_identity_cache_for_testing()
    clear_rate_limits_for_testing()
    reset_readiness_cache_for_testing()
    yield
    clear_identity_cache_for_testing()
    clear_rate_limits_for_testing()


@pytest.fixture()
def client():
    return TestClient(app, raise_server_exceptions=False)


def _frames(n: int = 3):
    return [("frames", (f"f{i}.jpg", MIN_JPG, "image/jpeg")) for i in range(n)]


# ── Provisionamento de kiosk ──────────────────────────────────────────────────


def test_provision_requires_tutor(client):
    assert client.post("/api/v1/kiosks", json={"label": "Totem"}).status_code == 401

    for role in ("kiosk", None):
        clear_identity_cache_for_testing()
        with patch("app.deps._fetch_user", return_value=_user(role)):
            res = client.post("/api/v1/kiosks", json={"label": "Totem"}, headers={"Authorization": "Bearer x"})
        assert res.status_code == 403, role


def test_provision_does_not_trust_user_metadata(client):
    spoof = _user(None, user_metadata={"role": "tutor"})
    with patch("app.deps._fetch_user", return_value=spoof):
        res = client.post("/api/v1/kiosks", json={"label": "Totem"}, headers={"Authorization": "Bearer x"})
    assert res.status_code == 403


def test_provision_creates_kiosk_account_and_returns_credential_once(client):
    fake_client = MagicMock()
    fake_client.auth.admin.create_user.return_value = SimpleNamespace(user=SimpleNamespace(id=KIOSK_UUID))

    with (
        patch("app.deps._fetch_user", return_value=_user("tutor", "tutor-9")),
        patch("app.routers.kiosks.get_client", return_value=fake_client),
    ):
        res = client.post("/api/v1/kiosks", json={"label": "Totem da entrada"}, headers={"Authorization": "Bearer t"})

    assert res.status_code == 201
    body = res.json()
    assert body["kiosk_id"] == KIOSK_UUID and body["label"] == "Totem da entrada"
    assert body["email"].endswith("@" + settings.kiosk_email_domain)
    assert len(body["password"]) >= 40

    attrs = fake_client.auth.admin.create_user.call_args.args[0]
    assert attrs["app_metadata"] == {"role": "kiosk", "label": "Totem da entrada", "provisioned_by": "tutor-9"}
    assert attrs["email_confirm"] is True
    assert attrs["password"] == body["password"]
    # A credencial não vai para a trilha de auditoria.
    audit_payload = fake_client.table.return_value.insert.call_args.args[0]
    assert "password" not in str(audit_payload)


def test_provision_rejects_invalid_label(client):
    with patch("app.deps._fetch_user", return_value=_user("tutor")):
        res = client.post(
            "/api/v1/kiosks", json={"label": "<script>alert(1)</script>"}, headers={"Authorization": "Bearer t"}
        )
    assert res.status_code == 400


def test_each_provision_gets_distinct_credentials(client):
    fake_client = MagicMock()
    fake_client.auth.admin.create_user.return_value = SimpleNamespace(user=SimpleNamespace(id=KIOSK_UUID))
    with (
        patch("app.deps._fetch_user", return_value=_user("tutor")),
        patch("app.routers.kiosks.get_client", return_value=fake_client),
    ):
        a = client.post("/api/v1/kiosks", json={"label": "A"}, headers={"Authorization": "Bearer t"}).json()
        b = client.post("/api/v1/kiosks", json={"label": "B"}, headers={"Authorization": "Bearer t"}).json()
    assert a["email"] != b["email"] and a["password"] != b["password"]


def test_list_returns_only_kiosk_accounts_without_credentials(client):
    fake_client = MagicMock()
    fake_client.auth.admin.list_users.return_value = [
        SimpleNamespace(id=KIOSK_UUID, app_metadata={"role": "kiosk", "label": "Totem"}, created_at=None,
                        last_sign_in_at=None, banned_until=None),
        SimpleNamespace(id="tutor-1", app_metadata={"role": "tutor"}, created_at=None,
                        last_sign_in_at=None, banned_until=None),
    ]
    with (
        patch("app.deps._fetch_user", return_value=_user("tutor")),
        patch("app.routers.kiosks.get_client", return_value=fake_client),
    ):
        res = client.get("/api/v1/kiosks", headers={"Authorization": "Bearer t"})
    assert res.status_code == 200
    assert res.json() == [
        {"kiosk_id": KIOSK_UUID, "label": "Totem", "created_at": None, "last_sign_in_at": None, "disabled": False}
    ]


def test_revoke_only_deletes_kiosk_accounts(client):
    fake_client = MagicMock()
    with (
        patch("app.deps._fetch_user", return_value=_user("tutor")),
        patch("app.routers.kiosks.get_client", return_value=fake_client),
    ):
        # Conta de tutor: nunca é removida por esta rota.
        fake_client.auth.admin.get_user_by_id.return_value = SimpleNamespace(
            user=SimpleNamespace(id=KIOSK_UUID, app_metadata={"role": "tutor"}))
        res = client.delete(f"/api/v1/kiosks/{KIOSK_UUID}", headers={"Authorization": "Bearer t"})
        assert res.status_code == 404
        fake_client.auth.admin.delete_user.assert_not_called()

        fake_client.auth.admin.get_user_by_id.return_value = SimpleNamespace(
            user=SimpleNamespace(id=KIOSK_UUID, app_metadata={"role": "kiosk"}))
        res = client.delete(f"/api/v1/kiosks/{KIOSK_UUID}", headers={"Authorization": "Bearer t"})
        assert res.status_code == 204
        fake_client.auth.admin.delete_user.assert_called_once_with(KIOSK_UUID)

        assert client.delete("/api/v1/kiosks/nao-e-uuid", headers={"Authorization": "Bearer t"}).status_code == 400


def test_revoked_kiosk_is_rejected_after_cache_is_cleared(client):
    """A8: depois da revogação, o token do dispositivo deixa de autenticar."""
    with patch("app.deps._fetch_user", return_value=_user("kiosk", KIOSK_UUID)):
        ok = client.post("/api/v1/recognize/challenge", headers={"Authorization": "Bearer kiosk.jwt"})
    assert ok.status_code == 200

    clear_identity_cache_for_testing()  # o que revoke_kiosk faz neste processo
    with patch("app.deps._fetch_user", side_effect=RuntimeError("user not found")):
        denied = client.post("/api/v1/recognize/challenge", headers={"Authorization": "Bearer kiosk.jwt"})
    assert denied.status_code == 401


def test_legacy_shared_keys_no_longer_authenticate(client):
    """A7: as chaves compartilhadas antigas não abrem nenhuma rota."""
    legacy = {"X-Kiosk-Key": "qualquer-valor", "X-API-Key": "qualquer-valor"}
    assert client.post("/api/v1/recognize/challenge", headers=legacy).status_code == 401
    assert client.get("/api/v1/sessions/open", headers=legacy).status_code == 401
    assert client.post("/api/v1/sessions/close-stale", headers=legacy).status_code == 401
    assert client.post("/api/v1/maintenance/cleanup", headers=legacy).status_code == 401
    assert client.get("/api/v1/kiosks", headers=legacy).status_code == 401


def test_kiosk_identity_cannot_reach_admin_routes(client):
    with patch("app.deps._fetch_user", return_value=_user("kiosk", KIOSK_UUID)):
        headers = {"Authorization": "Bearer kiosk.jwt"}
        assert client.get("/api/v1/kiosks", headers=headers).status_code == 403
        assert client.post("/api/v1/kiosks", json={"label": "X"}, headers=headers).status_code == 403
        assert client.post("/api/v1/sessions/tutor-close", json={"profile_id": "p", "action": "void"},
                           headers=headers).status_code == 403
        assert client.delete("/api/v1/profiles/abc", headers=headers).status_code == 403


# ── Ordem autenticação → upload (UP-1 … UP-4) ─────────────────────────────────

UPLOAD_ROUTES = ["/api/v1/enroll", "/api/v1/profiles/some-id/refresh-embedding", "/api/v1/recognize"]


@pytest.mark.parametrize("path", UPLOAD_ROUTES)
def test_unauthenticated_upload_never_parses_form_or_runs_biometrics(client, path):
    with (
        patch("starlette.requests.Request.form") as form_spy,
        patch("app.routers.recognize.identify_frames") as identify_spy,
        patch("app.routers.enroll.enroll") as enroll_spy,
        patch("app.routers.profiles.refresh_embedding") as refresh_spy,
    ):
        res = client.post(path, files=_frames(), data={"name": "X", "consent": "true"})
    assert res.status_code == 401
    form_spy.assert_not_called()
    identify_spy.assert_not_called()
    enroll_spy.assert_not_called()
    refresh_spy.assert_not_called()


@pytest.mark.parametrize("path", UPLOAD_ROUTES)
def test_invalid_token_is_rejected_before_form_is_parsed(client, path):
    """Token presente mas inválido: a rota recusa sem ler o multipart."""
    with (
        patch("app.deps._fetch_user", side_effect=RuntimeError("invalid jwt")),
        patch("starlette.requests.Request.form") as form_spy,
    ):
        res = client.post(path, files=_frames(), data={"name": "X", "consent": "true"},
                          headers={"Authorization": "Bearer forjado"})
    assert res.status_code == 401
    form_spy.assert_not_called()


@pytest.mark.parametrize("path", ["/api/v1/enroll", "/api/v1/profiles/some-id/refresh-embedding"])
def test_wrong_role_is_rejected_before_form_is_parsed(client, path):
    with (
        patch("app.deps._fetch_user", return_value=_user(None)),
        patch("starlette.requests.Request.form") as form_spy,
    ):
        res = client.post(path, files=_frames(), data={"name": "X", "consent": "true"},
                          headers={"Authorization": "Bearer sem-papel"})
    assert res.status_code == 403
    form_spy.assert_not_called()


def test_oversized_body_is_rejected_with_413_before_parsing(client):
    big = b"\xff\xd8\xff" + b"0" * (settings.max_upload_bytes + 1024)
    with (
        patch("app.deps._fetch_user", return_value=_user("tutor")) as auth_spy,
        patch("starlette.requests.Request.form") as form_spy,
    ):
        res = client.post("/api/v1/enroll", files=[("frames", ("big.jpg", big, "image/jpeg"))],
                          data={"name": "X", "consent": "true"}, headers={"Authorization": "Bearer t"})
    assert res.status_code == 413
    form_spy.assert_not_called()
    auth_spy.assert_not_called()


def test_upload_rate_limit_returns_429_without_parsing(client):
    with (
        patch.object(settings, "upload_rate_limit_per_minute", 2),
        patch("app.deps._fetch_user", return_value=_user("tutor", "tutor-rl")),
        patch("app.routers.enroll.enroll", return_value={"profile_id": "p", "name": "X", "photos_used": 3}),
    ):
        headers = {"Authorization": "Bearer t"}
        payload = {"name": "X", "consent": "true"}
        assert client.post("/api/v1/enroll", files=_frames(), data=payload, headers=headers).status_code == 200
        assert client.post("/api/v1/enroll", files=_frames(), data=payload, headers=headers).status_code == 200
        with patch("starlette.requests.Request.form") as form_spy:
            third = client.post("/api/v1/enroll", files=_frames(), data=payload, headers=headers)
        assert third.status_code == 429
        form_spy.assert_not_called()


def test_enroll_multipart_contract_is_preserved(client):
    """Mesmos campos de antes: name, consent, matricula, frames."""
    with (
        patch("app.deps._fetch_user", return_value=_user("tutor")),
        patch("app.routers.enroll.enroll", return_value={"profile_id": "p1", "name": "Ana", "photos_used": 3}) as spy,
    ):
        res = client.post("/api/v1/enroll", files=_frames(3),
                          data={"name": "Ana", "consent": "true", "matricula": "123456789"},
                          headers={"Authorization": "Bearer t"})
    assert res.status_code == 200 and res.json() == {"profile_id": "p1", "name": "Ana", "photos_used": 3}
    name, matricula, images, consent = spy.call_args.args
    assert (name, matricula, consent, len(images)) == ("Ana", "123456789", True, 3)


def test_enroll_validates_required_fields_and_frame_count(client):
    with patch("app.deps._fetch_user", return_value=_user("tutor")):
        headers = {"Authorization": "Bearer t"}
        assert client.post("/api/v1/enroll", files=_frames(3), data={"consent": "true"},
                           headers=headers).status_code == 422
        assert client.post("/api/v1/enroll", files=_frames(3), data={"name": "A", "consent": "talvez"},
                           headers=headers).status_code == 422
        assert client.post("/api/v1/enroll", files=_frames(2), data={"name": "A", "consent": "true"},
                           headers=headers).status_code == 400


def test_openapi_still_documents_multipart_fields():
    schema = app.openapi()
    enroll = schema["paths"]["/api/v1/enroll"]["post"]["requestBody"]["content"]["multipart/form-data"]["schema"]
    assert set(enroll["properties"]) == {"name", "consent", "matricula", "frames"}
    refresh = schema["paths"]["/api/v1/profiles/{profile_id}/refresh-embedding"]["post"]
    assert "frames" in refresh["requestBody"]["content"]["multipart/form-data"]["schema"]["properties"]


# ── Prontidão (I1) ────────────────────────────────────────────────────────────


def _ready_patches(models=True, pad=True, db=True, pad_required=True):
    return (
        patch("app.routers.health.is_model_loaded", return_value=models),
        patch("app.routers.health.pad_model_loaded", return_value=pad),
        patch("app.routers.health._database_reachable", return_value=db),
        patch.object(settings, "pad_require_model", pad_required),
        patch.object(settings, "liveness_enabled", True),
    )


def _get_ready(client, **kwargs):
    patches = _ready_patches(**kwargs)
    for p in patches:
        p.start()
    try:
        return client.get("/health/ready")
    finally:
        for p in patches:
            p.stop()


def test_liveness_probe_does_not_depend_on_anything(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_readiness_is_200_only_when_everything_is_available(client):
    res = _get_ready(client)
    assert res.status_code == 200 and res.json() == {"status": "ready", "models_loaded": True}


@pytest.mark.parametrize(
    ("kwargs", "status"),
    [({"models": False}, "warming_up"), ({"pad": False}, "degraded"), ({"db": False}, "degraded")],
)
def test_readiness_is_503_when_a_required_dependency_is_missing(client, kwargs, status):
    res = _get_ready(client, **kwargs)
    assert res.status_code == 503
    assert res.json()["status"] == status
    assert set(res.json()) == {"status", "models_loaded"}, "o corpo não expõe detalhes internos"


def test_readiness_ignores_pad_when_not_required(client):
    assert _get_ready(client, pad=False, pad_required=False).status_code == 200


def test_pad_model_with_wrong_hash_is_not_loaded(tmp_path):
    from app.services import liveness_service as ls

    fake_model = tmp_path / "pad.onnx"
    fake_model.write_bytes(b"\x00" * 200_000)
    with (
        patch.object(ls, "_onnx_initialized", False),
        patch.object(ls, "_onnx_session", None),
        patch.object(settings, "insightface_root", str(tmp_path)),
        patch("os.path.abspath", return_value=str(tmp_path / "ausente.onnx")),
        patch("os.path.expanduser", side_effect=lambda p: str(fake_model) if p.endswith("pad.onnx") else p),
        patch("onnxruntime.InferenceSession") as session_spy,
    ):
        assert ls._init_onnx_pad() is None
        session_spy.assert_not_called()
