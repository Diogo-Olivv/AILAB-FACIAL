"""APScheduler job que dispara o sync Google Sheets a cada N minutos."""
from __future__ import annotations

import logging

from apscheduler.schedulers.background import BackgroundScheduler  # type: ignore

from app.config import settings
from app.services.sheets_service import sync_batch

log = logging.getLogger(__name__)
_scheduler: BackgroundScheduler | None = None


def _job() -> None:
    try:
        result = sync_batch()
        log.info("Sheets sync job finalizado: %s", result)
    except Exception as exc:  # noqa: BLE001
        log.exception("Sheets sync job falhou: %s", exc)


def start_scheduler() -> None:
    global _scheduler
    if _scheduler and _scheduler.running:
        return
    _scheduler = BackgroundScheduler(timezone="America/Sao_Paulo")
    _scheduler.add_job(
        _job,
        trigger="interval",
        minutes=settings.sheets_sync_interval_minutes,
        id="sheets_sync",
        replace_existing=True,
        max_instances=1,
    )
    _scheduler.start()
    log.info(
        "APScheduler iniciado — sync Google Sheets a cada %d minutos",
        settings.sheets_sync_interval_minutes,
    )


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
