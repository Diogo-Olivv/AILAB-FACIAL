"""Sondas de saúde.

/health        → o processo está vivo (não consulta dependências).
/health/ready  → o serviço consegue processar reconhecimento: modelos carregados,
                 PAD disponível quando exigido e banco alcançável. Responde 503
                 enquanto alguma dependência obrigatória estiver indisponível.
O corpo não expõe caminhos, versões nem detalhes internos.
"""
from __future__ import annotations

import logging
import threading
import time

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.config import settings
from app.db.supabase_client import get_client
from app.services.face_service import is_model_loaded
from app.services.liveness_service import pad_model_loaded

log = logging.getLogger(__name__)
router = APIRouter(tags=["health"])

_DB_CHECK_TTL_SECONDS = 15.0
_db_lock = threading.Lock()
_db_state: tuple[float, bool] = (0.0, False)


def _database_reachable() -> bool:
    """Consulta mínima ao banco, com cache curto para não gerar carga nas sondas."""
    global _db_state
    now = time.monotonic()
    with _db_lock:
        checked_at, ok = _db_state
        if checked_at and (now - checked_at) < _DB_CHECK_TTL_SECONDS:
            return ok
    try:
        get_client().table("profiles").select("id").limit(1).execute()
        ok = True
    except Exception as exc:  # noqa: BLE001
        log.warning("Sonda de prontidão: banco indisponível (%s).", type(exc).__name__)
        ok = False
    with _db_lock:
        _db_state = (now, ok)
    return ok


def reset_readiness_cache_for_testing() -> None:
    global _db_state
    with _db_lock:
        _db_state = (0.0, False)


@router.get("/health")
def health():
    """Liveness probe: retorna 200 se o processo FastAPI está ativo."""
    return {"status": "ok"}


@router.get("/health/ready")
def readiness():
    """Readiness probe: 200 só quando o reconhecimento pode ser atendido."""
    models_ready = is_model_loaded()
    pad_needed = settings.liveness_enabled and settings.pad_model_required
    pad_ready = pad_model_loaded() if pad_needed else True
    db_ready = _database_reachable()

    ready = models_ready and pad_ready and db_ready
    body = {
        "status": "ready" if ready else ("warming_up" if not models_ready else "degraded"),
        "models_loaded": models_ready,
    }
    return JSONResponse(status_code=200 if ready else 503, content=body)
