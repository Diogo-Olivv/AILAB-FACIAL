FROM python:3.11-slim

# Dependências de sistema para InsightFace / OpenCV
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Onde o pacote buffalo_s fica salvo dentro da imagem
ENV INSIGHTFACE_ROOT=/app/.insightface

# Dimensionamento ideal para Google Cloud Run:
#   --cpu 2 --memory 2Gi --concurrency 8 --min-instances 1 (durante horário do laboratório)
# OMP_NUM_THREADS=2 e OPENBLAS_NUM_THREADS=2 maximizam o throughput ONNX por vCPU
# mantendo p95 < 800ms sem contenção de threads.
ENV OMP_NUM_THREADS=2 \
    OPENBLAS_NUM_THREADS=2 \
    MKL_NUM_THREADS=2 \
    MALLOC_ARENA_MAX=2 \
    PYTHONUNBUFFERED=1

# Instala dependências antes de copiar o código (cache de layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Baixa o modelo buffalo_s e o modelo anti-spoofing MiniFASNet na imagem
RUN python -c "from insightface.app import FaceAnalysis; \
FaceAnalysis(name='buffalo_s', root='/app/.insightface', providers=['CPUExecutionProvider'], allowed_modules=['detection','recognition']).prepare(ctx_id=-1, det_size=(640, 640))"

COPY scripts/ ./scripts/
RUN python scripts/download_models.py && chmod -R a+rX /app/.insightface

# Copia código
COPY . .

EXPOSE 8000

# Honra $PORT (Cloud Run injeta 8080); cai para 8000 em ambiente local/Render
# --workers 1 porque InsightFace não é fork-safe sem cuidado extra
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1 --log-level info"]
