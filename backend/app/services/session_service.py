"""Lógica de sessões check-in/check-out sobre Supabase (PostgreSQL).

Porta a lógica de attendance/logic.py do SQLite para Supabase,
mantendo: debounce configurável, alternância check-in/check-out,
cálculo de total_hours filtrável por ano/mês.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from app.config import settings
from app.db.supabase_client import get_client

UTC = timezone.utc


# ──────────────────────────────────────────────────────────────────────────────
# Helpers internos
# ──────────────────────────────────────────────────────────────────────────────

def _open_session(profile_id: str) -> dict[str, Any] | None:
    """Retorna a sessão aberta mais recente do perfil, ou None."""
    row = (
        get_client()
        .table("sessions")
        .select("id, check_in")
        .eq("profile_id", profile_id)
        .is_("check_out", "null")
        .order("check_in", desc=True)
        .limit(1)
        .execute()
    )
    return row.data[0] if row.data else None


def _last_event_ts(profile_id: str) -> datetime | None:
    """Chama RPC last_event_time para debounce eficiente."""
    row = (
        get_client()
        .rpc("last_event_time", {"p_profile_id": profile_id})
        .execute()
    )
    val = row.data
    if val:
        return datetime.fromisoformat(str(val)).replace(tzinfo=UTC)
    return None


# ──────────────────────────────────────────────────────────────────────────────
# API pública
# ──────────────────────────────────────────────────────────────────────────────

def register_event(profile_id: str, action: str | None = None) -> dict[str, Any]:
    """Registra entrada/saida com debounce.

    Args:
        action: quando ``check_in`` ou ``check_out``, forca a direcao; caso
            contrario alterna conforme a sessao aberta.

    Returns:
        dict com campo ``action`` em
        {check_in, check_out, already_in, not_in, debounced}.
    """
    now = datetime.now(UTC)
    db = get_client()

    last = _last_event_ts(profile_id)
    if last and (now - last) < timedelta(seconds=settings.debounce_seconds):
        wait = settings.debounce_seconds - int((now - last).total_seconds())
        return {
            "action": "debounced",
            "profile_id": profile_id,
            "wait_seconds": wait,
        }

    open_sess = _open_session(profile_id)

    if action == "check_in" and open_sess is not None:
        return {"action": "already_in", "profile_id": profile_id}
    if action == "check_out" and open_sess is None:
        return {"action": "not_in", "profile_id": profile_id}

    if open_sess is None:
        # ── CHECK-IN ──────────────────────────────────────────────────────────
        res = (
            db.table("sessions")
            .insert({"profile_id": profile_id, "check_in": now.isoformat()})
            .execute()
        )
        return {
            "action": "check_in",
            "profile_id": profile_id,
            "session_id": res.data[0]["id"],
            "timestamp": now.isoformat(),
        }

    # ── CHECK-OUT ─────────────────────────────────────────────────────────────
    sess_id = open_sess["id"]
    db.table("sessions").update({"check_out": now.isoformat()}).eq("id", sess_id).execute()
    check_in_dt = datetime.fromisoformat(open_sess["check_in"]).replace(tzinfo=UTC)
    duration_min = round((now - check_in_dt).total_seconds() / 60, 1)
    return {
        "action": "check_out",
        "profile_id": profile_id,
        "session_id": sess_id,
        "timestamp": now.isoformat(),
        "duration_minutes": duration_min,
    }


def total_hours(
    profile_id: str,
    year: int | None = None,
    month: int | None = None,
) -> float:
    """Soma de horas de todas as sessões fechadas, opcionalmente filtrado por mês."""
    db = get_client()
    q = (
        db.table("sessions")
        .select("check_in, check_out")
        .eq("profile_id", profile_id)
        .not_.is_("check_out", "null")
    )
    if year and month:
        prefix = f"{year:04d}-{month:02d}"
        q = q.gte("check_in", f"{prefix}-01").lt(
            "check_in", f"{prefix}-32"
        )
    rows = q.execute().data

    total = timedelta()
    for r in rows:
        ci = datetime.fromisoformat(r["check_in"])
        co = datetime.fromisoformat(r["check_out"])
        # Garante timezone-aware
        if ci.tzinfo is None:
            ci = ci.replace(tzinfo=UTC)
        if co.tzinfo is None:
            co = co.replace(tzinfo=UTC)
        total += co - ci

    return round(total.total_seconds() / 3600, 2)
