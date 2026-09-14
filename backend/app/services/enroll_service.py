"""Cadastro de integrantes: validação de consistência intra-burst e checagem 1:N."""
from __future__ import annotations

from datetime import datetime, timezone
import logging

import numpy as np

from app.config import settings
from app.db.supabase_client import get_client
from app.services.face_service import (
    _load_embeddings,
    extract_primary_face_data,
    invalidate_embeddings_cache,
)

log = logging.getLogger(__name__)


class EnrollError(Exception):
    """Erro de validação de cadastro biométrico (qualidade, consistência, duplicidade)."""


class ProfileNotFound(Exception):
    """Perfil alvo inexistente para atualização biométrica."""


def _validate_intra_burst_consistency(
    encs: list[np.ndarray],
) -> tuple[np.ndarray, int]:
    """Valida a consistência par a par dos embeddings e retorna a média normalizada.

    Garante que todas as fotos pertencem à mesma pessoa com postura e iluminação
    consistentes (distância par a par <= enroll_max_pairwise_distance).
    """
    n = len(encs)
    if n < 3:
        raise EnrollError(
            f"Poucas fotos válidas obtidas ({n}/{n}). São necessárias ao menos 3 fotos nítidas."
        )

    # Verificação de distância par a par
    max_dist = 0.0
    for i in range(n):
        for j in range(i + 1, n):
            dist = float(np.linalg.norm(encs[i] - encs[j]))
            if dist > max_dist:
                max_dist = dist

    if max_dist > settings.enroll_max_pairwise_distance:
        log.warning(
            "Rejeição de enrollment por inconsistência intra-burst: max_dist=%.4f > limiar=%.4f",
            max_dist,
            settings.enroll_max_pairwise_distance,
        )
        raise EnrollError(
            "As fotos capturadas apresentaram rostos divergentes ou instáveis "
            f"(variação de {max_dist:.2f} > limite {settings.enroll_max_pairwise_distance}). "
            "Certifique-se de manter o rosto fixo de frente para a câmera durante os disparos."
        )

    mean = np.mean(encs, axis=0)
    norm = np.linalg.norm(mean)
    if norm == 0:
        raise EnrollError("Embedding médio resultante inválido.")

    normalized_mean = mean / norm
    return normalized_mean, n


def _check_1_to_n_duplicate(mean_vector: np.ndarray) -> None:
    """Verifica se o vetor já possui correspondência biométrica na base ativa."""
    loaded = _load_embeddings(use_cache=False)
    if loaded is None:
        return

    ids, names, matrix = loaded
    dists = np.linalg.norm(matrix - mean_vector, axis=1)
    min_idx = int(np.argmin(dists))
    min_dist = float(dists[min_idx])
    cosine_sim = float(np.dot(matrix[min_idx], mean_vector))

    if min_dist <= settings.face_threshold or cosine_sim >= settings.face_min_cosine:
        existing_name = names[min_idx]
        log.warning(
            "Tentativa de cadastro duplicado: similaridade %.4f com '%s' (%s)",
            cosine_sim,
            existing_name,
            ids[min_idx],
        )
        raise EnrollError(
            f"Este rosto já está cadastrado no sistema para o integrante '{existing_name}' "
            f"(similaridade de {cosine_sim * 100:.1f}%). Cadastros duplicados não são permitidos."
        )


def enroll(name: str, matricula: str | None, images: list[bytes], consent: bool) -> dict:
    """Processa o cadastro biométrico com garantias de consistência e anti-duplicidade."""
    if not consent:
        raise EnrollError("Consentimento LGPD obrigatório para cadastro biométrico.")
    if not name.strip():
        raise EnrollError("Nome obrigatório.")
    if not images:
        raise EnrollError("Nenhuma foto recebida para cadastro.")

    valid_encs: list[np.ndarray] = []
    errors_detail: list[str] = []

    for idx, img in enumerate(images):
        _, enc, status, message = extract_primary_face_data(
            img,
            check_quality=True,
            check_pad=True,
        )
        if enc is not None:
            valid_encs.append(enc)
        else:
            errors_detail.append(f"Foto {idx + 1}: {message}")

    if not valid_encs:
        raise EnrollError(
            "Nenhum rosto válido detectado nas fotos. " + " | ".join(errors_detail[:2])
        )

    # 1. Validação de consistência entre as fotos do burst
    mean_vector, photos_used = _validate_intra_burst_consistency(valid_encs)

    # 2. Verificação de duplicidade 1:N contra a base existente
    _check_1_to_n_duplicate(mean_vector)

    db = get_client()

    # 3. Persistência do perfil
    profile = (
        db.table("profiles")
        .insert({
            "name": name.strip(),
            "matricula": (matricula or "").strip() or None,
            "consent_given": True,
            "consent_at": datetime.now(timezone.utc).isoformat(),
        })
        .execute()
    )
    profile_id = profile.data[0]["id"]

    # 4. Persistência do vetor biométrico
    try:
        vec_list = mean_vector.tolist()
        embedding_payload = {
            "profile_id": profile_id,
            "embedding": vec_list,
            "vec": vec_list,
        }

        db.table("face_embeddings").insert(embedding_payload).execute()
        # Invalida o cache para que o novo membro possa bater ponto imediatamente
        invalidate_embeddings_cache()
    except Exception:
        db.table("profiles").delete().eq("id", profile_id).execute()
        raise

    return {"profile_id": profile_id, "name": name.strip(), "photos_used": photos_used}


def _guard_against_identity_swap(profile_id: str, mean_vector: np.ndarray) -> None:
    """Impede sobrescrever a biometria de um perfil com o rosto de outro integrante ativo."""
    loaded = _load_embeddings(use_cache=False)
    if loaded is None:
        return

    ids, names, matrix = loaded
    others = [(i, n, v) for i, n, v in zip(ids, names, matrix) if i != profile_id]
    if not others:
        return

    other_matrix = np.array([v for _, _, v in others], dtype=np.float64)
    dists = np.linalg.norm(other_matrix - mean_vector, axis=1)
    nearest = int(np.argmin(dists))
    cosine_sim = float(np.dot(other_matrix[nearest], mean_vector))

    if cosine_sim >= settings.face_min_cosine:
        raise EnrollError(
            f"As fotos correspondem a outro integrante já cadastrado ('{others[nearest][1]}', "
            f"similaridade de {cosine_sim * 100:.1f}%). Atualização abortada por segurança."
        )


def refresh_embedding(profile_id: str, images: list[bytes]) -> dict:
    """Recalcula e substitui o vetor biométrico de um perfil existente, preservando seu histórico."""
    if not images:
        raise EnrollError("Nenhuma foto recebida para atualização.")

    db = get_client()
    profile = (
        db.table("profiles")
        .select("id, name, active")
        .eq("id", profile_id)
        .execute()
    )
    if not profile.data:
        raise ProfileNotFound(profile_id)

    name = profile.data[0]["name"]

    valid_encs: list[np.ndarray] = []
    errors_detail: list[str] = []
    for idx, img in enumerate(images):
        _, enc, _, message = extract_primary_face_data(img, check_quality=True, check_pad=True)
        if enc is not None:
            valid_encs.append(enc)
        else:
            errors_detail.append(f"Foto {idx + 1}: {message}")

    if not valid_encs:
        raise EnrollError(
            "Nenhum rosto válido detectado nas fotos. " + " | ".join(errors_detail[:2])
        )

    mean_vector, photos_used = _validate_intra_burst_consistency(valid_encs)

    # Guarda de troca de identidade: impede sobrescrever a biometria com o rosto de outro membro
    _guard_against_identity_swap(profile_id, mean_vector)

    vec_list = mean_vector.tolist()
    payload = {
        "embedding": vec_list,
        "vec": vec_list,
    }

    existing = db.table("face_embeddings").select("profile_id").eq("profile_id", profile_id).execute()
    if existing.data:
        db.table("face_embeddings").update(payload).eq("profile_id", profile_id).execute()
    else:
        payload["profile_id"] = profile_id
        db.table("face_embeddings").insert(payload).execute()

    invalidate_embeddings_cache()
    return {"profile_id": profile_id, "name": name, "photos_used": photos_used}
