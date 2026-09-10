"""Router de gestão de perfis e direitos do titular LGPD (Art. 18 e Art. 8 § 5º)."""
from __future__ import annotations

from datetime import datetime, timezone
import logging

from fastapi import APIRouter, Depends, HTTPException

from app.db.supabase_client import get_client
from app.deps import verify_api_key
from app.services.face_service import invalidate_embeddings_cache

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/profiles", tags=["profiles"])


@router.get("/{profile_id}", dependencies=[Depends(verify_api_key)])
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


@router.post("/{profile_id}/revoke-consent", dependencies=[Depends(verify_api_key)])
def revoke_consent(profile_id: str):
    """Revoga o consentimento LGPD do titular: expurga biometria e inativa o perfil."""
    db = get_client()
    now_iso = datetime.now(timezone.utc).isoformat()

    # Verifica se perfil existe
    check = db.table("profiles").select("id, name, active").eq("id", profile_id).execute()
    if not check.data:
        raise HTTPException(status_code=404, detail="Perfil não encontrado.")

    # 1. Inativa o perfil e marca revogação
    db.table("profiles").update({
        "active": False,
        "consent_given": False,
        "consent_revoked_at": now_iso,
    }).eq("id", profile_id).execute()

    # 2. Expurga vetores biométricos associados
    db.table("face_embeddings").delete().eq("profile_id", profile_id).execute()

    # 3. Invalida cache local do serviço facial
    invalidate_embeddings_cache()

    log.info("Consentimento LGPD revogado para perfil %s. Biometria expurgada.", profile_id)
    return {
        "revoked": True,
        "profile_id": profile_id,
        "revoked_at": now_iso,
        "message": "Consentimento revogado. Dados biométricos expurgados e perfil inativado.",
    }


@router.delete("/{profile_id}", dependencies=[Depends(verify_api_key)])
def delete_profile(profile_id: str):
    """Elimina definitivamente o perfil e todos os dados biométricos (LGPD Art. 18)."""
    db = get_client()

    check = db.table("profiles").select("id, name").eq("id", profile_id).execute()
    if not check.data:
        raise HTTPException(status_code=404, detail="Perfil não encontrado.")

    # 1. Remove biometria
    db.table("face_embeddings").delete().eq("profile_id", profile_id).execute()

    # 2. Remove logs faciais
    try:
        db.table("face_logs").delete().eq("profile_id", profile_id).execute()
    except Exception as exc:  # noqa: BLE001
        log.warning("Falha ao limpar face_logs para %s: %s", profile_id, exc)

    # 3. Remove perfil (presenças em sessions são mantidas ou deletadas conforme cascade)
    db.table("profiles").delete().eq("id", profile_id).execute()

    # 4. Invalida cache em memória
    invalidate_embeddings_cache()

    log.info("Perfil %s eliminado definitivamente por solicitação do titular (LGPD).", profile_id)
    return {
        "deleted": True,
        "profile_id": profile_id,
        "message": "Dados biométricos e perfil eliminados definitivamente com sucesso.",
    }
