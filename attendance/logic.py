"""Regras de presença: SQLite + check-in/out alternado + debounce.

Esquema:
    sessions(id, pessoa, check_in TEXT ISO8601, check_out TEXT ISO8601 NULL)
"""

from __future__ import annotations

import sqlite3
from datetime import datetime, timedelta
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DB_PATH = REPO_ROOT / "attendance" / "attendance.db"
DEBOUNCE_SECONDS = 60


def conn():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(DB_PATH)
    c.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pessoa TEXT NOT NULL,
            check_in TEXT NOT NULL,
            check_out TEXT
        )
    """)
    c.execute("CREATE INDEX IF NOT EXISTS idx_sessions_pessoa ON sessions(pessoa)")
    return c


def sessao_aberta(c, pessoa):
    return c.execute(
        "SELECT id, check_in FROM sessions WHERE pessoa=? AND check_out IS NULL "
        "ORDER BY id DESC LIMIT 1",
        (pessoa,),
    ).fetchone()


def ultimo_evento(c, pessoa):
    row = c.execute(
        "SELECT MAX(COALESCE(check_out, check_in)) FROM sessions WHERE pessoa=?",
        (pessoa,),
    ).fetchone()
    if row and row[0]:
        return datetime.fromisoformat(row[0])
    return None


def registrar(pessoa, agora=None):
    """Alterna abrir/fechar sessão. Retorna dict {acao, pessoa, ...}."""
    agora = agora or datetime.now()
    with conn() as c:
        ultimo = ultimo_evento(c, pessoa)
        if ultimo and (agora - ultimo) < timedelta(seconds=DEBOUNCE_SECONDS):
            return {
                "acao": "ignorado_debounce",
                "pessoa": pessoa,
                "ultimo_evento": ultimo.isoformat(timespec="seconds"),
                "esperar_segundos": DEBOUNCE_SECONDS - int((agora - ultimo).total_seconds()),
            }

        aberta = sessao_aberta(c, pessoa)
        if aberta is None:
            c.execute(
                "INSERT INTO sessions (pessoa, check_in) VALUES (?, ?)",
                (pessoa, agora.isoformat(timespec="seconds")),
            )
            return {"acao": "entrada", "pessoa": pessoa,
                    "timestamp": agora.isoformat(timespec="seconds")}
        else:
            sess_id, check_in_iso = aberta
            c.execute(
                "UPDATE sessions SET check_out=? WHERE id=?",
                (agora.isoformat(timespec="seconds"), sess_id),
            )
            duracao = agora - datetime.fromisoformat(check_in_iso)
            return {
                "acao": "saida",
                "pessoa": pessoa,
                "timestamp": agora.isoformat(timespec="seconds"),
                "duracao_minutos": round(duracao.total_seconds() / 60, 1),
            }


def total_horas(pessoa, ano=None, mes=None):
    with conn() as c:
        if ano and mes:
            prefixo = f"{ano:04d}-{mes:02d}"
            rows = c.execute(
                "SELECT check_in, check_out FROM sessions "
                "WHERE pessoa=? AND check_out IS NOT NULL AND check_in LIKE ?",
                (pessoa, f"{prefixo}%"),
            ).fetchall()
        else:
            rows = c.execute(
                "SELECT check_in, check_out FROM sessions "
                "WHERE pessoa=? AND check_out IS NOT NULL",
                (pessoa,),
            ).fetchall()
    total = timedelta()
    for ci, co in rows:
        total += datetime.fromisoformat(co) - datetime.fromisoformat(ci)
    return round(total.total_seconds() / 3600, 2)


def listar_sessoes(pessoa=None, limit=50):
    with conn() as c:
        if pessoa:
            return c.execute(
                "SELECT id, pessoa, check_in, check_out FROM sessions "
                "WHERE pessoa=? ORDER BY id DESC LIMIT ?",
                (pessoa, limit),
            ).fetchall()
        return c.execute(
            "SELECT id, pessoa, check_in, check_out FROM sessions "
            "ORDER BY id DESC LIMIT ?",
            (limit,),
        ).fetchall()


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Uso: python attendance/logic.py PESSOA")
        sys.exit(2)
    print(registrar(sys.argv[1]))
