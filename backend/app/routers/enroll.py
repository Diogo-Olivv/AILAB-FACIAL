"""Router de cadastro biometrico de integrantes."""
from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.deps import validate_image, verify_api_key
from app.services.enroll_service import EnrollError, enroll

router = APIRouter(prefix="/api/v1", tags=["enroll"])


@router.post("/enroll", dependencies=[Depends(verify_api_key)])
async def enroll_route(
    name: str = Form(...),
    consent: bool = Form(...),
    matricula: str = Form(""),
    frames: list[UploadFile] = File(...),
):
    """Recebe nome, consentimento e fotos; extrai e persiste o embedding."""
    images: list[bytes] = []
    for frame in frames:
        data = await frame.read()
        validate_image(frame.content_type, len(data))
        images.append(data)

    try:
        return enroll(name, matricula, images, consent)
    except EnrollError as exc:
        raise HTTPException(422, str(exc)) from exc
