"""Valida no boot que o banco tem as colunas que o codigo espera."""
from __future__ import annotations

from app.db.schema import EXPECTED_COLUMNS
from app.db.supabase_client import get_client


class SchemaMismatch(Exception):
    """O banco nao bate com o schema esperado por app/."""


def _table_error(table: str, columns: list[str]) -> str | None:
    try:
        get_client().table(table).select(",".join(columns)).limit(1).execute()
        return None
    except Exception as exc:  # noqa: BLE001
        return getattr(exc, "message", str(exc))


def validate_schema() -> None:
    """Falha rapido se alguma coluna esperada nao existir. Rode schema.sql."""
    problems = {
        table: err
        for table, columns in EXPECTED_COLUMNS.items()
        if (err := _table_error(table, columns))
    }
    if problems:
        detail = "; ".join(f"{table}: {err}" for table, err in problems.items())
        raise SchemaMismatch(
            f"Schema do Supabase incompleto ({detail}). Rode backend/schema.sql."
        )
