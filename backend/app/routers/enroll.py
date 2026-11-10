"""Router de cadastro biometrico de integrantes."""
from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from starlette.datastructures import UploadFile as StarletteUploadFile

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
from app.routers.recognize import check_rate_limit
from app.services.enroll_service import EnrollError, enroll

router = APIRouter(prefix="/api/v1", tags=["enroll"])


def _postgrest_detail(exc: APIError) -> str:
    parts = [p for p in (exc.message, exc.details, exc.hint) if p]
    return " | ".join(parts) or "Erro ao persistir no banco."


_TRUE_VALUES = {"true", "1", "on", "yes", "t", "y"}
_FALSE_VALUES = {"false", "0", "off", "no", "f", "n"}

MULTIPART_ENROLL_SCHEMA = {
    "requestBody": {
        "required": True,
        "content": {
            "multipart/form-data": {
                "schema": {
                    "type": "object",
                    "required": ["name", "consent", "frames"],
                    "properties": {
                        "name": {"type": "string"},
                        "consent": {"type": "boolean"},
                        "matricula": {"type": "string", "default": ""},
                        "frames": {"type": "array", "items": {"type": "string", "format": "binary"}},
                    },
                }
            }
        },
    }
}


def parse_bool_field(value: object, field: str) -> bool:
    text = str(value).strip().lower() if value is not None else ""
    if text in _TRUE_VALUES:
        return True
    if text in _FALSE_VALUES:
        return False
    raise HTTPException(422, f"Campo '{field}' inválido.")


async def read_frames_form(request: Request, max_frames: int, max_fields: int):
    """Lê o multipart DEPOIS da autenticação e do rate limit, com teto de partes."""
    form = await request.form(max_files=max_frames + 1, max_fields=max_fields)
    frames = [f for f in form.getlist("frames") if isinstance(f, StarletteUploadFile)]
    return form, frames


@router.post("/enroll", response_model=EnrollResponse, openapi_extra=MULTIPART_ENROLL_SCHEMA)
async def enroll_endpoint(request: Request, tutor: dict = Depends(verify_tutor_token)):
    """Cadastro biométrico. O corpo só é lido após validar o tutor e o limite de taxa."""
    check_rate_limit(tutor["user_id"], limit=settings.upload_rate_limit_per_minute, bucket="enroll")
    form, frames = await read_frames_form(request, settings.max_enroll_frames, max_fields=8)
    name = form.get("name")
    if not isinstance(name, str) or not name.strip():
        raise HTTPException(422, "Campo 'name' é obrigatório.")
    if form.get("consent") is None:
        raise HTTPException(422, "Campo 'consent' é obrigatório.")
    consent = parse_bool_field(form.get("consent"), "consent")
    matricula = form.get("matricula")
    if not frames:
        raise HTTPException(422, "Campo 'frames' é obrigatório.")
    return await enroll_route(
        name=name, consent=consent, matricula=matricula if isinstance(matricula, str) else "", frames=frames
    )


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
