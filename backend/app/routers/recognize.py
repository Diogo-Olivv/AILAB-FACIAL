"""Router de reconhecimento facial e eventos de sessao."""
from __future__ import annotations

import asyncio
import logging

import collections
import time
import threading

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from starlette.datastructures import UploadFile

from datetime import datetime, timezone
from pydantic import BaseModel, Field

from app.config import settings
from app.db.supabase_client import get_client
from app.deps import validate_image, verify_api_key, verify_kiosk_key, verify_tutor_token
from app.routers.contracts import ChallengeResponse, RecognizeResponse
from app.services.challenge_service import (
    create_capture_challenge,
    verify_and_consume_challenge,
)
from app.services.face_service import identify, identify_frames
from app.services.session_service import (
    close_stale_sessions,
    register_event,
    total_hours,
)

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1", tags=["recognize"])

# Semáforo assíncrono para limitar concorrência máxima de inferência CPU (FINDING-08)
_inference_semaphore = asyncio.Semaphore(settings.max_concurrent_inferences)

# Rate limiter em janela deslizante de 60s por chave ou IP (FINDING-08)
_rate_limit_lock = threading.Lock()
_request_history: dict[str, collections.deque] = collections.defaultdict(collections.deque)


def _check_rate_limit(client_id: str) -> None:
    now = time.time()
    window_start = now - 60.0
    with _rate_limit_lock:
        timestamps = _request_history[client_id]
        while timestamps and timestamps[0] < window_start:
            timestamps.popleft()
        if len(timestamps) >= settings.rate_limit_per_minute:
            log.warning("Rate limit excedido para cliente '%s' (%d req/min)", client_id, len(timestamps))
            raise HTTPException(
                status_code=429,
                detail=f"Muitas requisições. Limite de {settings.rate_limit_per_minute} req/min excedido.",
            )
        timestamps.append(now)


def clear_rate_limits_for_testing() -> None:
    """Limpa o histórico de requisições entre testes."""
    with _rate_limit_lock:
        _request_history.clear()


@router.post("/recognize/challenge", response_model=ChallengeResponse, dependencies=[Depends(verify_kiosk_key)])
@router.get("/recognize/challenge", response_model=ChallengeResponse, dependencies=[Depends(verify_kiosk_key)])
def request_challenge():
    """Emite token de desafio criptográfico assinado com TTL para captura temporal anti-injeção."""
    return create_capture_challenge()


@router.post("/recognize", response_model=RecognizeResponse, dependencies=[Depends(verify_kiosk_key)])
async def recognize(
    request: Request,
    x_challenge_id: str | None = Header(None, alias="X-Challenge-Id"),
    x_challenge_token: str | None = Header(None, alias="X-Challenge-Token"),
    kiosk_key: str | None = Header(None, alias="X-Kiosk-Key"),
):
    """Recebe frame(s) da camera, valida o desafio temporal, identifica o rosto e registra o evento."""
    # Leitura manual do multipart: `list[UploadFile]` opcional via File() é parseado como escalar
    # em versões do FastAPI, gerando 422. getlist() lida com single e multi-frame de forma robusta.
    form = await request.form()
    frames = [f for f in form.getlist("frames") if isinstance(f, UploadFile)]
    single_frame = form.get("frame")
    action = form.get("action")
    challenge_id = form.get("challenge_id")

    # 1. Limitação de taxa (Rate Limiting)
    client_id = kiosk_key or (request.client.host if request.client else "kiosk-anonymous")
    _check_rate_limit(client_id)

    # 2. Desafio temporal anti-injeção (suporta FormData ou Headers X-Challenge-Token / X-Challenge-Id)
    effective_challenge = challenge_id or x_challenge_token or x_challenge_id
    if settings.enforce_capture_challenge:
        valid, reason = verify_and_consume_challenge(effective_challenge)
        if not valid:
            raise HTTPException(
                status_code=403,
                detail=f"Desafio de captura inválido ou expirado: {reason}",
            )
    uploads: list[UploadFile] = []
    if frames:
        uploads.extend(frames)
    elif isinstance(single_frame, UploadFile):
        uploads.append(single_frame)

    if not uploads:
        return {
            "recognized": False,
            "status": "no_face",
            "message": "Nenhum frame de imagem fornecido.",
        }

    raw_images: list[bytes] = []
    for f in uploads[:5]:
        b = await f.read()
        validate_image(f.content_type, len(b), b)
        raw_images.append(b)

    # Offload de inferência CPU protegido por semáforo de concorrência
    async with _inference_semaphore:
        result = await asyncio.to_thread(identify_frames, raw_images)
    if not result or not result.get("recognized"):
        return result or {
            "recognized": False,
            "status": "not_recognized",
            "message": "Rosto não reconhecido na base.",
        }

    profile_id = result.get("profile_id")
    event = None
    if profile_id:
        try:
            get_client().table("face_logs").insert({
                "profile_id": profile_id,
                "confidence": result.get("confidence", 0.0),
            }).execute()
        except Exception as exc:  # noqa: BLE001
            log.warning("Falha ao gravar face_log: %s", exc)

        event = register_event(profile_id, action)

    return {"recognized": True, **result, "event": event}


@router.get("/sessions/open", dependencies=[Depends(verify_api_key)])
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


@router.post("/sessions/close-stale", dependencies=[Depends(verify_api_key)])
def close_stale():
    """Fecha sessões de saída esquecida. Alvo do sweep diário (cron-job.org à meia-noite)."""
    return close_stale_sessions()


@router.get("/sessions/stats/{profile_id}", dependencies=[Depends(verify_kiosk_key)])
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


class TutorCloseSessionRequest(BaseModel):
    profile_id: str
    action: str = Field(pattern="^(checkout|void)$")


@router.post("/sessions/tutor-close", dependencies=[Depends(verify_tutor_token)])
def tutor_close_session_endpoint(body: TutorCloseSessionRequest):
    """Permite ao tutor autenticado registrar saída imediata ou anular sessão de presença."""
    db = get_client()
    now_iso = datetime.now(timezone.utc).isoformat()
    if body.action == "checkout":
        res = (
            db.table("sessions")
            .update({"check_out": now_iso})
            .eq("profile_id", body.profile_id)
            .is_("check_out", "null")
            .execute()
        )
    else:
        res = (
            db.table("sessions")
            .update({
                "check_out": now_iso,
                "voided_at": now_iso,
                "auto_closed": True,
            })
            .eq("profile_id", body.profile_id)
            .is_("check_out", "null")
            .execute()
        )
    return {
        "success": True,
        "action": body.action,
        "profile_id": body.profile_id,
        "updated_rows": len(res.data) if res.data else 0,
    }
