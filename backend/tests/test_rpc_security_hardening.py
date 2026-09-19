"""Regressões estáticas para RPCs administrativas SECURITY DEFINER."""
from pathlib import Path


MIGRATION = Path(__file__).parents[1] / "migrations" / "14_harden_tutor_rpc_permissions.sql"


DANGEROUS_FUNCTIONS = (
    "tutor_close_session",
    "tutor_register_entry",
    "tutor_remove_member",
    "tutor_void_session",
    "tutor_unvoid_session",
    "tutor_delete_session",
    "sweep_stale_sessions",
    "sync_tutor_credentials",
)


def test_admin_rpc_hardening_migration_exists_and_guards_mutations():
    sql = MIGRATION.read_text(encoding="utf-8")

    assert "CREATE OR REPLACE FUNCTION public.require_tutor_or_service()" in sql
    assert "auth.role()" in sql
    assert "RAISE EXCEPTION" in sql

    for function_name in DANGEROUS_FUNCTIONS:
        assert f"PERFORM public.require_tutor_or_service();" in sql or function_name == "sweep_stale_sessions"
        assert f"REVOKE ALL ON FUNCTION public.{function_name}" in sql
        assert f" TO anon" not in sql.split(f"REVOKE ALL ON FUNCTION public.{function_name}", 1)[1].split(";", 1)[0]


def test_maintenance_rpc_is_service_role_only():
    sql = MIGRATION.read_text(encoding="utf-8")
    grant_start = sql.index("GRANT EXECUTE ON FUNCTION public.sweep_stale_sessions()")
    grant_end = sql.index(";", grant_start)
    assert "TO service_role" in sql[grant_start:grant_end]
    assert "authenticated" not in sql[grant_start:grant_end]
    assert "anon" not in sql[grant_start:grant_end]
