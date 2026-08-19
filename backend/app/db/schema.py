"""Colunas esperadas por tabela. Espelha schema.sql e o que app/ acessa."""
from __future__ import annotations

EXPECTED_COLUMNS: dict[str, list[str]] = {
    "profiles": [
        "id",
        "name",
        "matricula",
        "avatar_url",
        "active",
        "consent_given",
        "consent_at",
        "created_at",
    ],
    "face_embeddings": ["id", "profile_id", "embedding", "created_at"],
    "sessions": ["id", "profile_id", "check_in", "check_out"],
    "face_logs": ["id", "profile_id", "confidence", "created_at"],
}
