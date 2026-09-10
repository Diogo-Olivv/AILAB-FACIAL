"""Serviço de Detecção de Vivacidade (PAD) e Qualidade Facial (FIQA).

Implementa:
1. Avaliação de qualidade de imagem (FIQA) via variância do operador Laplaciano
   para descarte de imagens borradas (motion blur).
2. Verificação de vivacidade passiva através de análise espectral de alta
   frequência (detecção de moiré/telas), distribuição cromática e suporte a modelo
   ONNX ultraleve (MiniFASNet / Silent-Face-Anti-Spoofing).
"""
from __future__ import annotations

import logging
import os
from typing import Tuple

import numpy as np
from PIL import Image

from app.config import settings

log = logging.getLogger(__name__)

_onnx_session = None
_onnx_initialized = False


def _init_onnx_pad():
    """Inicializa a sessão ONNX se houver modelo PAD disponível."""
    global _onnx_session, _onnx_initialized
    if _onnx_initialized:
        return _onnx_session

    _onnx_initialized = True
    model_paths = [
        os.path.expanduser(os.path.join(settings.insightface_root, "pad.onnx")),
        os.path.expanduser("~/.insightface/pad.onnx"),
    ]
    for p in model_paths:
        if os.path.exists(p):
            try:
                import onnxruntime as ort  # type: ignore

                opts = ort.SessionOptions()
                opts.intra_op_num_threads = 1
                opts.inter_op_num_threads = 1
                _onnx_session = ort.InferenceSession(
                    p, sess_options=opts, providers=["CPUExecutionProvider"]
                )
                log.info("Modelo ONNX PAD carregado com sucesso de %s", p)
                return _onnx_session
            except Exception as exc:
                log.warning("Falha ao carregar modelo ONNX PAD de %s: %s", p, exc)
    return None


def compute_laplacian_variance(gray: np.ndarray) -> float:
    """Calcula a variância do operador Laplaciano para estimar nitidez."""
    if gray.ndim != 2 or gray.shape[0] < 3 or gray.shape[1] < 3:
        return 0.0

    try:
        from scipy.ndimage import laplace  # type: ignore

        val = float(laplace(gray.astype(np.float64)).var())
        return val
    except ImportError:
        # Fallback para convolução discreta em NumPy
        kernel_val = (
            gray[2:, 1:-1]
            + gray[:-2, 1:-1]
            + gray[1:-1, 2:]
            + gray[1:-1, :-2]
            - 4 * gray[1:-1, 1:-1]
        )
        return float(np.var(kernel_val))


def check_image_quality(face_bgr: np.ndarray) -> Tuple[bool, float, str]:
    """Avalia se o recorte da face atende aos critérios mínimos de qualidade (FIQA).

    Retorna: (aprovado, score_laplaciano, motivo)
    """
    h, w = face_bgr.shape[:2]
    if h < settings.min_face_size or w < settings.min_face_size:
        return False, float(min(h, w)), "face_too_small"

    # Conversão para escala de cinza BGR -> Gray
    gray = (
        0.114 * face_bgr[:, :, 0]
        + 0.587 * face_bgr[:, :, 1]
        + 0.299 * face_bgr[:, :, 2]
    ).astype(np.float32)

    lap_var = compute_laplacian_variance(gray)
    if lap_var < settings.min_laplacian_var:
        return False, lap_var, "blur_detected"

    return True, lap_var, "quality_ok"


def _analyze_frequency_and_moire(gray: np.ndarray) -> float:
    """Detecta padrões periódicos de telas (efeito moiré) via FFT 2D."""
    h, w = gray.shape
    if h < 32 or w < 32:
        return 0.5

    # Ausência de textura/contraste (tela lisa, folha em branco, corte sem relevo facial)
    dynamic_range = float(np.max(gray) - np.min(gray))
    if dynamic_range < 15.0:
        return 0.1

    # FFT bidimensional
    f = np.fft.fft2(gray)
    fshift = np.fft.fftshift(f)
    magnitude_spectrum = np.abs(fshift)

    # Mascara o centro (baixas frequências) para analisar altas frequências
    cy, cx = h // 2, w // 2
    r = min(h, w) // 6
    y, x = np.ogrid[:h, :w]
    mask_low = ((y - cy) ** 2 + (x - cx) ** 2) <= r**2

    high_freq_spectrum = magnitude_spectrum.copy()
    high_freq_spectrum[mask_low] = 0

    # Telas OLED/LCD possuem picos espectrais concentrados nas altas frequências
    total_high_energy = np.sum(high_freq_spectrum)
    max_high_peak = np.max(high_freq_spectrum) if total_high_energy > 0 else 0

    if total_high_energy == 0:
        return 0.2

    peak_to_energy_ratio = max_high_peak / (total_high_energy + 1e-6)
    # Ratio muito alto indica padrão de grade de pixels repetitiva (tela)
    moire_penalty = np.clip(peak_to_energy_ratio * 120.0, 0.0, 1.0)
    return float(1.0 - moire_penalty)


def _analyze_chroma_and_specularity(face_bgr: np.ndarray) -> float:
    """Avalia dispersão cromática e presença de reflexos especulares anormais."""
    b = face_bgr[:, :, 0].astype(np.float32)
    g = face_bgr[:, :, 1].astype(np.float32)
    r = face_bgr[:, :, 2].astype(np.float32)

    # Proporção de pixels brancos/glare saturados (comum em telas e fotos plastificadas)
    saturated = (r > 248) & (g > 248) & (b > 248)
    glare_ratio = float(np.mean(saturated))
    if glare_ratio > 0.10:
        # Reflexo especular severo de tela ou plástico
        return 0.1

    # Aproximação de YCrCb: Cr = (r - y) * 0.713 + 128
    y = 0.299 * r + 0.587 * g + 0.114 * b
    cr = (r - y) * 0.713 + 128.0
    cb = (b - y) * 0.564 + 128.0

    # Intervalo de tom de pele natural: Cr [130, 175], Cb [75, 130]
    skin_mask = (cr >= 130) & (cr <= 175) & (cb >= 75) & (cb <= 130)
    skin_fraction = float(np.mean(skin_mask))

    # Se quase nenhum pixel tiver cor de pele (ex.: papel preto e branco ou tela descalibrada)
    if skin_fraction < 0.15:
        return 0.15

    return float(np.clip(0.4 + 0.6 * skin_fraction, 0.0, 1.0))


def verify_liveness(face_bgr: np.ndarray) -> Tuple[bool, float, str]:
    """Verifica a vivacidade do rosto contra ataques de apresentação (PAD).

    Retorna: (is_live, score, status_message)
    """
    if not settings.liveness_enabled:
        return True, 1.0, "liveness_disabled"

    # 1. Tenta inferência com modelo ONNX dedicado se configurado
    session = _init_onnx_pad()
    if session is not None:
        try:
            input_name = session.get_inputs()[0].name
            resized = np.array(
                Image.fromarray(face_bgr[:, :, ::-1]).resize((80, 80))
            ).astype(np.float32)
            # Transpõe HWC -> CHW e normaliza
            inp = np.transpose(resized, (2, 0, 1))[np.newaxis, ...] / 255.0
            outputs = session.run(None, {input_name: inp})
            logits = outputs[0][0]
            exp_logits = np.exp(logits - np.max(logits))
            probs = exp_logits / np.sum(exp_logits)
            live_prob = float(probs[1]) if len(probs) > 1 else float(probs[0])
            is_live = live_prob >= settings.liveness_min_score
            return is_live, live_prob, "onnx_pass" if is_live else "spoof_detected"
        except Exception as exc:
            log.warning("Falha na inferência ONNX PAD: %s. Aplicando analisador estatístico.", exc)

    # 2. Pipeline passivo estatístico (Frequência + Cor + Textura)
    gray = (
        0.114 * face_bgr[:, :, 0]
        + 0.587 * face_bgr[:, :, 1]
        + 0.299 * face_bgr[:, :, 2]
    ).astype(np.float32)

    moire_score = _analyze_frequency_and_moire(gray)
    chroma_score = _analyze_chroma_and_specularity(face_bgr)

    # Rejeição imediata se houver anomalia severa de reflexo ou ausência de textura/pele
    if chroma_score <= 0.30 or moire_score <= 0.30:
        final_score = min(chroma_score, moire_score)
    else:
        final_score = 0.50 * moire_score + 0.50 * chroma_score

    is_live = final_score >= settings.liveness_min_score
    reason = "live_pass" if is_live else "spoof_detected"
    return is_live, round(float(final_score), 4), reason
