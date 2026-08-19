"""Valida o schema do Supabase configurado. Sai 1 se faltar coluna.

Uso: SUPABASE_URL=... SUPABASE_SERVICE_KEY=... python -m scripts.check_schema
"""
from __future__ import annotations

import sys

from app.db.schema_check import SchemaMismatch, validate_schema


def main() -> int:
    try:
        validate_schema()
    except SchemaMismatch as exc:
        print(exc, file=sys.stderr)
        return 1
    print("Schema ok.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
