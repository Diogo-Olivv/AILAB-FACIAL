"""Script para download automatizado de modelos pré-treinados (InsightFace + MiniFASNet PAD).

Executado durante o build do Docker e para inicialização de ambientes locais/CI.
"""
import os
import sys
import urllib.request
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("download_models")

PAD_MODEL_URL = "https://huggingface.co/garciafido/minifasnet-v2-anti-spoofing-onnx/resolve/main/minifasnet_v2.onnx"
TARGET_DIRS = [
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app", "models")),
    os.path.expanduser(os.getenv("INSIGHTFACE_ROOT", "~/.insightface")),
]


def download_pad_model():
    """Baixa o modelo MiniFASNetV2 ONNX para anti-spoofing."""
    for target_dir in TARGET_DIRS:
        os.makedirs(target_dir, exist_ok=True)
        dest_path = os.path.join(target_dir, "pad.onnx")

        if os.path.exists(dest_path) and os.path.getsize(dest_path) > 1_000_000:
            log.info("Modelo PAD já existe em: %s (%d bytes)", dest_path, os.path.getsize(dest_path))
            continue

        log.info("Baixando modelo MiniFASNetV2 ONNX para: %s ...", dest_path)
        try:
            req = urllib.request.Request(
                PAD_MODEL_URL,
                headers={"User-Agent": "Mozilla/5.0 (AILAB-FACIAL Backend Downloader)"}
            )
            with urllib.request.urlopen(req, timeout=60) as resp, open(dest_path, "wb") as out_file:
                chunk = resp.read(65536)
                while chunk:
                    out_file.write(chunk)
                    chunk = resp.read(65536)
            size = os.path.getsize(dest_path)
            log.info("Download concluído com sucesso: %s (%d bytes)", dest_path, size)
        except Exception as exc:
            log.warning("Falha ao baixar modelo PAD para %s: %s", dest_path, exc)


if __name__ == "__main__":
    download_pad_model()
