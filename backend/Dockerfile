FROM python:3.11-slim

# Dependências de sistema para InsightFace / OpenCV
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instala dependências antes de copiar o código (cache de layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copia código
COPY . .

EXPOSE 8000

# --workers 1 porque InsightFace não é fork-safe sem cuidado extra
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--log-level", "info"]
