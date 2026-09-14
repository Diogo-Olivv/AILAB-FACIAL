"""FastAPI application factory."""
from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db.schema_check import validate_schema
from app.routers import enroll, health, maintenance, profiles, recognize
from app.services.face_service import warmup

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)

log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        validate_schema()
    except Exception as exc:  # noqa: BLE001
        log.error("Schema do Supabase invalido no startup: %s", exc)
    try:
        await asyncio.to_thread(warmup)
    except Exception as exc:  # noqa: BLE001
        log.warning("Falha ao aquecer o modelo no startup: %s", exc)
    yield


app = FastAPI(
    title="AILAB-FACIAL API",
    version="1.0.0",
    description="Backend de reconhecimento facial e controle de presença para o AILAB.",
    lifespan=lifespan,
)

# CORS dinâmico configurável (fail-closed: sem wildcard por padrão)
origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else [],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request, exc: Exception):
    """Intercepta exceções não tratadas, impedindo vazamento de tracebacks e secrets."""
    log.error("Erro interno não tratado na rota %s: %s", request.url.path, exc, exc_info=True)
    from fastapi.responses import JSONResponse
    return JSONResponse(
        status_code=500,
        content={"detail": "Erro interno no servidor. Tente novamente mais tarde."},
    )


app.include_router(health.router)
app.include_router(recognize.router)
app.include_router(enroll.router)
app.include_router(profiles.router)
app.include_router(maintenance.router)

