"""FastAPI application factory."""
from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import enroll, health, recognize

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)

app = FastAPI(
    title="AILAB-FACIAL API",
    version="1.0.0",
    description="Backend de reconhecimento facial e controle de presença para o AILAB.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # Restrinja aos domínios do app em produção
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(recognize.router)
app.include_router(enroll.router)
