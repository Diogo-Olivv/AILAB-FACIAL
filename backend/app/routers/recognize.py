"""Router de reconhecimento facial e eventos de sessão."""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, File, HTTPException, Security, UploadFile
from fastapi.security.api_key import APIKeyHeader

from app.config import settings
from app.db.supabase_client import get_client
from app.services.face_service import identify
from app.services.session_service import register_event, total_hours

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1", tags=["recognize"])

_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_IMAGE_BYTES = 5 * 1024 * 1024  # 5 MB


def _verify_api_key(api_key: str | None = Security(_api_key_header)) -> None:
    """Valida X-API-Key quando a variável API_KEY estiver configurada."""
    if settings.api_key and api_key != settings.api_key:
        raise HTTPException(status_code=401, detail="API key inválida ou ausente.")


# ──────────────────────────────────────────────────────────────────────────────
# Endpoints
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/recognize", dependencies=[Depends(_verify_api_key)])
async def recognize(frame: UploadFile = File(...)):
    """Recebe um frame da câmera, identifica o rosto e registra o evento."""
    if frame.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(415, f"Tipo de mídia não suportado: {frame.content_type}")

    data = await frame.read()
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(413, "Imagem excede o limite de 5 MB.")

    result = identify(data)
    if result is None:
        return {"recognized": False}

    # Persiste log bruto
    try:
        get_client().table("face_logs").insert({
            "profile_id": result["profile_id"],
            "confidence": result["confidence"],
        }).execute()
    except Exception as exc:  # noqa: BLE001
        log.warning("Falha ao gravar face_log: %s", exc)

    # Registra sessão
    event = register_event(result["profile_id"])
    return {"recognized": True, **result, "event": event}


@router.get("/sessions/open")
def open_sessions():
    """Lista membros atualmente no laboratório (sessões sem check-out)."""
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
    """Retorna total de horas do membro, opcionalmente filtrado por mês."""
    hours = total_hours(profile_id, year=year, month=month)
    return {
        "profile_id": profile_id,
        "total_hours": hours,
        "year": year,
        "month": month,
    }


@router.post("/sync/sheets", dependencies=[Depends(_verify_api_key)])
def trigger_sheets_sync():
    """Dispara o sync Google Sheets manualmente (útil para testes)."""
    from app.services.sheets_service import sync_batch
    result = sync_batch()
    return result
