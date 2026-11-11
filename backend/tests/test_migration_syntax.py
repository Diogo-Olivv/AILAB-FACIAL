"""Gate de sintaxe SQL (AF-05): toda migration e o baseline de teste devem ser parseados pelo
parser oficial do PostgreSQL (libpg_query via pglast). Não exige servidor.

Import direto (sem importorskip): pglast ausente é falha, não skip silencioso.
"""
from __future__ import annotations

from pathlib import Path

import pglast
import pytest

BACKEND = Path(__file__).resolve().parents[1]
SQL_FILES = sorted((BACKEND / "migrations").glob("*.sql")) + [
    BACKEND / "db" / "test" / "00_supabase_shim.sql",
    BACKEND / "db" / "test" / "01_baseline_schema.sql",
]


@pytest.mark.parametrize("path", SQL_FILES, ids=lambda p: p.name)
def test_sql_file_parses_with_postgres_grammar(path: Path):
    sql = path.read_text(encoding="utf-8-sig")
    pglast.parse_sql(sql)


def test_migration_15_uses_valid_policy_command_list():
    """Regressão de AF-05: 'FOR INSERT, UPDATE, DELETE' não é gramática válida de CREATE POLICY."""
    sql = (BACKEND / "migrations" / "15_harden_rls_policies.sql").read_text(encoding="utf-8-sig")
    assert "FOR INSERT, UPDATE, DELETE" not in sql
