"""Lógica de sessões check-in/check-out sobre Supabase (PostgreSQL).

Implementa:
1. Controle de concorrência com índice parcial único e histerese (anti-flip-flop).
2. Tratamento gracioso de colisão (unique violation 23505).
3. Encerramento justo de saídas esquecidas com teto e flag auto_closed.
4. Consulta temporal robusta de total_hours em UTC contínuo (sem erro de dia 32).
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
import logging
from typing import Any
from zoneinfo import ZoneInfo

from app.config import settings
from app.db.supabase_client import get_client

log = logging.getLogger(__name__)
UTC = timezone.utc
BRT = ZoneInfo("America/Sao_Paulo")


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
        .is_("voided_at", "null")
        .order("check_in", desc=True)
        .limit(1)
        .execute()
    )
    return row.data[0] if row.data else None


def _parse_ts(value: str) -> datetime:
    """Converte timestamp ISO do banco em datetime timezone-aware (UTC)."""
    dt = datetime.fromisoformat(value)
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


def _is_stale(check_in_iso: str, now: datetime) -> bool:
    """True se a sessão passou de max_session_hours (10h) OU se cruzou a meia-noite (America/Sao_Paulo)."""
    ci_dt = _parse_ts(check_in_iso)
    # 1. Limite de permanência máxima contínua (ex: 10 horas)
    if (now - ci_dt) >= timedelta(hours=settings.max_session_hours):
        return True
    # 2. Virada da noite: check_in ocorreu em dia anterior no fuso horário de Brasília
    ci_brt = ci_dt.astimezone(BRT)
    now_brt = now.astimezone(BRT)
    if ci_brt.date() < now_brt.date():
        return True
    return False


def _close_stale_session(sess_id: int, check_in_iso: str) -> None:
    """Fecha uma sessão de saída esquecida marcando-a como anulada (voided_at).

    Comportamento documentado (README): sessões abandonadas contam 0 horas —
    voided_at é preenchido e não é creditado no total. O campo check_out é
    preenchido com o mesmo valor de voided_at para satisfazer constraints NOT NULL,
    mas o serviço de relatório ignora registros onde voided_at IS NOT NULL.
    """
    now_iso = datetime.now(UTC).isoformat()
    get_client().table("sessions").update({
        "check_out": now_iso,   # fecha o registro aberto (constraint NOT NULL)
        "voided_at": now_iso,   # marca como anulada — 0 horas creditadas
        "auto_closed": True,    # auditoria: indica fechamento automático pelo sweep
    }).eq("id", sess_id).execute()
    log.info(
        "Sessão %s anulada pelo sweep (saída esquecida): voided_at=%s, horas creditadas=0.",
        sess_id,
        now_iso,
    )


def _last_event_ts(profile_id: str) -> datetime | None:
    """Obtém o timestamp do último evento do membro (para histerese)."""
    try:
        # Tenta RPC se disponível
        row = get_client().rpc("last_event_time", {"p_profile_id": profile_id}).execute()
        val = row.data
        if val:
            return _parse_ts(str(val))
    except Exception as exc:
        log.debug("last_event_time RPC fallback: %s", exc)

    # Fallback por query direta indexada
    try:
        last = (
            get_client()
            .table("sessions")
            .select("check_in, check_out")
            .eq("profile_id", profile_id)
            .order("check_in", desc=True)
            .limit(1)
            .execute()
        )
        if last.data:
            ts_str = last.data[0]["check_out"] or last.data[0]["check_in"]
            return _parse_ts(ts_str)
    except Exception as exc:
        log.warning("Falha ao consultar último evento: %s", exc)

    return None


# ──────────────────────────────────────────────────────────────────────────────
# API pública
# ──────────────────────────────────────────────────────────────────────────────


def register_event(profile_id: str, action: str | None = None) -> dict[str, Any]:
    """Registra entrada/saída com controle atômico e histerese anti-flip-flop.

    Args:
        profile_id: UUID do integrante.
        action: 'check_in', 'check_out' ou None (alternância automática).

    Returns:
        dict com campo 'action' em
        {check_in, check_out, already_in, not_in, debounced}.
    """
    now = datetime.now(UTC)

    # 1. Histerese de segurança geral
    last = _last_event_ts(profile_id)
    if last and (now - last) < timedelta(seconds=settings.debounce_seconds):
        wait = settings.debounce_seconds - int((now - last).total_seconds())
        return {
            "action": "debounced",
            "profile_id": profile_id,
            "wait_seconds": max(1, wait),
        }

    open_sess = _open_session(profile_id)

    # 2. Tratamento de saída esquecida em aberto
    if open_sess is not None and _is_stale(open_sess["check_in"], now):
        _close_stale_session(open_sess["id"], open_sess["check_in"])
        open_sess = None

    # Validação de intenção explícita
    if action == "check_in" and open_sess is not None:
        return {"action": "already_in", "profile_id": profile_id}
    if action == "check_out" and open_sess is None:
        return {"action": "not_in", "profile_id": profile_id}

    # 3. CHECK-IN
    if open_sess is None:
        db = get_client()
        try:
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
        except Exception as exc:
            err_msg = str(exc)
            # Concorrência tratada: intercepta colisão no índice parcial UNIQUE
            if "23505" in err_msg or "idx_sessions_profile_single_open" in err_msg or "unique" in err_msg.lower():
                log.info("Colisão de concorrência mitigada: sessão já aberta para %s", profile_id)
                return {"action": "already_in", "profile_id": profile_id}
            raise

    # 4. CHECK-OUT
    check_in_dt = _parse_ts(open_sess["check_in"])

    # Histerese de checkout: impede checkout imediato (acidental) se acabou de entrar
    if action is None and (now - check_in_dt) < timedelta(seconds=settings.debounce_seconds):
        wait = settings.debounce_seconds - int((now - check_in_dt).total_seconds())
        return {
            "action": "debounced",
            "profile_id": profile_id,
            "wait_seconds": max(1, wait),
        }

    sess_id = open_sess["id"]
    db = get_client()
    db.table("sessions").update({"check_out": now.isoformat()}).eq("id", sess_id).execute()
    duration_min = max(0.0, round((now - check_in_dt).total_seconds() / 60, 1))

    return {
        "action": "check_out",
        "profile_id": profile_id,
        "session_id": sess_id,
        "timestamp": now.isoformat(),
        "duration_minutes": duration_min,
    }


def close_stale_sessions() -> dict[str, int]:
    """Fecha sessões esquecidas aplicando anulação (voided_at) para computar 0 horas.

    Critérios de anulação:
    1. Sessões cuja duração em aberto atingiu ou ultrapassou max_session_hours (10h).
    2. Sessões cujo check_in ocorreu em dia anterior no horário de Brasília (virada da meia-noite).
    """
    now = datetime.now(UTC)
    rows = (
        get_client()
        .table("sessions")
        .select("id, check_in")
        .is_("check_out", "null")
        .execute()
        .data
    ) or []

    closed_count = 0
    for r in rows:
        if _is_stale(r["check_in"], now):
            _close_stale_session(r["id"], r["check_in"])
            closed_count += 1
    return {"auto_closed": closed_count}


def total_hours(
    profile_id: str,
    year: int | None = None,
    month: int | None = None,
) -> float:
    """Soma de horas das sessões fechadas e válidas em UTC contínuo (sem erro de dia 32)."""
    db = get_client()
    q = (
        db.table("sessions")
        .select("check_in, check_out")
        .eq("profile_id", profile_id)
        .not_.is_("check_out", "null")
        .is_("voided_at", "null")
    )

    if year and month:
        start_ts = f"{year:04d}-{month:02d}-01T00:00:00Z"
        if month == 12:
            end_ts = f"{year + 1:04d}-01-01T00:00:00Z"
        else:
            end_ts = f"{year:04d}-{month + 1:02d}-01T00:00:00Z"
        q = q.gte("check_in", start_ts).lt("check_in", end_ts)

    rows = q.execute().data or []

    total = timedelta()
    for r in rows:
        ci = _parse_ts(r["check_in"])
        co = _parse_ts(r["check_out"])
        if co > ci:
            total += co - ci

    return round(total.total_seconds() / 3600, 2)
