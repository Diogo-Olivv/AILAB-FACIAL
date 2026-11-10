"""Router de gestão de perfis e direitos do titular LGPD (Art. 18 e Art. 8 § 5º)."""
from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter, Depends, File, HTTPException, Request, Response, UploadFile

from app.config import settings
from app.db.supabase_client import get_client
from app.deps import require_tutor_or_window, validate_image, verify_tutor_token
from app.routers.contracts import EnrollResponse, RevokeConsentResponse
from app.services.enroll_service import EnrollError, ProfileNotFound, refresh_embedding
from app.services.enrollment_window import is_enrollment_window_active
from app.services.face_service import invalidate_embeddings_cache

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/profiles", tags=["profiles"])


@router.get("/{profile_id}", dependencies=[Depends(verify_tutor_token)])
def get_profile(profile_id: str):
    """Consulta metadados do perfil e status de consentimento LGPD."""
    db = get_client()
    res = (
        db.table("profiles")
        .select(
            "id, name, matricula, avatar_url, active, consent_given, consent_at, "
            "terms_version, consent_revoked_at, created_at"
        )
        .eq("id", profile_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Perfil não encontrado.")
    return res.data[0]


MULTIPART_FRAMES_SCHEMA = {
    "requestBody": {
        "required": True,
        "content": {
            "multipart/form-data": {
                "schema": {
                    "type": "object",
                    "required": ["frames"],
                    "properties": {
                        "frames": {"type": "array", "items": {"type": "string", "format": "binary"}},
                    },
                }
            }
        },
    }
}


@router.post(
    "/{profile_id}/refresh-embedding",
    response_model=EnrollResponse,
    openapi_extra=MULTIPART_FRAMES_SCHEMA,
)
async def refresh_embedding_endpoint(
    profile_id: str,
    request: Request,
    response: Response,
    identity: dict = Depends(require_tutor_or_window),
):
    """Recadastro biométrico. O corpo só é lido após validar a identidade e o limite de taxa."""
    from app.routers.enroll import read_frames_form
    from app.routers.recognize import check_rate_limit

    check_rate_limit(identity["user_id"], limit=settings.upload_rate_limit_per_minute, bucket="refresh")
    _, frames = await read_frames_form(request, settings.max_enroll_frames, max_fields=4)
    if not frames:
        raise HTTPException(422, "Campo 'frames' é obrigatório.")
    return await refresh_embedding_route(profile_id=profile_id, frames=frames, response=response)


async def refresh_embedding_route(
    profile_id: str,
    frames: list[UploadFile] = File(...),  # noqa: B008
    response: Response = Response(),
):
    """Atualiza o vetor biométrico do perfil com novas fotos, mantendo id e histórico.

    Durante a janela cadastral (28/09/2026 – 02/10/2026 GMT-3), aceita requisições
    sem token de tutor. Fora desse período, exige autenticação JWT (role=tutor).
    """
    if len(frames) > settings.max_enroll_frames:
        raise HTTPException(
            400,
            f"Excesso de fotos enviadas. O limite máximo é de {settings.max_enroll_frames} fotos.",
        )
    if len(frames) < 3:
        raise HTTPException(400, "Envie ao menos 3 fotos para atualizar a biometria.")

    images: list[bytes] = []
    for frame in frames:
        data = await frame.read()
        validate_image(frame.content_type, len(data), data)
        images.append(data)

    try:
        result = await asyncio.to_thread(refresh_embedding, profile_id, images)
    except ProfileNotFound as exc:
        raise HTTPException(404, "Perfil não encontrado.") from exc
    except EnrollError as exc:
        raise HTTPException(422, str(exc)) from exc

    # Header de auditoria para rastreabilidade da janela cadastral
    if response is not None:
        window_header = "active" if is_enrollment_window_active() else "inactive"
        response.headers["X-Enrollment-Window"] = window_header
    return result



def _rpc_or_503(name: str, params: dict) -> dict:
    try:
        data = get_client().rpc(name, params).execute().data
    except Exception as exc:
        log.error("Falha na operação LGPD %s: %s", name, type(exc).__name__)
        raise HTTPException(status_code=503, detail="Banco indisponível. Nenhuma alteração foi aplicada.") from exc
    if not isinstance(data, dict):
        raise HTTPException(status_code=503, detail="Resposta inesperada do banco.")
    return data


@router.post(
    "/{profile_id}/revoke-consent",
    response_model=RevokeConsentResponse,
)
def revoke_consent(profile_id: str, tutor: dict = Depends(verify_tutor_token)):
    """Revoga o consentimento LGPD: inativa o perfil e remove templates numa única transação."""
    result = _rpc_or_503(
        "revoke_profile_consent",
        {"p_profile_id": profile_id, "p_actor": tutor.get("user_id") or None},
    )
    if not result.get("found"):
        raise HTTPException(status_code=404, detail="Perfil não encontrado.")
    invalidate_embeddings_cache()
    log.info("Consentimento revogado para perfil %s.", profile_id)
    return {
        "revoked": True,
        "profile_id": profile_id,
        "name": result.get("name") or "",
        "revoked_at": str(result.get("revoked_at") or ""),
        "message": "Consentimento revogado. Dados biométricos expurgados e perfil inativado.",
    }


@router.delete("/{profile_id}")
def delete_profile(profile_id: str, tutor: dict = Depends(verify_tutor_token)):
    """Elimina perfil, templates, logs e sessões numa única transação (LGPD Art. 18).

    Recusa (409) quando há justificativas de frequência: a política de retenção
    desse histórico (DP-6) ainda depende de decisão institucional.
    """
    result = _rpc_or_503(
        "delete_profile_cascade",
        {"p_profile_id": profile_id, "p_actor": tutor.get("user_id") or None},
    )
    if not result.get("found"):
        raise HTTPException(status_code=404, detail="Perfil não encontrado.")
    if not result.get("deleted"):
        raise HTTPException(
            status_code=409,
            detail="Perfil possui justificativas de frequência; exclusão aguarda decisão de retenção (DP-6).",
        )
    invalidate_embeddings_cache()
    log.info("Perfil %s eliminado definitivamente (LGPD).", profile_id)
    return {
        "deleted": True,
        "profile_id": profile_id,
        "message": "Dados biométricos e perfil eliminados definitivamente com sucesso.",
    }
