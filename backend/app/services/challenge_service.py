"""Desafio temporal de captura (prova de frescor da requisição).

O desafio é um token `payload.assinatura` (HMAC-SHA256) com identificador único
(`cid`), emissão e expiração. Ele prova que a requisição foi iniciada há pouco
por um dispositivo autenticado; NÃO prova a origem física da imagem e não
substitui o PAD.

Uso único e idempotência são garantidos no banco (app/services/replay_guard.py,
tabela recognition_requests). O controle em memória deste módulo existe apenas
para desenvolvimento/testes sem banco.
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
from dataclasses import dataclass

from app.config import settings

log = logging.getLogger(__name__)

# Uso único em memória — apenas para o modo sem banco (dev/testes).
_consumed_challenges: dict[str, float] = {}
_lock = threading.Lock()
_LAST_CLEANUP: float = 0.0
_CLEANUP_INTERVAL_SECONDS: float = 60.0

# Segredo efêmero por processo para desenvolvimento. Nunca usado em produção.
_ephemeral_secret = secrets.token_bytes(32)

CLOCK_SKEW_SECONDS = 5.0


class ChallengeSecretMissing(RuntimeError):
    """Produção sem CHALLENGE_SECRET configurado: o serviço não emite nem valida desafios."""


def _get_signing_key() -> bytes:
    """Deriva a chave HMAC do segredo dedicado do desafio.

    Não existe segredo literal de fallback: em produção a ausência de
    CHALLENGE_SECRET é erro (fail-closed); em desenvolvimento usa-se um segredo
    aleatório que vive só enquanto o processo existir.
    """
    if settings.challenge_secret:
        secret = settings.challenge_secret.encode("utf-8")
    elif settings.is_production:
        raise ChallengeSecretMissing("CHALLENGE_SECRET não configurado.")
    else:
        secret = _ephemeral_secret
    return hashlib.sha256(b"ailab:capture_challenge:" + secret).digest()


def _sign(payload_b64: str) -> str:
    sig = hmac.new(_get_signing_key(), payload_b64.encode("ascii"), hashlib.sha256).digest()
    return base64.urlsafe_b64encode(sig).decode("ascii").rstrip("=")


def create_capture_challenge(ttl_seconds: int | None = None, device_id: str | None = None) -> dict:
    """Gera um desafio efêmero assinado, opcionalmente vinculado a um dispositivo."""
    effective_ttl = ttl_seconds if ttl_seconds is not None else settings.challenge_ttl_seconds
    now = time.time()
    exp = now + effective_ttl

    payload_data: dict = {"cid": str(uuid.uuid4()), "iat": int(now), "exp": int(exp)}
    if device_id:
        payload_data["dev"] = device_id

    payload_json = json.dumps(payload_data, separators=(",", ":")).encode("utf-8")
    payload_b64 = base64.urlsafe_b64encode(payload_json).decode("ascii").rstrip("=")

    return {
        "challenge_id": f"{payload_b64}.{_sign(payload_b64)}",
        "expires_at": int(exp),
        "ttl_seconds": effective_ttl,
    }


@dataclass(frozen=True)
class ParsedChallenge:
    cid: str
    expired: bool
    device_id: str | None


def parse_challenge(challenge_token: str | None) -> tuple[ParsedChallenge | None, str]:
    """Valida formato e assinatura e informa se o desafio expirou.

    Não consome o desafio: o consumo (claim) é feito de forma atômica pelo
    replay_guard. Um desafio expirado ainda é devolvido (com `expired=True`) para
    que um retry legítimo de requisição já concluída receba a resposta original.
    """
    if not challenge_token or not challenge_token.strip():
        return None, "Desafio de captura ausente."

    parts = challenge_token.strip().split(".")
    if len(parts) != 2:
        return None, "Formato do token de desafio inválido."
    payload_b64, sig_b64 = parts

    try:
        expected = _sign(payload_b64)
    except (UnicodeEncodeError, ValueError):
        return None, "Formato do token de desafio inválido."
    if not secrets.compare_digest(sig_b64, expected):
        log.warning("Desafio com assinatura inválida.")
        return None, "Assinatura criptográfica do desafio inválida."

    try:
        rem = len(payload_b64) % 4
        padded = payload_b64 + ("=" * (4 - rem)) if rem else payload_b64
        data = json.loads(base64.urlsafe_b64decode(padded).decode("utf-8"))
        cid = str(data["cid"])
        iat = float(data["iat"])
        exp = float(data["exp"])
        device_id = data.get("dev")
    except Exception as exc:  # noqa: BLE001
        log.warning("Payload de desafio ilegível: %s", type(exc).__name__)
        return None, "Payload do desafio corrompido."

    now = time.time()
    if iat > now + CLOCK_SKEW_SECONDS:
        return None, "Carimbo de emissão do desafio no futuro (skew de relógio)."

    return ParsedChallenge(cid=cid, expired=now > exp, device_id=str(device_id) if device_id else None), "OK"


def _prune_consumed_cache(now: float) -> None:
    global _LAST_CLEANUP
    if now - _LAST_CLEANUP < _CLEANUP_INTERVAL_SECONDS:
        return
    _LAST_CLEANUP = now
    for cid in [c for c, exp in _consumed_challenges.items() if exp < now]:
        _consumed_challenges.pop(cid, None)


def verify_and_consume_challenge(challenge_token: str | None) -> tuple[bool, str]:
    """Valida e consome o desafio em memória (modo sem banco: dev/testes).

    Em produção o consumo é feito por replay_guard.claim(), no banco.
    """
    parsed, reason = parse_challenge(challenge_token)
    if parsed is None:
        return False, reason
    if parsed.expired:
        return False, "Desafio de captura expirado."

    now = time.time()
    with _lock:
        _prune_consumed_cache(now)
        if parsed.cid in _consumed_challenges:
            log.warning("Tentativa de replay de desafio já utilizado.")
            return False, "Desafio de captura já utilizado (tentativa de repetição/replay)."
        _consumed_challenges[parsed.cid] = now + settings.challenge_ttl_seconds + CLOCK_SKEW_SECONDS

    return True, "OK"


def clear_consumed_cache_for_testing() -> None:
    """Função utilitária para testes unitários resetarem o cache entre execuções."""
    with _lock:
        _consumed_challenges.clear()
