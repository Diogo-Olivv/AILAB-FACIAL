"""Serviço de gerenciamento de desafios temporais (nonces) anti-injeção digital.

Implementa controle estrito de vivacidade e presença temporal:
1. Emissão de tokens de desafio efêmeros assinados com HMAC-SHA256 (TTL padrão de 30s).
2. Verificação de assinatura em tempo constante (secrets.compare_digest).
3. Consumo de uso único (one-time nonce) com proteção anti-replay e poda automática de memória.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import secrets
import threading
import time
import uuid

from app.config import settings

log = logging.getLogger(__name__)

# Cache de nonces consumidos com bloqueio thread-safe para neutralizar ataques de replay
_consumed_challenges: dict[str, float] = {}
_lock = threading.Lock()
_LAST_CLEANUP: float = 0.0
_CLEANUP_INTERVAL_SECONDS: float = 60.0


def _get_signing_key() -> bytes:
    """Deriva uma chave criptográfica HMAC de 256 bits a partir dos segredos configurados."""
    secret = (
        settings.kiosk_api_key
        or settings.api_key
        or "ailab-fallback-secret-kiosk-challenge"
    ).encode("utf-8")
    return hashlib.sha256(b"ailab:capture_challenge:" + secret).digest()


def _prune_consumed_cache(now: float) -> None:
    """Remove entradas expiradas do cache de desafios consumidos para evitar crescimento de memória."""
    global _LAST_CLEANUP
    if now - _LAST_CLEANUP < _CLEANUP_INTERVAL_SECONDS:
        return
    _LAST_CLEANUP = now
    expired = [cid for cid, exp in _consumed_challenges.items() if exp < now]
    for cid in expired:
        _consumed_challenges.pop(cid, None)


def create_capture_challenge(ttl_seconds: int | None = None) -> dict:
    """Gera um novo desafio efêmero de captura com assinatura HMAC-SHA256.

    Retorna um dicionário contendo o token assinado (challenge_id), timestamp de
    expiração e tempo de vida (TTL) em segundos.
    """
    effective_ttl = ttl_seconds if ttl_seconds is not None else settings.challenge_ttl_seconds
    now = time.time()
    exp = now + effective_ttl
    cid = str(uuid.uuid4())

    payload_data = {
        "cid": cid,
        "iat": int(now),
        "exp": int(exp),
    }

    payload_json = json.dumps(payload_data, separators=(",", ":")).encode("utf-8")
    payload_b64 = base64.urlsafe_b64encode(payload_json).decode("ascii").rstrip("=")

    sig = hmac.new(
        _get_signing_key(),
        payload_b64.encode("ascii"),
        hashlib.sha256,
    ).digest()
    sig_b64 = base64.urlsafe_b64encode(sig).decode("ascii").rstrip("=")

    challenge_token = f"{payload_b64}.{sig_b64}"

    return {
        "challenge_id": challenge_token,
        "expires_at": int(exp),
        "ttl_seconds": effective_ttl,
    }


def verify_and_consume_challenge(challenge_token: str | None) -> tuple[bool, str]:
    """Valida a integridade, temporalidade e unicidade do desafio de captura.

    Garante que:
    1. O token está presente e possui o formato payload.signature.
    2. A assinatura HMAC corresponde à chave do servidor.
    3. O desafio não está expirado e o timestamp de emissão é plausível.
    4. O desafio nunca foi utilizado anteriormente (consumo de uso único).
    """
    if not challenge_token or not challenge_token.strip():
        return False, "Desafio de captura ausente."

    parts = challenge_token.strip().split(".")
    if len(parts) != 2:
        return False, "Formato do token de desafio inválido."

    payload_b64, sig_b64 = parts

    # 1. Verificação da assinatura HMAC em tempo constante
    expected_sig = hmac.new(
        _get_signing_key(),
        payload_b64.encode("ascii"),
        hashlib.sha256,
    ).digest()
    expected_sig_b64 = base64.urlsafe_b64encode(expected_sig).decode("ascii").rstrip("=")

    if not secrets.compare_digest(sig_b64, expected_sig_b64):
        log.warning("Tentativa de uso de desafio com assinatura inválida/forjada.")
        return False, "Assinatura criptográfica do desafio inválida."

    # 2. Decodificação do payload
    try:
        rem = len(payload_b64) % 4
        padded_b64 = payload_b64 + ("=" * (4 - rem)) if rem else payload_b64
        payload_bytes = base64.urlsafe_b64decode(padded_b64)
        data = json.loads(payload_bytes.decode("utf-8"))
        cid = data["cid"]
        iat = float(data["iat"])
        exp = float(data["exp"])
    except Exception as exc:
        log.warning("Falha ao decodificar payload de desafio: %s", exc)
        return False, "Payload do desafio corrompido."

    now = time.time()

    # 3. Verificação de expiração e sincronismo temporal
    if now > exp:
        return False, f"Desafio de captura expirado (expirou há {int(now - exp)}s)."

    if iat > now + 5.0:
        return False, "Carimbo de emissão do desafio no futuro (skew de relógio)."

    # 4. Consumo atômico e verificação anti-replay
    with _lock:
        _prune_consumed_cache(now)
        if cid in _consumed_challenges:
            log.warning("Tentativa de replay detectada para o desafio '%s'.", cid)
            return False, "Desafio de captura já utilizado (tentativa de repetição/replay)."

        _consumed_challenges[cid] = exp

    return True, "OK"


def clear_consumed_cache_for_testing() -> None:
    """Função utilitária para testes unitários resetarem o cache entre execuções."""
    with _lock:
        _consumed_challenges.clear()
