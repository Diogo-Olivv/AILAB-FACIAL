"""Router de cadastro biometrico de integrantes."""
from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

try:
    from postgrest.exceptions import APIError
except ImportError:
    class APIError(Exception):  # type: ignore
        message = ""
        details = ""
        hint = ""

from app.config import settings
from app.deps import validate_image, verify_tutor_token
from app.routers.contracts import EnrollResponse
from app.services.enroll_service import EnrollError, enroll

router = APIRouter(prefix="/api/v1", tags=["enroll"])


def _postgrest_detail(exc: APIError) -> str:
    parts = [p for p in (exc.message, exc.details, exc.hint) if p]
    return " | ".join(parts) or "Erro ao persistir no banco."


@router.post("/enroll", response_model=EnrollResponse, dependencies=[Depends(verify_tutor_token)])
async def enroll_route(
    name: str = Form(...),
    consent: bool = Form(...),
    matricula: str = Form(""),
    frames: list[UploadFile] = File(...),  # noqa: B008
):
    """Recebe nome, consentimento e fotos; extrai e persiste o embedding."""
    if len(frames) > settings.max_enroll_frames:
        raise HTTPException(
            400,
            f"Excesso de fotos enviadas. O limite máximo é de {settings.max_enroll_frames} fotos por cadastro.",
        )
    if len(frames) < 3:
        raise HTTPException(
            400,
            "Quantidade insuficiente de fotos. Envie ao menos 3 fotos para cadastro.",
        )

    images: list[bytes] = []
    for frame in frames:
        data = await frame.read()
        validate_image(frame.content_type, len(data), data)
        images.append(data)

    try:
        return await asyncio.to_thread(enroll, name, matricula, images, consent)
    except EnrollError as exc:
        raise HTTPException(422, str(exc)) from exc
    except APIError as exc:
        raise HTTPException(422, _postgrest_detail(exc)) from exc
