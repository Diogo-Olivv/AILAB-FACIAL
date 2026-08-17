"""Cadastro de integrantes: agrega N fotos num embedding medio normalizado."""
from __future__ import annotations

from datetime import datetime, timezone

import numpy as np

from app.db.supabase_client import get_client
from app.services.face_service import extract_embedding


class EnrollError(Exception):
    """Erro de validacao de cadastro (falta de consentimento, sem rosto, etc.)."""


def _mean_embedding(images: list[bytes]) -> tuple[np.ndarray, int]:
    encs = [enc for img in images if (enc := extract_embedding(img)) is not None]
    if not encs:
        raise EnrollError("Nenhum rosto valido detectado nas fotos enviadas.")

    mean = np.mean(encs, axis=0)
    norm = np.linalg.norm(mean)
    if norm == 0:
        raise EnrollError("Embedding resultante invalido.")
    return mean / norm, len(encs)


def enroll(name: str, matricula: str | None, images: list[bytes], consent: bool) -> dict:
    """Cria o perfil e persiste o embedding biometrico numa tabela isolada."""
    if not consent:
        raise EnrollError("Consentimento LGPD obrigatorio para cadastro biometrico.")
    if not name.strip():
        raise EnrollError("Nome obrigatorio.")

    vector, used = _mean_embedding(images)
    db = get_client()

    profile = db.table("profiles").insert({
        "name": name.strip(),
        "matricula": (matricula or "").strip() or None,
        "consent_given": True,
        "consent_at": datetime.now(timezone.utc).isoformat(),
    }).execute()
    profile_id = profile.data[0]["id"]

    try:
        db.table("face_embeddings").insert({
            "profile_id": profile_id,
            "embedding": vector.tolist(),
        }).execute()
    except Exception:
        db.table("profiles").delete().eq("id", profile_id).execute()
        raise

    return {"profile_id": profile_id, "name": name.strip(), "photos_used": used}
