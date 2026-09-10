"""Router de manutenção e tarefas periódicas (Cloud Scheduler / Cron)."""
from __future__ import annotations

from datetime import datetime, timezone
import logging

from fastapi import APIRouter, Depends

from app.deps import verify_cron_or_api_key
from app.services.face_service import invalidate_embeddings_cache
from app.services.session_service import close_stale_sessions

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/maintenance", tags=["maintenance"])


@router.post("/cleanup", dependencies=[Depends(verify_cron_or_api_key)])
def run_maintenance_cleanup():
    """Executa tarefas periódicas de manutenção.

    1. Fecha sessões esquecidas em aberto (> max_session_hours), aplicando o teto
       justo regulamentar (max_session_cap_hours) e marcando auto_closed = True.
    2. Invalida o cache local de embeddings em memória para sincronizar novos integrantes.

    Protegido por token OIDC do Cloud Scheduler (Service Account) ou X-API-Key administrativa.
    """
    now = datetime.now(timezone.utc)
    log.info("Iniciando rotina de manutenção periódica (cleanup)...")

    # 1. Sweep de sessões esquecidas
    stale_res = close_stale_sessions()

    # 2. Invalidação de cache biométrico
    invalidate_embeddings_cache()

    log.info("Rotina de manutenção finalizada. Resultado: %s", stale_res)

    return {
        "status": "ok",
        "timestamp": now.isoformat(),
        "sessions_sweep": stale_res,
        "cache_invalidated": True,
    }
