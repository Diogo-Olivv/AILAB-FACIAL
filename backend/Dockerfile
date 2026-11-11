# ── Estágio 1: Builder (Compilação e Resolução de Dependências) ───────────────
FROM python:3.12-slim@sha256:5e2bdb1b0d542d5039cffb8181c65930093949194a65c365dfb1b0fe13a4fa5b AS builder

WORKDIR /build

# Ferramentas de compilação restritas a este estágio de compilação
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Cria virtualenv dedicado para isolar os pacotes
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Instala somente o que está no lock, com verificação de hash (falha se algo divergir)
COPY requirements.lock ./
RUN pip install --no-cache-dir --require-hashes -r requirements.lock

# Pré-carrega o pacote buffalo_s e PAD com verificação de integridade
ENV INSIGHTFACE_ROOT=/build/.insightface
RUN python -c "from insightface.app import FaceAnalysis; \
FaceAnalysis(name='buffalo_s', root='/build/.insightface', providers=['CPUExecutionProvider'], allowed_modules=['detection','recognition']).prepare(ctx_id=-1, det_size=(640, 640))"

COPY scripts/ ./scripts/
RUN python scripts/download_models.py && chmod -R a+rX /build/.insightface


# ── Estágio 2: Runner de Produção (Hardened & Sem Compiladores) ────────────────
FROM python:3.12-slim@sha256:5e2bdb1b0d542d5039cffb8181c65930093949194a65c365dfb1b0fe13a4fa5b AS runner

# Dependências estritamente dinâmicas em runtime (sem build-essential, gcc ou make)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Ambiente Python e Otimizações de Threads para Cloud Run
ENV PATH="/opt/venv/bin:$PATH" \
    INSIGHTFACE_ROOT=/app/.insightface \
    OMP_NUM_THREADS=2 \
    OPENBLAS_NUM_THREADS=2 \
    MKL_NUM_THREADS=2 \
    MALLOC_ARENA_MAX=2 \
    PYTHONUNBUFFERED=1

# Copia virtualenv compilado e modelos do estágio builder
COPY --from=builder /opt/venv /opt/venv
COPY --from=builder /build/.insightface /app/.insightface

# Cria usuário não-root com UID 1000
RUN useradd -m -u 1000 -s /bin/bash appuser && \
    chown -R appuser:appuser /app

# Copia código da aplicação e define permissões
COPY --chown=appuser:appuser . /app

USER appuser

EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1 --log-level info"]
