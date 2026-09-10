"""Extracao e identificacao de embeddings faciais com calibração e antifraude.

Usa InsightFace (buffalo_s) com execucao em CPU e produz vetores 512-D
normalizados (L2). Integra:
1. Seleção espacial da face principal (área e centralidade, rejeitando transeuntes).
2. Avaliação de qualidade FIQA (descarte de blur) e vivacidade passiva (PAD).
3. Limiar rigoroso calibrado (face_threshold <= 0.80 / cos_theta >= 0.68).
4. Métrica de confiança sigmoidal via Platt Scaling.
5. Cache local em memória dos embeddings ativos para evitar gargalo N+1.
"""
from __future__ import annotations

import io
import logging
import os
import time
from typing import Any, Tuple

import numpy as np
from PIL import Image

from app.config import settings
from app.db.supabase_client import get_client
from app.services.liveness_service import check_image_quality, verify_liveness

log = logging.getLogger(__name__)

_MIN_DET_SCORE = 0.70
_analyzer = None

# Cache local de embeddings ativos em memória
_CACHE_TTL_SECONDS = 180.0  # 3 minutos
_cached_ids: list[str] = []
_cached_names: list[str] = []
_cached_matrix: np.ndarray | None = None
_last_cache_time: float = 0.0


def invalidate_embeddings_cache() -> None:
    """Invalida o cache local de embeddings forçando recarregamento no próximo request."""
    global _last_cache_time, _cached_matrix
    _last_cache_time = 0.0
    _cached_matrix = None


def _get_analyzer():
    """Lazy-init do FaceAnalysis (carrega modelos uma unica vez)."""
    try:
        from insightface.app import FaceAnalysis  # type: ignore
    except ImportError as exc:
        raise RuntimeError(
            "insightface nao instalado. Execute: pip install insightface onnxruntime"
        ) from exc

    fa = FaceAnalysis(
        name="buffalo_s",
        root=os.path.expanduser(settings.insightface_root),
        providers=["CPUExecutionProvider"],
        allowed_modules=["detection", "recognition"],
    )
    fa.prepare(ctx_id=0, det_size=(320, 320))
    return fa


def _analyzer_instance():
    global _analyzer
    if _analyzer is None:
        _analyzer = _get_analyzer()
    return _analyzer


def is_model_loaded() -> bool:
    """Informa se o pipeline do InsightFace foi instanciado na memória."""
    return _analyzer is not None


def warmup() -> None:
    """Aquece o pipeline completo: detecção, ArcFace 512-D, FIQA e PAD passivo."""
    try:
        fa = _analyzer_instance()
        # 1. Warmup do modelo de detecção (SCRFD)
        dummy_det = np.zeros((320, 320, 3), dtype=np.uint8)
        fa.get(dummy_det)

        # 2. Warmup explícito do modelo de reconhecimento (ArcFace 512-D)
        rec_model = getattr(fa, "models", {}).get("recognition")
        if rec_model is not None:
            dummy_crop = np.zeros((112, 112, 3), dtype=np.uint8)
            if hasattr(rec_model, "get_feat"):
                rec_model.get_feat(dummy_crop)
            elif hasattr(rec_model, "get"):
                try:
                    from insightface.app.common import Face  # type: ignore
                    f = Face(bbox=np.array([0, 0, 112, 112]), kps=np.zeros((5, 2)))
                    rec_model.get(dummy_crop, f)
                except Exception:
                    pass

        # 3. Warmup do pipeline de qualidade FIQA e PAD passivo
        dummy_small = np.zeros((112, 112, 3), dtype=np.uint8)
        check_image_quality(dummy_small)
        verify_liveness(dummy_small)

        log.info("Pipeline biométrico completo aquecido com sucesso.")
    except Exception as exc:
        log.warning("Warmup falhou (continuando sem warmup prévio): %s", exc)


def select_primary_face(faces: list, img_w: int, img_h: int) -> Tuple[Any | None, str]:
    """Seleciona a face mais proeminente e central, descartando transeuntes e faces minúsculas.

    Retorna: (best_face, status_code)
    """
    if not faces:
        return None, "no_face"

    valid_faces = []
    center_x, center_y = img_w / 2.0, img_h / 2.0
    diag = np.hypot(img_w, img_h)

    for f in faces:
        box = [int(v) for v in f.bbox]
        w = max(0, box[2] - box[0])
        h = max(0, box[3] - box[1])

        if w < settings.min_face_size or h < settings.min_face_size:
            continue
        if float(f.det_score) < _MIN_DET_SCORE:
            continue

        fx = (box[0] + box[2]) / 2.0
        fy = (box[1] + box[3]) / 2.0
        dist_center = np.hypot(fx - center_x, fy - center_y)
        norm_dist = dist_center / (diag / 2.0 + 1e-5)
        area_fraction = (w * h) / (img_w * img_h)

        # Prioridade geométrica: área e centralidade sobrepõem pequenas variações de det_score
        priority = area_fraction * (1.0 / (1.0 + norm_dist)) * float(f.det_score)
        valid_faces.append((priority, f))

    if not valid_faces:
        return None, "face_too_small"

    valid_faces.sort(key=lambda x: x[0], reverse=True)
    return valid_faces[0][1], "ok"


def crop_face(bgr: np.ndarray, bbox: list | np.ndarray) -> np.ndarray:
    """Extrai o recorte da face com 10% de margem contextual."""
    ih, iw = bgr.shape[:2]
    x1, y1, x2, y2 = [int(v) for v in bbox]
    margin_x = int((x2 - x1) * 0.1)
    margin_y = int((y2 - y1) * 0.1)
    x1 = max(0, x1 - margin_x)
    y1 = max(0, y1 - margin_y)
    x2 = min(iw, x2 + margin_x)
    y2 = min(ih, y2 + margin_y)
    return bgr[y1:y2, x1:x2]


def compute_calibrated_confidence(cosine_sim: float) -> float:
    """Calcula a probabilidade sigmoidal calibrada via Platt Scaling.

    Similaridade cosseno de 0.70 mapeia para ~50% de confiança;
    0.80 mapeia para ~92%;
    0.60 mapeia para ~8%.
    """
    logit = 25.0 * (cosine_sim - 0.70)
    # Clip para estabilidade numérica
    logit = float(np.clip(logit, -15.0, 15.0))
    conf = 1.0 / (1.0 + float(np.exp(-logit)))
    return round(float(np.clip(conf, 0.01, 0.9999)), 4)


def extract_primary_face_data(
    image_bytes: bytes,
    check_quality: bool = True,
    check_pad: bool = True,
) -> Tuple[np.ndarray | None, np.ndarray | None, str, str]:
    """Processa a imagem e retorna (face_crop, embedding, status, message)."""
    try:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception:
        return None, None, "invalid_image", "Formato de imagem inválido ou corrompido."

    bgr = np.array(img)[:, :, ::-1]
    ih, iw = bgr.shape[:2]

    faces = _analyzer_instance().get(bgr)
    face, status = select_primary_face(faces, iw, ih)
    if face is None:
        if status == "face_too_small":
            return None, None, "face_too_small", "Rosto muito distante ou pequeno. Aproxime-se."
        return None, None, "no_face", "Nenhum rosto confiável detectado no enquadramento."

    face_crop = crop_face(bgr, face.bbox)

    # 1. Avaliação de Qualidade Facial (FIQA)
    if check_quality:
        quality_ok, score, reason = check_image_quality(face_crop)
        if not quality_ok:
            if reason == "blur_detected":
                return None, None, "blur_detected", "Imagem borrada. Mantenha a câmera estável."
            return None, None, reason, "Qualidade facial insuficiente para identificação."

    # 2. Detecção de Vivacidade Passiva (PAD)
    if check_pad:
        is_live, pad_score, pad_reason = verify_liveness(face_crop)
        if not is_live:
            return None, None, "spoof_detected", "Falha na verificação de vivacidade presencial."

    # 3. Extração do Embedding L2 normalizado
    enc = np.array(face.embedding, dtype=np.float64)
    norm = np.linalg.norm(enc)
    if norm == 0:
        return None, None, "zero_embedding", "Falha ao gerar vetor biométrico."

    normalized_enc = enc / norm
    return face_crop, normalized_enc, "ok", "Face processada com sucesso."


def extract_embedding(image_bytes: bytes) -> np.ndarray | None:
    """Extrai o embedding facial 512-D normalizado (compatibilidade retroativa)."""
    _, enc, status, _ = extract_primary_face_data(image_bytes, check_quality=False, check_pad=False)
    return enc


def _load_embeddings(use_cache: bool = True) -> tuple[list[str], list[str], np.ndarray] | None:
    """Carrega embeddings de integrantes ativos com cache local em memória."""
    global _cached_ids, _cached_names, _cached_matrix, _last_cache_time
    now = time.time()

    if (
        use_cache
        and _cached_matrix is not None
        and (now - _last_cache_time) < _CACHE_TTL_SECONDS
    ):
        return _cached_ids, _cached_names, _cached_matrix

    try:
        rows = (
            get_client()
            .table("face_embeddings")
            .select("profile_id, embedding, profiles!inner(active, name)")
            .eq("profiles.active", True)
            .execute()
        ).data or []
    except Exception as exc:
        log.error("Erro ao consultar embeddings no Supabase: %s", exc)
        rows = []

    if not rows:
        _cached_ids, _cached_names, _cached_matrix = [], [], None
        return None

    _cached_ids = [r["profile_id"] for r in rows]
    _cached_names = [r["profiles"]["name"] for r in rows]
    _cached_matrix = np.array([r["embedding"] for r in rows], dtype=np.float64)
    _last_cache_time = now
    return _cached_ids, _cached_names, _cached_matrix


def _match_face_pgvector(enc: np.ndarray) -> dict | None:
    """Busca o perfil mais similar via RPC match_face do Supabase com pgvector e HNSW."""
    try:
        db = get_client()
        res = db.rpc(
            "match_face",
            {
                "query_embedding": enc.tolist(),
                "match_threshold": settings.face_min_cosine,
                "match_count": 1,
            },
        ).execute()
        rows = res.data or []
        if not rows:
            return {
                "recognized": False,
                "status": "not_recognized",
                "message": "Rosto não reconhecido na base.",
            }
        top = rows[0]
        cosine_sim = float(top["similarity"])
        # Para vetores unitários L2: dist = sqrt(2 * (1 - cos))
        euclidean_dist = float(np.sqrt(max(0.0, 2.0 * (1.0 - cosine_sim))))
        confidence = compute_calibrated_confidence(cosine_sim)
        return {
            "recognized": True,
            "status": "ok",
            "profile_id": top["profile_id"],
            "name": top["name"],
            "confidence": confidence,
            "distance": round(euclidean_dist, 4),
            "cosine_similarity": round(cosine_sim, 4),
        }
    except Exception as exc:
        log.warning("Falha na busca pgvector via RPC, acionando fallback em memória: %s", exc)
        return None


def identify(image_bytes: bytes) -> dict:
    """Identifica o integrante com checagem de qualidade, vivacidade e limiar calibrado.

    Retorna um dicionário com `recognized: bool`, `status: str`, `message: str` e
    detalhes do perfil reconhecido quando válido.
    """
    face_crop, enc, status, message = extract_primary_face_data(
        image_bytes,
        check_quality=True,
        check_pad=True,
    )
    if enc is None:
        return {
            "recognized": False,
            "status": status,
            "message": message,
        }

    # 1. Tentativa via pgvector HNSW (se habilitado)
    if settings.use_pgvector:
        pg_res = _match_face_pgvector(enc)
        if pg_res is not None:
            return pg_res
        log.info("Fallback para busca de embeddings em memória RAM.")

    # 2. Busca em memória RAM (matriz NumPy com cache TTL)
    loaded = _load_embeddings()
    if loaded is None:
        return {
            "recognized": False,
            "status": "empty_database",
            "message": "Nenhum perfil ativo cadastrado no sistema.",
        }

    ids, names, matrix = loaded

    # 1. Distância Euclidiana e Similaridade Cosseno
    dists = np.linalg.norm(matrix - enc, axis=1)
    idx = int(np.argmin(dists))
    dist = float(dists[idx])

    # Para vetores com ||u|| = ||v|| = 1: cos(theta) = 1 - (dist^2) / 2
    cosine_sim = float(np.dot(matrix[idx], enc))

    # 2. Verificação do Limiar Estrito Calibrado
    if dist > settings.face_threshold or cosine_sim < settings.face_min_cosine:
        return {
            "recognized": False,
            "status": "not_recognized",
            "message": "Rosto não reconhecido na base.",
            "distance": round(dist, 4),
            "cosine_similarity": round(cosine_sim, 4),
        }

    # 3. Confiança Calibrada por Regressão Logística (Platt Scaling)
    confidence = compute_calibrated_confidence(cosine_sim)

    return {
        "recognized": True,
        "status": "ok",
        "profile_id": ids[idx],
        "name": names[idx],
        "confidence": confidence,
        "distance": round(dist, 4),
        "cosine_similarity": round(cosine_sim, 4),
    }
