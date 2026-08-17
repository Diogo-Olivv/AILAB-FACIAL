"""Identifica rostos em frames JPEG/PNG contra embeddings no Supabase.

Usa InsightFace (buffalo_s) com execução em CPU — sem CUDA necessário.
"""
from __future__ import annotations

import io
from functools import lru_cache

import numpy as np
from PIL import Image

from app.config import settings
from app.db.supabase_client import get_client


def _get_analyzer():
    """Lazy-init do FaceAnalysis (carrega modelos uma única vez)."""
    try:
        from insightface.app import FaceAnalysis  # type: ignore
    except ImportError as exc:
        raise RuntimeError(
            "insightface não instalado. Execute: pip install insightface onnxruntime"
        ) from exc

    fa = FaceAnalysis(name="buffalo_s", providers=["CPUExecutionProvider"])
    fa.prepare(ctx_id=0, det_size=(320, 320))
    return fa


# Inicializado na primeira chamada
_analyzer = None


def _analyzer_instance():
    global _analyzer
    if _analyzer is None:
        _analyzer = _get_analyzer()
    return _analyzer


def _load_profiles() -> list[dict]:
    """Carrega todos os perfis ativos com embedding do Supabase."""
    rows = (
        get_client()
        .table("profiles")
        .select("id, embedding")
        .eq("active", True)
        .execute()
    )
    return rows.data or []


def identify(image_bytes: bytes) -> dict | None:
    """Extrai embedding do frame e retorna {profile_id, confidence} ou None.

    Args:
        image_bytes: conteúdo bruto da imagem (JPEG, PNG ou WebP).

    Returns:
        dict com ``profile_id`` e ``confidence`` (0–1), ou None se não reconhecido.
    """
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    arr = np.array(img)
    # InsightFace espera BGR
    bgr = arr[:, :, ::-1]

    fa = _analyzer_instance()
    faces = fa.get(bgr)
    if not faces:
        return None

    # Pega a face com maior score de detecção
    face = max(faces, key=lambda f: float(f.det_score))
    if float(face.det_score) < 0.70:
        return None

    enc = np.array(face.embedding, dtype=np.float64)
    norm = np.linalg.norm(enc)
    if norm == 0:
        return None
    enc /= norm

    profiles = _load_profiles()
    if not profiles:
        return None

    ids = [p["id"] for p in profiles]
    matrix = np.array([p["embedding"] for p in profiles], dtype=np.float64)

    dists = np.linalg.norm(matrix - enc, axis=1)
    idx = int(np.argmin(dists))
    dist = float(dists[idx])

    if dist > settings.face_threshold:
        return None

    return {
        "profile_id": ids[idx],
        "confidence": round(float(1.0 - dist / settings.face_threshold), 4),
    }
