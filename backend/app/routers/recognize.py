"""Router de reconhecimento facial e eventos de sessao."""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, File, UploadFile

from app.db.supabase_client import get_client
from app.deps import validate_image, verify_api_key
from app.services.face_service import identify
from app.services.session_service import register_event, total_hours

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1", tags=["recognize"])


@router.post("/recognize", dependencies=[Depends(verify_api_key)])
async def recognize(frame: UploadFile = File(...)):
    """Recebe um frame da camera, identifica o rosto e registra o evento."""
    data = await frame.read()
    validate_image(frame.content_type, len(data))

    result = identify(data)
    if result is None:
        return {"recognized": False}

    try:
        get_client().table("face_logs").insert({
            "profile_id": result["profile_id"],
            "confidence": result["confidence"],
        }).execute()
    except Exception as exc:  # noqa: BLE001
        log.warning("Falha ao gravar face_log: %s", exc)

    event = register_event(result["profile_id"])
    return {"recognized": True, **result, "event": event}


@router.get("/sessions/open")
def open_sessions():
    """Lista membros atualmente no laboratorio (sessoes sem check-out)."""
    rows = (
        get_client()
        .table("sessions")
        .select("id, check_in, profiles(id, name, avatar_url, matricula)")
        .is_("check_out", "null")
        .order("check_in", desc=False)
        .execute()
    )
    return rows.data


@router.get("/sessions/stats/{profile_id}")
def session_stats(
    profile_id: str,
    year: int | None = None,
    month: int | None = None,
):
    """Retorna total de horas do membro, opcionalmente filtrado por mes."""
    hours = total_hours(profile_id, year=year, month=month)
    return {
        "profile_id": profile_id,
        "total_hours": hours,
        "year": year,
        "month": month,
    }


@router.post("/sync/sheets", dependencies=[Depends(verify_api_key)])
def trigger_sheets_sync():
    """Dispara o sync Google Sheets manualmente (util para testes)."""
    from app.services.sheets_service import sync_batch
    return sync_batch()
