"""Sincronização incremental Supabase → Google Sheets.

Estratégia de cursor: guarda o último ``session.id`` exportado na tabela
``sync_cursor``, garantindo idempotência e sem duplicatas mesmo em caso de
falha parcial.
"""
from __future__ import annotations

import json
import logging

from app.config import settings
from app.db.supabase_client import get_client

log = logging.getLogger(__name__)

_SHEET_NAME = "Presença"
_CURSOR_KEY = "last_session_id"
_BATCH_SIZE = 500


# ──────────────────────────────────────────────────────────────────────────────
# Google Sheets helpers
# ──────────────────────────────────────────────────────────────────────────────

def _sheets_service():
    from google.oauth2.service_account import Credentials  # type: ignore
    from googleapiclient.discovery import build  # type: ignore

    creds_dict = json.loads(settings.google_creds_json)
    creds = Credentials.from_service_account_info(
        creds_dict,
        scopes=["https://www.googleapis.com/auth/spreadsheets"],
    )
    return build("sheets", "v4", credentials=creds, cache_discovery=False)


def _ensure_header(service, spreadsheet_id: str) -> None:
    meta = service.spreadsheets().get(spreadsheetId=spreadsheet_id).execute()
    existing = [s["properties"]["title"] for s in meta["sheets"]]
    if _SHEET_NAME not in existing:
        service.spreadsheets().batchUpdate(
            spreadsheetId=spreadsheet_id,
            body={"requests": [{"addSheet": {"properties": {"title": _SHEET_NAME}}}]},
        ).execute()
        _append_rows(service, spreadsheet_id, [
            ["ID", "Nome", "Matrícula", "Check-in (BRT)", "Check-out (BRT)", "Duração (min)"],
        ])


def _append_rows(service, spreadsheet_id: str, rows: list[list]) -> None:
    service.spreadsheets().values().append(
        spreadsheetId=spreadsheet_id,
        range=f"{_SHEET_NAME}!A1",
        valueInputOption="USER_ENTERED",
        insertDataOption="INSERT_ROWS",
        body={"values": rows},
    ).execute()


# ──────────────────────────────────────────────────────────────────────────────
# Cursor helpers
# ──────────────────────────────────────────────────────────────────────────────

def _get_cursor() -> int:
    db = get_client()
    row = db.table("sync_cursor").select("value").eq("key", _CURSOR_KEY).execute()
    return int(row.data[0]["value"]) if row.data else 0


def _set_cursor(last_id: int) -> None:
    get_client().table("sync_cursor").upsert(
        {"key": _CURSOR_KEY, "value": str(last_id)}
    ).execute()


# ──────────────────────────────────────────────────────────────────────────────
# Job principal
# ──────────────────────────────────────────────────────────────────────────────

def _fetch_sessions(after_id: int) -> list[dict]:
    return (
        get_client()
        .table("sessions")
        .select("id, check_in, check_out, duration_s, profiles(name, matricula)")
        .not_.is_("check_out", "null")
        .gt("id", after_id)
        .order("id")
        .limit(_BATCH_SIZE)
        .execute()
    ).data


def sync_batch() -> dict:
    """Exporta sessões fechadas novas para o Google Sheets.

    Returns:
        {"synced": int, "cursor": int}
    """
    if not settings.google_creds_json or not settings.sheets_spreadsheet_id:
        log.warning("Google Sheets não configurado — pulando sync.")
        return {"synced": 0, "cursor": 0, "skipped": True}

    cursor = _get_cursor()
    sessions = _fetch_sessions(after_id=cursor)
    if not sessions:
        log.debug("Sheets sync: nenhuma sessão nova (cursor=%d)", cursor)
        return {"synced": 0, "cursor": cursor}

    rows: list[list] = []
    for s in sessions:
        profile = s.get("profiles") or {}
        duration_min = round((s["duration_s"] or 0) / 60, 1)
        rows.append([
            s["id"],
            profile.get("name", "—"),
            profile.get("matricula", "—"),
            s["check_in"],
            s["check_out"],
            duration_min,
        ])

    svc = _sheets_service()
    _ensure_header(svc, settings.sheets_spreadsheet_id)
    _append_rows(svc, settings.sheets_spreadsheet_id, rows)

    new_cursor = sessions[-1]["id"]
    _set_cursor(new_cursor)
    log.info("Sheets sync: %d sessões exportadas (cursor %d→%d)", len(sessions), cursor, new_cursor)
    return {"synced": len(sessions), "cursor": new_cursor}
