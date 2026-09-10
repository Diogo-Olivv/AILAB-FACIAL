from fastapi import APIRouter

from app.services.face_service import is_model_loaded

router = APIRouter(tags=["health"])


@router.get("/health")
def health():
    """Liveness probe: retorna 200 se o processo FastAPI está ativo."""
    return {"status": "ok"}


@router.get("/health/ready")
def readiness():
    """Readiness probe: indica se os modelos ONNX estão aquecidos em RAM."""
    models_ready = is_model_loaded()
    return {
        "status": "ready" if models_ready else "warming_up",
        "models_loaded": models_ready,
    }

