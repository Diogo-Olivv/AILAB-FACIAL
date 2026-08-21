"""Extracao e identificacao de embeddings faciais.

Usa InsightFace (buffalo_s) com execucao em CPU e produz vetores 512-D
normalizados (L2). A extracao e reutilizada tanto pelo reconhecimento quanto
pelo cadastro de novos integrantes.
"""
from __future__ import annotations

import io
import os

import numpy as np
from PIL import Image

from app.config import settings
from app.db.supabase_client import get_client

_MIN_DET_SCORE = 0.70
_analyzer = None


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
        allowed_modules=["detection", "recognition"],  # dispensa landmark/genderage p/ poupar RAM
    )
    fa.prepare(ctx_id=0, det_size=(320, 320))
    return fa


def _analyzer_instance():
    global _analyzer
    if _analyzer is None:
        _analyzer = _get_analyzer()
    return _analyzer


def warmup() -> None:
    """Carrega o modelo no startup para nao pagar o custo no primeiro request."""
    _analyzer_instance()


def extract_embedding(image_bytes: bytes) -> np.ndarray | None:
    """Extrai o embedding facial 512-D normalizado de uma imagem.

    Retorna o vetor da face de maior score, ou None se nenhuma face confiavel
    for detectada.
    """
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    bgr = np.array(img)[:, :, ::-1]

    faces = _analyzer_instance().get(bgr)
    if not faces:
        return None

    face = max(faces, key=lambda f: float(f.det_score))
    if float(face.det_score) < _MIN_DET_SCORE:
        return None

    enc = np.array(face.embedding, dtype=np.float64)
    norm = np.linalg.norm(enc)
    if norm == 0:
        return None
    return enc / norm


def _load_embeddings() -> tuple[list[str], list[str], np.ndarray] | None:
    """Carrega embeddings de integrantes ativos da tabela isolada."""
    rows = (
        get_client()
        .table("face_embeddings")
        .select("profile_id, embedding, profiles!inner(active, name)")
        .eq("profiles.active", True)
        .execute()
    ).data or []
    if not rows:
        return None
    ids = [r["profile_id"] for r in rows]
    names = [r["profiles"]["name"] for r in rows]
    matrix = np.array([r["embedding"] for r in rows], dtype=np.float64)
    return ids, names, matrix


def identify(image_bytes: bytes) -> dict | None:
    """Retorna {profile_id, name, confidence} do integrante reconhecido, ou None."""
    enc = extract_embedding(image_bytes)
    if enc is None:
        return None

    loaded = _load_embeddings()
    if loaded is None:
        return None
    ids, names, matrix = loaded

    dists = np.linalg.norm(matrix - enc, axis=1)
    idx = int(np.argmin(dists))
    dist = float(dists[idx])

    if dist > settings.face_threshold:
        return None

    return {
        "profile_id": ids[idx],
        "name": names[idx],
        "confidence": round(float(1.0 - dist / settings.face_threshold), 4),
    }
