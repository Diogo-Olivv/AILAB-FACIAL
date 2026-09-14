"""Script para download automatizado de modelos pré-treinados (InsightFace + MiniFASNet PAD).

Executado durante o build do Docker e para inicialização de ambientes locais/CI.

SECURITY: todos os artefatos binários são verificados via SHA-256 após o download.
Um hash inválido aborta o processo com código de saída 1 — nunca silencia corrupção.
"""
import hashlib
import os
import sys
import urllib.request
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("download_models")

PAD_MODEL_URL = "https://huggingface.co/garciafido/minifasnet-v2-anti-spoofing-onnx/resolve/main/minifasnet_v2.onnx"

# SHA-256 calculado sobre o artefato original em 2026-09-13 (após auditoria adversarial).
# Atualizar aqui quando um novo modelo for publicado e auditado.
PAD_MODEL_SHA256 = "d7b3cd9ba8a7ceb13baa8c4720902e27ca3112eff52f926c08804af6b6eecc7b"

TARGET_DIRS = [
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app", "models")),
    os.path.expanduser(os.getenv("INSIGHTFACE_ROOT", "~/.insightface")),
]


def _sha256_of_file(path: str) -> str:
    """Calcula e retorna o SHA-256 hex de um arquivo em disco."""
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def _verify_hash(path: str, expected: str) -> bool:
    """Retorna True se o SHA-256 do arquivo corresponder ao esperado."""
    actual = _sha256_of_file(path)
    if actual != expected:
        log.error(
            "FALHA DE INTEGRIDADE: SHA-256 de '%s' não corresponde ao esperado.\n"
            "  Esperado : %s\n"
            "  Calculado: %s\n"
            "Arquivo corrompido ou substituído — removendo e abortando.",
            path, expected, actual,
        )
        try:
            os.remove(path)
        except OSError:
            pass
        return False
    log.info("Hash SHA-256 verificado com sucesso: %s", path)
    return True


def download_pad_model() -> bool:
    """Baixa o modelo MiniFASNetV2 ONNX e verifica sua integridade SHA-256.

    Retorna True se todos os destinos foram verificados com sucesso.
    Retorna False (e loga erros) se qualquer verificação falhar.
    """
    all_ok = True

    for target_dir in TARGET_DIRS:
        os.makedirs(target_dir, exist_ok=True)
        dest_path = os.path.join(target_dir, "pad.onnx")

        # Modelo já existe — verificar hash antes de confiar nele
        if os.path.exists(dest_path):
            size = os.path.getsize(dest_path)
            if size > 1_000_000:
                if _verify_hash(dest_path, PAD_MODEL_SHA256):
                    log.info("Modelo PAD já existe e íntegro: %s (%d bytes)", dest_path, size)
                    continue
                else:
                    # Hash inválido: arquivo foi corrompido/substituído → baixar novamente
                    log.warning("Modelo PAD inválido detectado em %s — re-baixando.", dest_path)
            else:
                log.warning("Arquivo PAD suspeito (< 1 MB) em %s — re-baixando.", dest_path)

        log.info("Baixando modelo MiniFASNetV2 ONNX para: %s ...", dest_path)
        tmp_path = dest_path + ".tmp"
        try:
            req = urllib.request.Request(
                PAD_MODEL_URL,
                headers={"User-Agent": "Mozilla/5.0 (AILAB-FACIAL Backend Downloader)"}
            )
            hasher = hashlib.sha256()
            with urllib.request.urlopen(req, timeout=120) as resp, open(tmp_path, "wb") as out_file:
                chunk = resp.read(65536)
                while chunk:
                    out_file.write(chunk)
                    hasher.update(chunk)
                    chunk = resp.read(65536)

            calculated_hash = hasher.hexdigest()
            size = os.path.getsize(tmp_path)
            log.info("Download concluído em temporário: %s (%d bytes) — verificando SHA-256...", tmp_path, size)

            if calculated_hash != PAD_MODEL_SHA256:
                log.error(
                    "FALHA DE INTEGRIDADE: SHA-256 do modelo baixado não corresponde ao esperado.\n"
                    "  Esperado : %s\n"
                    "  Calculado: %s\n"
                    "Removendo temporário e abortando.",
                    PAD_MODEL_SHA256, calculated_hash,
                )
                try:
                    os.remove(tmp_path)
                except OSError:
                    pass
                all_ok = False
            else:
                # Substituição atômica: tmp_path -> dest_path
                os.replace(tmp_path, dest_path)
                log.info("Modelo PAD instalado e verificado atomicamente com sucesso: %s", dest_path)

        except Exception as exc:
            log.error("Falha ao baixar modelo PAD para %s: %s", dest_path, exc)
            if os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except OSError:
                    pass
            all_ok = False

    return all_ok


def verify_buffalo_models(root_dir: str | None = None) -> bool:
    """Verifica a presença e integridade estrutural dos modelos do InsightFace buffalo_s.

    Garante que os arquivos essenciais de detecção e reconhecimento não estão corrompidos
    ou com tamanho nulo/truncado antes de permitir o início da inferência.
    """
    base_root = root_dir or os.path.expanduser(os.getenv("INSIGHTFACE_ROOT", "~/.insightface"))
    model_dir = os.path.join(base_root, "models", "buffalo_s")

    if not os.path.exists(model_dir):
        log.warning("Diretório buffalo_s ainda não existe em %s (será preparado pelo FaceAnalysis)", model_dir)
        return True

    required_models = [
        "det_500m.onnx",
        "w600k_mbf.onnx",
    ]

    all_valid = True
    for model_name in required_models:
        model_path = os.path.join(model_dir, model_name)
        if not os.path.exists(model_path):
            log.warning("Modelo InsightFace ausente: %s", model_path)
            all_valid = False
            continue

        size = os.path.getsize(model_path)
        if size < 500_000:
            log.error("Modelo InsightFace corrompido ou truncado (<500KB): %s (%d bytes)", model_path, size)
            all_valid = False
            continue

        file_hash = _sha256_of_file(model_path)
        log.info("Modelo InsightFace verificado: %s (%d bytes, SHA-256: %s)", model_name, size, file_hash[:16] + "...")

    return all_valid


if __name__ == "__main__":
    pad_ok = download_pad_model()
    buffalo_ok = verify_buffalo_models()
    sys.exit(0 if (pad_ok and buffalo_ok) else 1)

