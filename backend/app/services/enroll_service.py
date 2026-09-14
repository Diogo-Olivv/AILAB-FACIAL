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


def _extract_representative_embeddings(
    encs: list[np.ndarray],
) -> list[np.ndarray]:
    """Retorna 1 ou 2 vetores representativos a partir do burst de fotos.

    Se as fotos forem muito uniformes (variação <= 0.60), retorna apenas a média normalizada.
    Se houver variação natural (ex: algumas fotos com óculos e outras sem, distância > 0.60),
    identifica os dois polos (exemplares mais distantes) e calcula os centróides de cada cluster,
    permitindo ao sistema reconhecer o integrante em ambos os estados com alta similaridade.
    """
    if len(encs) <= 2:
        mean = np.mean(encs, axis=0)
        norm = np.linalg.norm(mean)
        return [mean / norm] if norm > 0 else []

    # Encontra o par de fotos mais distante no burst
    max_dist = 0.0
    pair = (0, 1)
    for i in range(len(encs)):
        for j in range(i + 1, len(encs)):
            dist = float(np.linalg.norm(encs[i] - encs[j]))
            if dist > max_dist:
                max_dist = dist
                pair = (i, j)

    # Se a variação for pequena, todas as fotos são da mesma condição visual (ex: todas com óculos)
    if max_dist < 0.60:
        mean = np.mean(encs, axis=0)
        norm = np.linalg.norm(mean)
        return [mean / norm] if norm > 0 else []

    # Separa em 2 grupos baseados na proximidade com cada um dos pólos (ex: com óculos vs sem óculos)
    p1, p2 = encs[pair[0]], encs[pair[1]]
    cluster1, cluster2 = [], []
    for enc in encs:
        d1 = np.linalg.norm(enc - p1)
        d2 = np.linalg.norm(enc - p2)
        if d1 <= d2:
            cluster1.append(enc)
        else:
            cluster2.append(enc)

    reps: list[np.ndarray] = []
    if cluster1:
        m1 = np.mean(cluster1, axis=0)
        norm1 = np.linalg.norm(m1)
        if norm1 > 0:
            reps.append(m1 / norm1)
    if cluster2:
        m2 = np.mean(cluster2, axis=0)
        norm2 = np.linalg.norm(m2)
        if norm2 > 0:
            reps.append(m2 / norm2)

    if not reps:
        mean = np.mean(encs, axis=0)
        return [mean / np.linalg.norm(mean)]
    return reps


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

    # 1. Verificação de consistência intra-burst e anti-duplicidade 1:N
    mean_vector, photos_used = _validate_intra_burst_consistency(valid_encs)
    _check_1_to_n_duplicate(mean_vector)

    rep_vectors = _extract_representative_embeddings(valid_encs)
    for rep in rep_vectors:
        _check_1_to_n_duplicate(rep)

    db = get_client()

    # Criação do perfil
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

    # 4. Persistência dos vetores biométricos (suporta multi-embedding com/sem óculos)
    try:
        payloads = [
            {
                "profile_id": profile_id,
                "embedding": rep.tolist(),
                "vec": rep.tolist(),
            }
            for rep in rep_vectors
        ]

        db.table("face_embeddings").insert(payloads if len(payloads) > 1 else payloads[0]).execute()
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

    rep_vectors = _extract_representative_embeddings(valid_encs)
    for rep in rep_vectors:
        _guard_against_identity_swap(profile_id, rep)

    payloads = [
        {
            "profile_id": profile_id,
            "embedding": rep.tolist(),
            "vec": rep.tolist(),
        }
        for rep in rep_vectors
    ]

    # Substitui os vetores biométricos existentes pelos novos vetores calibrados
    db.table("face_embeddings").delete().eq("profile_id", profile_id).execute()
    db.table("face_embeddings").insert(payloads if len(payloads) > 1 else payloads[0]).execute()

    invalidate_embeddings_cache()
    return {"profile_id": profile_id, "name": name, "photos_used": photos_used}
