"""Router de manutenção e tarefas periódicas (Cloud Scheduler / Cron)."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
import logging

from fastapi import APIRouter, Depends

from app.db.supabase_client import get_client
from app.deps import verify_cron_or_api_key
from app.services.face_service import invalidate_embeddings_cache
from app.services.session_service import close_stale_sessions

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/maintenance", tags=["maintenance"])


def purge_old_face_logs(cutoff_iso: str) -> int:
    """Elimina registros de face_logs anteriores ao cutoff para cumprir retenção LGPD (Art. 16)."""
    try:
        db = get_client()
        res = db.table("face_logs").delete().lt("created_at", cutoff_iso).execute()
        count = len(res.data) if res.data else 0
        log.info("Expurgo de logs biométricos: %d registros removidos (< %s)", count, cutoff_iso)
        return count
    except Exception as exc:
        log.warning("Falha ao expurgar face_logs antigos: %s", exc)
        return 0


@router.post("/cleanup", dependencies=[Depends(verify_cron_or_api_key)])
def run_maintenance_cleanup():
    """Executa tarefas periódicas de manutenção.

    1. Fecha sessões esquecidas em aberto (> max_session_hours), marcando
       voided_at (0h computadas) e auto_closed = True.
    2. Invalida o cache local de embeddings em memória para sincronizar novos integrantes.
    3. Expurga logs de auditoria biométrica antigos (> 90 dias) para conformidade com a LGPD.

    Protegido por token OIDC do Cloud Scheduler (Service Account) ou X-API-Key administrativa.
    """
    now = datetime.now(timezone.utc)
    log.info("Iniciando rotina de manutenção periódica (cleanup)...")

    # 1. Sweep de sessões esquecidas
    stale_res = close_stale_sessions()

    # 2. Invalidação de cache biométrico
    invalidate_embeddings_cache()

    # 3. Expurgo de logs biométricos antigos (> 90 dias / LGPD Art. 16)
    cutoff_logs = (now - timedelta(days=90)).isoformat()
    purged_logs = purge_old_face_logs(cutoff_logs)

    log.info("Rotina de manutenção finalizada. Resultado: sessões=%s, logs_expurgados=%d", stale_res, purged_logs)

    return {
        "status": "ok",
        "timestamp": now.isoformat(),
        "sessions_sweep": stale_res,
        "cache_invalidated": True,
        "purged_face_logs": purged_logs,
    }
