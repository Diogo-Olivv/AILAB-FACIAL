"""Testes de integração das migrações 22–28 contra um Postgres efêmero.

Requer um Postgres com pgvector acessível em TEST_DATABASE_URL (padrão:
postgresql://postgres:test@localhost:55432/postgres). Exemplo:

    docker run -d --name ailab-pg-test -e POSTGRES_PASSWORD=test -p 55432:5432 pgvector/pgvector:pg17

Sem banco disponível os testes são pulados (não há como executá-los) — isso é
registrado como NOT RUN, nunca como aprovado.

O ambiente é um shim do Supabase (backend/db/test/00_supabase_shim.sql): mesmos
papéis e mesma leitura de claims, sem GoTrue/PostgREST/Realtime/pg_cron.
"""
from __future__ import annotations

import json
import os
import threading
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest

# REQUIRE_DB_TESTS=1 (CI): dependência ausente ou banco indisponível é FALHA, nunca skip (AF-06).
REQUIRE_DB = os.environ.get("REQUIRE_DB_TESTS") == "1"
if REQUIRE_DB:
    import psycopg
else:
    psycopg = pytest.importorskip("psycopg")

DB_URL = os.environ.get("TEST_DATABASE_URL", "postgresql://postgres:test@localhost:55432/postgres")
# Escopo destrutivo: a fixture faz DROP SCHEMA; só aceita host local (AF-22).
_LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1"}
BACKEND = Path(__file__).resolve().parents[1]
SQL_FILES = [
    BACKEND / "db" / "test" / "00_supabase_shim.sql",
    BACKEND / "db" / "test" / "01_baseline_schema.sql",
    *sorted((BACKEND / "migrations").glob("2[2-9]_*.sql")),
]


def _connect(autocommit: bool = True):
    return psycopg.connect(DB_URL, autocommit=autocommit, connect_timeout=3)


@pytest.fixture(scope="session")
def database():
    from urllib.parse import urlparse

    host = urlparse(DB_URL).hostname or ""
    if host not in _LOCAL_HOSTS:
        pytest.fail(f"TEST_DATABASE_URL aponta para host não local ({host!r}); recusado (fixture destrutiva).")
    try:
        conn = _connect()
    except Exception as exc:  # noqa: BLE001
        if REQUIRE_DB:
            pytest.fail(f"Postgres de teste indisponível com REQUIRE_DB_TESTS=1: {exc}")
        pytest.skip(f"Postgres de teste indisponível em TEST_DATABASE_URL: {exc}")
    with conn:
        conn.execute("DROP SCHEMA IF EXISTS public CASCADE")
        conn.execute("DROP SCHEMA IF EXISTS auth CASCADE")
        conn.execute("DROP SCHEMA IF EXISTS extensions CASCADE")
        conn.execute("CREATE SCHEMA public")
        # Default ACLs não pertencem a schema: zera para o estado inicial do shim.
        conn.execute("ALTER DEFAULT PRIVILEGES GRANT EXECUTE ON FUNCTIONS TO PUBLIC")
        for path in SQL_FILES:
            conn.execute(path.read_text(encoding="utf-8"))
    return DB_URL


@pytest.fixture()
def admin(database):
    """Conexão de superusuário para preparar e inspecionar dados."""
    conn = _connect()
    yield conn
    conn.close()


@pytest.fixture(autouse=True)
def _clean(database):
    conn = _connect()
    with conn:
        conn.execute(
            "TRUNCATE public.attendance_justifications, public.recognition_requests, "
            "public.admin_audit_log, public.face_logs, public.face_embeddings, "
            "public.sessions, public.profiles, auth.users RESTART IDENTITY CASCADE"
        )
    yield


# ── Helpers ───────────────────────────────────────────────────────────────────


def as_role(conn, role: str, *, sub: str | None = None, app_role: str | None = None,
            email: str | None = None, user_role: str | None = None):
    """Simula uma requisição PostgREST: papel do banco + claims do JWT."""
    claims: dict = {"role": role}
    if sub:
        claims["sub"] = sub
    if email:
        claims["email"] = email
    if app_role:
        claims["app_metadata"] = {"role": app_role}
    if user_role:
        claims["user_metadata"] = {"role": user_role}
    conn.execute("RESET ROLE")
    conn.execute("SELECT set_config('request.jwt.claims', %s, false)", (json.dumps(claims),))
    conn.execute(f"SET ROLE {role}")
    return conn


def make_user(admin, email: str, app_role: str | None = "tutor", confirmed: bool = True) -> str:
    uid = str(uuid.uuid4())
    meta = {"role": app_role} if app_role else {}
    admin.execute(
        "INSERT INTO auth.users (id, email, raw_app_meta_data, email_confirmed_at) VALUES (%s, %s, %s, %s)",
        (uid, email, json.dumps(meta), datetime.now(timezone.utc) if confirmed else None),
    )
    return uid


def make_profile(admin, name: str = "Pessoa Teste", matricula: str | None = None, **cols) -> str:
    pid = str(uuid.uuid4())
    admin.execute(
        "INSERT INTO public.profiles (id, name, matricula, active, consent_given) VALUES (%s, %s, %s, %s, true)",
        (pid, name, matricula or str(uuid.uuid4().int)[:9], cols.get("active", True)),
    )
    return pid


def tutor_conn(admin, email: str = "tutor1@example.test"):
    uid = make_user(admin, email)
    conn = _connect()
    return as_role(conn, "authenticated", sub=uid, app_role="tutor", email=email), uid


def service_conn():
    return as_role(_connect(), "service_role")


def monday_of_current_week() -> date:
    today = datetime.now(ZoneInfo("America/Sao_Paulo")).date()
    return today - timedelta(days=today.isoweekday() - 1)


def unit_vector(seed: int) -> list[float]:
    vec = [0.0] * 512
    vec[seed % 512] = 1.0
    return vec


INSUFFICIENT = psycopg.errors.InsufficientPrivilege


# ── Papéis e superfícies públicas (B1, B2, B3, B4) ────────────────────────────


def test_anon_cannot_read_tables_after_contract_migration(admin):
    make_profile(admin, "Fulano", "123456789")
    conn = as_role(_connect(), "anon")
    for table in ("profiles", "sessions", "face_embeddings", "face_logs",
                  "attendance_justifications", "recognition_requests", "admin_audit_log"):
        with pytest.raises(INSUFFICIENT):
            conn.execute(f"SELECT * FROM public.{table} LIMIT 1")


def test_public_stats_exposes_only_aggregates(admin):
    pid = make_profile(admin, "Nome Secreto", "987654321")
    admin.execute("INSERT INTO public.sessions (profile_id, check_in) VALUES (%s, now())", (pid,))
    conn = as_role(_connect(), "anon")
    payload = conn.execute("SELECT public.public_lab_stats(28)").fetchone()[0]
    text = json.dumps(payload)
    assert payload["present_now"] == 1
    assert set(payload) == {"present_now", "window_days", "total_sessions", "buckets", "timezone", "generated_at"}
    assert "Nome Secreto" not in text and "987654321" not in text and pid not in text


def test_public_stats_clamps_window_and_suppresses_small_buckets(admin):
    pid = make_profile(admin)
    # Uma única sessão num horário: recorte com menos de 3 sessões não aparece.
    admin.execute(
        "INSERT INTO public.sessions (profile_id, check_in, check_out) VALUES "
        "(%s, now() - interval '2 days', now() - interval '2 days' + interval '1 hour')", (pid,))
    conn = as_role(_connect(), "anon")
    payload = conn.execute("SELECT public.public_lab_stats(100000)").fetchone()[0]
    assert payload["window_days"] == 90
    assert payload["buckets"] == []


def test_kiosk_rpcs_require_kiosk_or_tutor(admin):
    pid = make_profile(admin, "Ana Kiosk", "111222333")
    admin.execute("INSERT INTO public.sessions (profile_id, check_in) VALUES (%s, now())", (pid,))

    anon = as_role(_connect(), "anon")
    with pytest.raises(INSUFFICIENT):
        anon.execute("SELECT * FROM public.kiosk_presence()")

    plain = as_role(_connect(), "authenticated", sub=str(uuid.uuid4()))
    with pytest.raises(INSUFFICIENT):
        plain.execute("SELECT * FROM public.kiosk_presence()")
    with pytest.raises(INSUFFICIENT):
        plain.execute("SELECT * FROM public.kiosk_directory()")

    # user_metadata nunca concede papel
    spoof = as_role(_connect(), "authenticated", sub=str(uuid.uuid4()), user_role="kiosk")
    with pytest.raises(INSUFFICIENT):
        spoof.execute("SELECT * FROM public.kiosk_presence()")

    kiosk = as_role(_connect(), "authenticated", sub=str(uuid.uuid4()), app_role="kiosk")
    rows = kiosk.execute("SELECT name, profile_id FROM public.kiosk_presence()").fetchall()
    assert [r[0] for r in rows] == ["Ana Kiosk"]
    directory = kiosk.execute("SELECT name, matricula FROM public.kiosk_directory()").fetchall()
    assert directory == [("Ana Kiosk", None)], "kiosk não recebe matrícula"
    # kiosk não lê a tabela de perfis diretamente
    assert kiosk.execute("SELECT count(*) FROM public.profiles").fetchone()[0] == 0

    tutor, _ = tutor_conn(admin)
    assert tutor.execute("SELECT matricula FROM public.kiosk_directory()").fetchall() == [("111222333",)]


def test_link_tutor_profile_roles_and_ownership(admin):
    make_profile(admin, "Perfil A", "100000001")
    anon = as_role(_connect(), "anon")
    with pytest.raises(INSUFFICIENT):
        anon.execute("SELECT public.link_tutor_profile('100000001', 'x@example.test')")

    plain = as_role(_connect(), "authenticated", sub=make_user(admin, "aluno@example.test", app_role=None),
                    email="aluno@example.test")
    with pytest.raises(INSUFFICIENT):
        plain.execute("SELECT public.link_tutor_profile('100000001', 'aluno@example.test')")

    tutor_a, _ = tutor_conn(admin, "a@example.test")
    # O parâmetro de e-mail é ignorado: vale o e-mail do JWT.
    res = tutor_a.execute("SELECT public.link_tutor_profile('100000001', 'vitima@example.test')").fetchone()[0]
    assert res["linked"] is True
    assert admin.execute("SELECT tutor_email, is_tutor FROM public.profiles WHERE matricula='100000001'").fetchone() == (
        "a@example.test", True)

    tutor_b, _ = tutor_conn(admin, "b@example.test")
    res = tutor_b.execute("SELECT public.link_tutor_profile('100000001', 'b@example.test')").fetchone()[0]
    assert res["success"] is False and res["linked"] is False
    assert admin.execute("SELECT tutor_email FROM public.profiles WHERE matricula='100000001'").fetchone()[0] == "a@example.test"


def test_link_tutor_profile_rejects_unconfirmed_email(admin):
    make_profile(admin, "Perfil C", "100000003")
    uid = make_user(admin, "novo@example.test", confirmed=False)
    conn = as_role(_connect(), "authenticated", sub=uid, app_role="tutor", email="novo@example.test")
    res = conn.execute("SELECT public.link_tutor_profile('100000003', '')").fetchone()[0]
    assert res["linked"] is False
    assert admin.execute("SELECT is_tutor FROM public.profiles WHERE matricula='100000003'").fetchone()[0] is False


def test_tutor_rpcs_work_for_tutor_and_fail_for_others(admin):
    pid = make_profile(admin)
    tutor, _ = tutor_conn(admin)
    res = tutor.execute("SELECT public.tutor_register_entry(%s)", (pid,)).fetchone()[0]
    assert res["success"] is True

    plain = as_role(_connect(), "authenticated", sub=str(uuid.uuid4()))
    with pytest.raises(INSUFFICIENT):
        plain.execute("SELECT public.tutor_close_session(%s, 'checkout')", (pid,))
    anon = as_role(_connect(), "anon")
    with pytest.raises(INSUFFICIENT):
        anon.execute("SELECT public.tutor_close_session(%s, 'checkout')", (pid,))


def test_removed_login_functions_are_gone(admin):
    assert admin.execute("SELECT to_regprocedure('public.verify_tutor_login(text,text)')").fetchone()[0] is None
    assert admin.execute("SELECT to_regprocedure('public.sync_tutor_credentials(text,text,text)')").fetchone()[0] is None


def test_no_new_object_is_open_to_anon(admin):
    rows = admin.execute(
        "SELECT p.oid::regprocedure::text FROM pg_proc p "
        "WHERE p.pronamespace = 'public'::regnamespace AND has_function_privilege('anon', p.oid, 'EXECUTE')"
    ).fetchall()
    assert [r[0] for r in rows] == ["public_lab_stats(integer)"]
    tables = admin.execute(
        "SELECT c.relname FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind='r' "
        "AND (has_table_privilege('anon', c.oid, 'SELECT') OR has_table_privilege('anon', c.oid, 'INSERT'))"
    ).fetchall()
    assert tables == []


def test_default_privileges_closed_for_future_tables(admin):
    """Tabelas novas nascem fechadas. Funções dependem de REVOKE explícito por migração
    (padrão global de PUBLIC), o que é vigiado por test_no_new_object_is_open_to_anon."""
    admin.execute("CREATE TABLE public.zz_future (id int)")
    try:
        assert admin.execute("SELECT has_table_privilege('anon', 'public.zz_future', 'SELECT')").fetchone()[0] is False
        assert admin.execute(
            "SELECT has_table_privilege('authenticated', 'public.zz_future', 'SELECT')").fetchone()[0] is False
    finally:
        admin.execute("DROP TABLE public.zz_future")


# ── Presença atômica (P1–P3) ──────────────────────────────────────────────────


def test_presence_event_contract_and_transitions(admin):
    pid = make_profile(admin)
    svc = service_conn()
    ev = svc.execute("SELECT public.register_presence_event(%s, NULL, 0, 10)", (pid,)).fetchone()[0]
    assert ev["action"] == "check_in" and ev["profile_id"] == pid
    assert set(ev) == {"action", "profile_id", "session_id", "timestamp"}

    ev = svc.execute("SELECT public.register_presence_event(%s, 'check_in', 0, 10)", (pid,)).fetchone()[0]
    assert ev == {"action": "already_in", "profile_id": pid}

    ev = svc.execute("SELECT public.register_presence_event(%s, 'check_out', 0, 10)", (pid,)).fetchone()[0]
    assert ev["action"] == "check_out"
    assert set(ev) == {"action", "profile_id", "session_id", "timestamp", "duration_minutes"}

    ev = svc.execute("SELECT public.register_presence_event(%s, 'check_out', 0, 10)", (pid,)).fetchone()[0]
    assert ev == {"action": "not_in", "profile_id": pid}


def test_presence_debounce_blocks_immediate_repeat(admin):
    pid = make_profile(admin)
    svc = service_conn()
    first = svc.execute("SELECT public.register_presence_event(%s, NULL, 60, 10)", (pid,)).fetchone()[0]
    second = svc.execute("SELECT public.register_presence_event(%s, NULL, 60, 10)", (pid,)).fetchone()[0]
    assert first["action"] == "check_in"
    assert second["action"] == "debounced" and 1 <= second["wait_seconds"] <= 60
    assert admin.execute("SELECT count(*) FROM public.sessions").fetchone()[0] == 1


def test_presence_voids_stale_session_then_checks_in(admin):
    pid = make_profile(admin)
    admin.execute("INSERT INTO public.sessions (profile_id, check_in) VALUES (%s, now() - interval '2 days')", (pid,))
    svc = service_conn()
    ev = svc.execute("SELECT public.register_presence_event(%s, NULL, 60, 10)", (pid,)).fetchone()[0]
    assert ev["action"] == "check_in"
    rows = admin.execute(
        "SELECT voided_at IS NOT NULL, auto_closed, check_out IS NULL FROM public.sessions ORDER BY id").fetchall()
    assert rows == [(True, True, False), (False, False, True)]


def test_presence_rejects_invalid_action_without_side_effects(admin):
    pid = make_profile(admin)
    svc = service_conn()
    with pytest.raises(psycopg.errors.InvalidParameterValue):
        svc.execute("SELECT public.register_presence_event(%s, 'apagar', 0, 10)", (pid,))
    assert admin.execute("SELECT count(*) FROM public.sessions").fetchone()[0] == 0


def test_presence_is_not_callable_by_clients(admin):
    pid = make_profile(admin)
    tutor, _ = tutor_conn(admin)
    with pytest.raises(INSUFFICIENT):
        tutor.execute("SELECT public.register_presence_event(%s, NULL, 0, 10)", (pid,))


def test_twenty_concurrent_check_ins_open_exactly_one_session(admin):
    pid = make_profile(admin)
    results: list[str] = []
    errors: list[Exception] = []
    barrier = threading.Barrier(20)

    def worker():
        conn = service_conn()
        try:
            barrier.wait(timeout=10)
            ev = conn.execute("SELECT public.register_presence_event(%s, NULL, 60, 10)", (pid,)).fetchone()[0]
            results.append(ev["action"])
        except Exception as exc:  # noqa: BLE001
            errors.append(exc)
        finally:
            conn.close()

    threads = [threading.Thread(target=worker) for _ in range(20)]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=30)

    assert errors == []
    assert results.count("check_in") == 1
    assert set(results) <= {"check_in", "debounced"}
    assert admin.execute("SELECT count(*) FROM public.sessions WHERE check_out IS NULL").fetchone()[0] == 1
    assert admin.execute("SELECT count(*) FROM public.sessions").fetchone()[0] == 1


def test_kiosk_and_tutor_racing_keep_state_consistent(admin):
    pid = make_profile(admin)
    admin.execute("INSERT INTO public.sessions (profile_id, check_in) VALUES (%s, now() - interval '2 hours')", (pid,))
    tutor, _ = tutor_conn(admin)
    barrier = threading.Barrier(2)
    out: dict = {}

    def kiosk():
        conn = service_conn()
        barrier.wait(timeout=10)
        out["kiosk"] = conn.execute(
            "SELECT public.register_presence_event(%s, 'check_out', 0, 10)", (pid,)).fetchone()[0]
        conn.close()

    def tutor_job():
        barrier.wait(timeout=10)
        out["tutor"] = tutor.execute("SELECT public.tutor_close_session(%s, 'checkout')", (pid,)).fetchone()[0]

    threads = [threading.Thread(target=kiosk), threading.Thread(target=tutor_job)]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=30)

    # Exatamente um dos dois fechou a sessão; ela foi fechada uma única vez.
    closed_by_kiosk = out["kiosk"]["action"] == "check_out"
    closed_by_tutor = out["tutor"]["updated_count"] == 1
    assert closed_by_kiosk != closed_by_tutor
    assert admin.execute("SELECT count(*) FROM public.sessions WHERE check_out IS NULL").fetchone()[0] == 0


# ── Anti-replay e idempotência (AR1–AR12) ─────────────────────────────────────

SHA_A = "a" * 64
SHA_B = "b" * 64


def claim(conn, cid="cid-1", device="dev-1", sha=SHA_A, expired=False, lease=30, max_attempts=3, retention=300):
    return conn.execute(
        "SELECT public.claim_recognition_request(%s, %s, %s, %s, %s, %s, %s)",
        (cid, device, sha, expired, lease, max_attempts, retention),
    ).fetchone()[0]


def complete(conn, cid, attempt, result, profile_id=None, action=None):
    return conn.execute(
        "SELECT public.complete_recognition_request(%s, %s::int, %s::jsonb, %s::uuid, %s::text, %s::real, %s::int, %s::int)",
        (cid, attempt, json.dumps(result), profile_id, action, 0.9, 0, 10),
    ).fetchone()[0]


def test_claim_outcomes(admin):
    svc = service_conn()
    assert claim(svc) == {"outcome": "claimed", "attempt": 1}
    again = claim(svc)
    assert again["outcome"] == "processing" and again["retry_after"] >= 1
    assert claim(svc, sha=SHA_B) == {"outcome": "conflict"}
    assert claim(svc, device="dev-2") == {"outcome": "forbidden"}
    assert claim(svc, cid="nunca-visto", expired=True) == {"outcome": "expired"}


def test_completed_request_replays_same_result_and_single_presence(admin):
    pid = make_profile(admin)
    svc = service_conn()
    assert claim(svc)["outcome"] == "claimed"
    done = complete(svc, "cid-1", 1, {"recognized": True, "status": "ok"}, pid, None)
    assert done["outcome"] == "completed" and done["replayed"] is False
    assert done["result"]["event"]["action"] == "check_in"

    # Retry do cliente (mesmo payload), mesmo com o desafio já expirado.
    replay = claim(svc, expired=True)
    assert replay["outcome"] == "completed"
    assert replay["result"] == done["result"]

    # Reexecução da finalização após resposta perdida: nenhum efeito novo.
    again = complete(svc, "cid-1", 1, {"recognized": True, "status": "ok"}, pid, None)
    assert again["replayed"] is True and again["result"] == done["result"]

    assert admin.execute("SELECT count(*) FROM public.sessions").fetchone()[0] == 1
    assert admin.execute("SELECT count(*) FROM public.face_logs").fetchone()[0] == 1


def test_stored_result_has_no_name_image_or_embedding(admin):
    pid = make_profile(admin, "Nome Que Nao Pode Vazar")
    svc = service_conn()
    claim(svc)
    complete(svc, "cid-1", 1, {"recognized": True, "status": "ok", "confidence": 0.91}, pid, None)
    stored = json.dumps(admin.execute("SELECT result FROM public.recognition_requests").fetchone()[0])
    assert "Nome Que Nao Pode Vazar" not in stored
    assert "embedding" not in stored and "frame" not in stored


def test_abandoned_request_is_recovered_and_old_worker_is_fenced(admin):
    pid = make_profile(admin)
    svc = service_conn()
    assert claim(svc)["attempt"] == 1
    admin.execute("UPDATE public.recognition_requests SET lease_expires_at = now() - interval '1 second'")
    reclaimed = claim(svc, expired=True)
    assert reclaimed == {"outcome": "claimed", "attempt": 2}

    # O worker antigo (tentativa 1) não consegue finalizar nem registrar presença.
    assert complete(svc, "cid-1", 1, {"recognized": True}, pid, None) == {"outcome": "stale"}
    assert admin.execute("SELECT count(*) FROM public.sessions").fetchone()[0] == 0

    done = complete(svc, "cid-1", 2, {"recognized": True}, pid, None)
    assert done["outcome"] == "completed"
    assert admin.execute("SELECT count(*) FROM public.sessions").fetchone()[0] == 1


def test_attempts_are_bounded(admin):
    svc = service_conn()
    for expected in (1, 2, 3):
        assert claim(svc)["attempt"] == expected
        admin.execute("UPDATE public.recognition_requests SET lease_expires_at = now() - interval '1 second'")
    assert claim(svc)["outcome"] == "exhausted"
    assert claim(svc)["outcome"] == "failed_final"
    assert admin.execute("SELECT status FROM public.recognition_requests").fetchone()[0] == "FAILED_FINAL"


def test_retryable_failure_allows_immediate_reclaim(admin):
    svc = service_conn()
    claim(svc)
    out = svc.execute("SELECT public.fail_recognition_request('cid-1', 1, true, NULL)").fetchone()[0]
    assert out == {"outcome": "failed_retryable"}
    assert claim(svc) == {"outcome": "claimed", "attempt": 2}
    out = svc.execute("SELECT public.fail_recognition_request('cid-1', 2, false, '{\"status\":\"no_face\"}')").fetchone()[0]
    assert out == {"outcome": "failed_final"}
    final = claim(svc)
    assert final["outcome"] == "failed_final" and final["result"] == {"status": "no_face"}


def test_two_independent_connections_claim_same_cid_only_once(admin):
    outcomes: list[str] = []
    barrier = threading.Barrier(8)

    def worker():
        conn = service_conn()
        barrier.wait(timeout=10)
        outcomes.append(claim(conn, cid="cid-race")["outcome"])
        conn.close()

    threads = [threading.Thread(target=worker) for _ in range(8)]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=30)
    assert outcomes.count("claimed") == 1
    assert set(outcomes) == {"claimed", "processing"}


def test_purge_removes_rows_past_retention_without_traffic(admin):
    svc = service_conn()
    claim(svc, cid="velho", retention=300)
    claim(svc, cid="novo", retention=300)
    admin.execute("UPDATE public.recognition_requests SET expires_at = now() - interval '1 minute' WHERE cid='velho'")
    assert svc.execute("SELECT public.purge_recognition_requests()").fetchone()[0] == 1
    assert [r[0] for r in admin.execute("SELECT cid FROM public.recognition_requests")] == ["novo"]


def test_recognition_functions_closed_to_clients(admin):
    tutor, _ = tutor_conn(admin)
    with pytest.raises(INSUFFICIENT):
        claim(tutor)
    with pytest.raises(INSUFFICIENT):
        tutor.execute("SELECT * FROM public.recognition_requests")


# ── Revogação e LGPD (RV-1 no nível do banco, RV-2) ───────────────────────────


def _insert_embedding(admin, pid, seed=0):
    vec = unit_vector(seed)
    admin.execute(
        "INSERT INTO public.face_embeddings (profile_id, embedding, vec) VALUES (%s, %s, %s::extensions.vector)",
        (pid, vec, json.dumps(vec)),
    )


def _match(conn, seed=0):
    return conn.execute(
        "SELECT profile_id::text FROM public.match_face(%s::extensions.vector, 0.45, 1)",
        (json.dumps(unit_vector(seed)),),
    ).fetchall()


def test_revoked_profile_never_matches(admin):
    pid = make_profile(admin)
    _insert_embedding(admin, pid)
    svc = service_conn()
    assert _match(svc) == [(pid,)]

    out = svc.execute("SELECT public.revoke_profile_consent(%s, NULL)", (pid,)).fetchone()[0]
    assert out["found"] is True and out["embeddings_deleted"] == 1
    assert _match(svc) == []
    # Outra conexão (outra "instância") também não reconhece.
    assert _match(service_conn()) == []
    assert admin.execute("SELECT count(*) FROM public.admin_audit_log WHERE action='revoke_consent'").fetchone()[0] == 1


def test_match_ignores_leftover_template_of_revoked_profile(admin):
    """Reproduz o finding L-02: template remanescente em perfil revogado não pode casar."""
    pid = make_profile(admin)
    _insert_embedding(admin, pid)
    # Estado inconsistente possível hoje: revogado, ainda ativo, com template.
    admin.execute("UPDATE public.profiles SET consent_revoked_at = now() WHERE id = %s", (pid,))
    assert _match(service_conn()) == []


def test_delete_profile_with_sessions_is_all_or_nothing(admin):
    pid = make_profile(admin)
    _insert_embedding(admin, pid)
    admin.execute("INSERT INTO public.sessions (profile_id, check_in, check_out) VALUES (%s, now() - interval '3 hours', now())", (pid,))
    admin.execute("INSERT INTO public.face_logs (profile_id, confidence) VALUES (%s, 0.9)", (pid,))
    svc = service_conn()
    out = svc.execute("SELECT public.delete_profile_cascade(%s, NULL)", (pid,)).fetchone()[0]
    assert out["deleted"] is True and out["sessions"] == 1
    for table in ("profiles", "sessions", "face_logs", "face_embeddings"):
        assert admin.execute(f"SELECT count(*) FROM public.{table}").fetchone()[0] == 0


def test_delete_profile_refused_when_justifications_exist(admin):
    pid = make_profile(admin)
    _insert_embedding(admin, pid)
    tutor, _ = tutor_conn(admin)
    tutor.execute("SELECT public.justify_attendance_debt(%s, %s, 'saude', NULL)", (pid, monday_of_current_week()))
    svc = service_conn()
    out = svc.execute("SELECT public.delete_profile_cascade(%s, NULL)", (pid,)).fetchone()[0]
    assert out == {"found": True, "deleted": False, "reason": "has_justifications"}
    assert admin.execute("SELECT count(*) FROM public.profiles").fetchone()[0] == 1
    assert admin.execute("SELECT count(*) FROM public.face_embeddings").fetchone()[0] == 1


def test_replace_embeddings_is_atomic(admin):
    pid = make_profile(admin)
    _insert_embedding(admin, pid, seed=1)
    svc = service_conn()
    with pytest.raises(psycopg.errors.InvalidParameterValue):
        svc.execute("SELECT public.replace_profile_embeddings(%s, %s::jsonb, NULL)",
                    (pid, json.dumps([unit_vector(2), [0.1, 0.2]])))
    # Falha no meio: o template antigo continua lá.
    assert admin.execute("SELECT count(*) FROM public.face_embeddings").fetchone()[0] == 1

    out = svc.execute("SELECT public.replace_profile_embeddings(%s, %s::jsonb, NULL)",
                      (pid, json.dumps([unit_vector(2), unit_vector(3)]))).fetchone()[0]
    assert out == {"found": True, "replaced": True, "count": 2}
    assert _match(svc, seed=2) == [(pid,)]
    assert _match(svc, seed=1) == []


# ── Justificativas (J3–J11, J15) ──────────────────────────────────────────────


def _justify(conn, pid, start=None, category="saude", reason=None):
    return conn.execute(
        "SELECT public.justify_attendance_debt(%s, %s, %s, %s)",
        (pid, start or monday_of_current_week(), category, reason),
    ).fetchone()[0]


def test_justify_persists_author_and_does_not_touch_sessions(admin):
    pid = make_profile(admin)
    admin.execute(
        "INSERT INTO public.sessions (profile_id, check_in, check_out) VALUES (%s, now() - interval '2 hours', now() - interval '1 hour')",
        (pid,))
    before = admin.execute("SELECT id, check_in, check_out, duration_s, voided_at FROM public.sessions").fetchall()

    tutor, uid = tutor_conn(admin, "maria@example.test")
    out = _justify(tutor, pid, category="saude", reason="Atestado apresentado")
    j = out["justification"]
    assert out["created"] is True
    assert j["status"] == "active" and j["justified_by"] == uid and j["justified_by_label"] == "maria"
    assert j["period_end"] == str(monday_of_current_week() + timedelta(days=6))

    assert admin.execute("SELECT id, check_in, check_out, duration_s, voided_at FROM public.sessions").fetchall() == before

    # Outro tutor enxerga o mesmo registro.
    other, _ = tutor_conn(admin, "joao@example.test")
    listed = other.execute(
        "SELECT public.list_attendance_justifications(%s, %s)",
        (monday_of_current_week(), monday_of_current_week() + timedelta(days=6)),
    ).fetchone()[0]
    assert [i["id"] for i in listed["items"]] == [j["id"]]


def test_justify_is_idempotent_and_single_active(admin):
    pid = make_profile(admin)
    a, _ = tutor_conn(admin, "a@example.test")
    b, _ = tutor_conn(admin, "b@example.test")
    first = _justify(a, pid)
    second = _justify(b, pid, category="pessoal")
    assert first["created"] is True and second["created"] is False
    assert second["justification"]["id"] == first["justification"]["id"]
    assert second["justification"]["category"] == "saude", "o registro original não é sobrescrito"
    assert admin.execute("SELECT count(*) FROM public.attendance_justifications").fetchone()[0] == 1


def test_justification_is_scoped_to_one_week(admin):
    pid = make_profile(admin)
    tutor, _ = tutor_conn(admin)
    last_week = monday_of_current_week() - timedelta(days=7)
    _justify(tutor, pid, start=last_week)
    this_week = tutor.execute(
        "SELECT public.list_attendance_justifications(%s, %s)",
        (monday_of_current_week(), monday_of_current_week() + timedelta(days=6)),
    ).fetchone()[0]
    assert this_week["items"] == []


def test_justify_validation(admin):
    pid = make_profile(admin)
    tutor, _ = tutor_conn(admin)
    monday = monday_of_current_week()
    invalid = psycopg.errors.InvalidParameterValue
    with pytest.raises(invalid):
        _justify(tutor, pid, start=monday + timedelta(days=1))  # não é segunda
    with pytest.raises(invalid):
        _justify(tutor, pid, start=monday + timedelta(days=7))  # semana futura
    with pytest.raises(invalid):
        _justify(tutor, pid, category="ferias")
    with pytest.raises(invalid):
        _justify(tutor, pid, category="outro", reason="   ")
    with pytest.raises(invalid):
        _justify(tutor, pid, reason="x" * 501)
    with pytest.raises(psycopg.errors.NoDataFound):
        _justify(tutor, str(uuid.uuid4()))
    assert admin.execute("SELECT count(*) FROM public.attendance_justifications").fetchone()[0] == 0


def test_justifications_blocked_for_anon_and_non_tutor(admin):
    pid = make_profile(admin)
    monday = monday_of_current_week()
    anon = as_role(_connect(), "anon")
    with pytest.raises(INSUFFICIENT):
        _justify(anon, pid)
    with pytest.raises(INSUFFICIENT):
        anon.execute("SELECT public.list_attendance_justifications(%s, %s)", (monday, monday))

    plain = as_role(_connect(), "authenticated", sub=str(uuid.uuid4()), user_role="tutor")
    with pytest.raises(INSUFFICIENT):
        _justify(plain, pid)
    with pytest.raises(INSUFFICIENT):
        plain.execute("SELECT public.list_attendance_justifications(%s, %s)", (monday, monday))

    kiosk = as_role(_connect(), "authenticated", sub=str(uuid.uuid4()), app_role="kiosk")
    with pytest.raises(INSUFFICIENT):
        _justify(kiosk, pid)


def test_tutor_cannot_bypass_rpcs_with_direct_table_access(admin):
    pid = make_profile(admin)
    tutor, _ = tutor_conn(admin)
    j = _justify(tutor, pid)["justification"]
    for sql in (
        "SELECT * FROM public.attendance_justifications",
        "UPDATE public.attendance_justifications SET reason = 'adulterado'",
        "DELETE FROM public.attendance_justifications",
    ):
        with pytest.raises(INSUFFICIENT):
            tutor.execute(sql)
    assert admin.execute("SELECT reason FROM public.attendance_justifications WHERE id=%s", (j["id"],)).fetchone()[0] is None


def test_revoke_restores_and_keeps_history(admin):
    pid = make_profile(admin)
    tutor, uid = tutor_conn(admin)
    first = _justify(tutor, pid)["justification"]

    out = tutor.execute("SELECT public.revoke_attendance_justification(%s, %s)", (first["id"], "Lançado por engano")).fetchone()[0]
    assert out["changed"] is True
    assert out["justification"]["status"] == "revoked" and out["justification"]["revoked_by"] == uid

    again = tutor.execute("SELECT public.revoke_attendance_justification(%s, NULL)", (first["id"],)).fetchone()[0]
    assert again["changed"] is False
    assert again["justification"]["revocation_reason"] == "Lançado por engano"

    # Depois de revogada, uma nova justificativa cria outra linha; o histórico fica.
    second = _justify(tutor, pid, category="academico")
    assert second["created"] is True and second["justification"]["id"] != first["id"]
    rows = admin.execute(
        "SELECT revoked_at IS NULL FROM public.attendance_justifications ORDER BY justified_at").fetchall()
    assert rows == [(False,), (True,)]

    monday = monday_of_current_week()
    active_only = tutor.execute(
        "SELECT public.list_attendance_justifications(%s, %s, NULL, false)", (monday, monday + timedelta(days=6))
    ).fetchone()[0]
    assert [i["status"] for i in active_only["items"]] == ["active"]


def test_concurrent_justify_by_many_tutors_creates_one_active(admin):
    pid = make_profile(admin)
    conns = [tutor_conn(admin, f"t{i}@example.test")[0] for i in range(6)]
    barrier = threading.Barrier(len(conns))
    created: list[bool] = []
    errors: list[Exception] = []

    def worker(conn):
        try:
            barrier.wait(timeout=10)
            created.append(_justify(conn, pid)["created"])
        except Exception as exc:  # noqa: BLE001
            errors.append(exc)

    threads = [threading.Thread(target=worker, args=(c,)) for c in conns]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=30)
    assert errors == []
    assert created.count(True) == 1 and created.count(False) == len(conns) - 1
    assert admin.execute(
        "SELECT count(*) FROM public.attendance_justifications WHERE revoked_at IS NULL").fetchone()[0] == 1


def test_concurrent_revoke_and_justify_stay_coherent(admin):
    pid = make_profile(admin)
    a, _ = tutor_conn(admin, "a@example.test")
    b, _ = tutor_conn(admin, "b@example.test")
    first = _justify(a, pid)["justification"]
    barrier = threading.Barrier(2)
    out: dict = {}

    def revoke():
        barrier.wait(timeout=10)
        out["revoke"] = a.execute(
            "SELECT public.revoke_attendance_justification(%s, NULL)", (first["id"],)).fetchone()[0]

    def justify():
        barrier.wait(timeout=10)
        out["justify"] = _justify(b, pid, category="pessoal")

    threads = [threading.Thread(target=revoke), threading.Thread(target=justify)]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=30)

    assert out["revoke"]["changed"] is True
    active = admin.execute(
        "SELECT count(*) FROM public.attendance_justifications WHERE revoked_at IS NULL").fetchone()[0]
    total = admin.execute("SELECT count(*) FROM public.attendance_justifications").fetchone()[0]
    # Ou justificar viu a ativa (0 ativas, 1 linha) ou veio depois da revogação (1 ativa, 2 linhas).
    assert (active, total) in {(0, 1), (1, 2)}
    assert out["justify"]["created"] is (total == 2)


def test_list_enforces_range_limit_and_paginates_deterministically(admin):
    tutor, _ = tutor_conn(admin)
    monday = monday_of_current_week()
    with pytest.raises(psycopg.errors.InvalidParameterValue):
        tutor.execute("SELECT public.list_attendance_justifications(%s, %s)", (monday - timedelta(days=200), monday))
    with pytest.raises(psycopg.errors.InvalidParameterValue):
        tutor.execute("SELECT public.list_attendance_justifications(%s, %s)", (monday, monday - timedelta(days=1)))

    ids = []
    for i in range(5):
        pid = make_profile(admin, f"Pessoa {i}")
        ids.append(_justify(tutor, pid)["justification"]["id"])

    seen: list[str] = []
    cursor = None
    for _ in range(5):
        page = tutor.execute(
            "SELECT public.list_attendance_justifications(%s, %s, NULL, true, 2, %s::jsonb)",
            (monday, monday + timedelta(days=6), json.dumps(cursor) if cursor else None),
        ).fetchone()[0]
        seen.extend(i["id"] for i in page["items"])
        cursor = page["next_cursor"]
        if cursor is None:
            break
    assert sorted(seen) == sorted(ids) and len(seen) == len(set(seen))

    one = tutor.execute(
        "SELECT public.list_attendance_justifications(%s, %s, NULL, true, 100000)", (monday, monday + timedelta(days=6))
    ).fetchone()[0]
    assert len(one["items"]) == 5


# ── Privilégios do role anon após a migration 29 (AF-01/AF-02 contenção) ─────


@pytest.mark.parametrize("table", ["profiles", "sessions", "face_logs", "face_embeddings", "sync_cursor"])
@pytest.mark.parametrize("privilege", ["INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"])
def test_anon_lacks_write_privileges_on_data_tables(admin, table, privilege):
    # Verificação de catálogo: independe do esquema de cada tabela (ex.: sync_cursor não tem id).
    granted = admin.execute(
        "SELECT has_table_privilege('anon', %s, %s)", (f"public.{table}", privilege)
    ).fetchone()[0]
    assert granted is False, f"anon ainda tem {privilege} em public.{table}"


def test_anon_cannot_execute_link_tutor_profile(admin):
    make_profile(admin, "Aluno", "555444333")
    conn = as_role(_connect(), "anon")
    with pytest.raises(INSUFFICIENT):
        conn.execute("SELECT public.link_tutor_profile('555444333', 'x@ailab.test')")
    conn.rollback()
    row = admin.execute("SELECT is_tutor FROM public.profiles WHERE matricula = '555444333'").fetchone()
    assert row[0] is False


def test_authenticated_cannot_truncate_data_tables(admin):
    conn, _uid = tutor_conn(admin, "tutor-trunc@example.test")
    with pytest.raises(INSUFFICIENT):
        conn.execute("TRUNCATE public.profiles")
    conn.rollback()
