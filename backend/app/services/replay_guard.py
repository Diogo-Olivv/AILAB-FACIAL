"""Anti-replay e idempotência persistentes do reconhecimento.

Camada fina sobre as funções SQL da migração 25 (tabela recognition_requests).
Toda a atomicidade (claim, lease, fencing, presença + finalização na mesma
transação) acontece no banco; aqui só há transporte e tradução de resultados.
"""
from __future__ import annotations

import hashlib
import logging
from dataclasses import dataclass
from typing import Any

from app.config import settings
from app.db.supabase_client import get_client

log = logging.getLogger(__name__)

FINGERPRINT_VERSION = b"ailab-recognize-v1"


class ReplayStoreUnavailable(RuntimeError):
    """O banco não respondeu: a requisição falha fechada (503, repetível)."""


def compute_fingerprint(device_id: str, cid: str, action: str | None, frames: list[bytes]) -> str:
    """Impressão digital determinística da requisição.

    Codificação canônica com comprimentos explícitos (64 bits) para cada campo, de
    modo que concatenações diferentes não colidam:

        versão | device_id | cid | ação (ou vazio) | nº de frames | para cada frame,
        NA ORDEM RECEBIDA: tamanho | bytes

    Nome de arquivo e content-type ficam de fora: não mudam o significado do pedido.
    A mesma lista de frames em ordem diferente produz outra impressão digital.
    """
    digest = hashlib.sha256()

    def put(chunk: bytes) -> None:
        digest.update(len(chunk).to_bytes(8, "big"))
        digest.update(chunk)

    put(FINGERPRINT_VERSION)
    put(device_id.encode("utf-8"))
    put(cid.encode("utf-8"))
    put((action or "").encode("utf-8"))
    digest.update(len(frames).to_bytes(8, "big"))
    for frame in frames:
        put(frame)
    return digest.hexdigest()


@dataclass(frozen=True)
class Claim:
    outcome: str
    attempt: int | None = None
    result: dict | None = None
    retry_after: int | None = None


def _rpc(name: str, params: dict) -> Any:
    try:
        return get_client().rpc(name, params).execute().data
    except Exception as exc:
        log.error("Falha no armazenamento de requisições (%s): %s", name, type(exc).__name__)
        raise ReplayStoreUnavailable(name) from exc


def claim(cid: str, device_id: str, fingerprint: str, challenge_expired: bool) -> Claim:
    data = _rpc(
        "claim_recognition_request",
        {
            "p_cid": cid,
            "p_device_id": device_id,
            "p_payload_sha256": fingerprint,
            "p_challenge_expired": challenge_expired,
            "p_lease_seconds": settings.recognition_lease_seconds,
            "p_max_attempts": settings.recognition_max_attempts,
            "p_retention_seconds": settings.recognition_retention_seconds,
        },
    )
    if not isinstance(data, dict) or "outcome" not in data:
        raise ReplayStoreUnavailable("claim_recognition_request")
    return Claim(
        outcome=str(data["outcome"]),
        attempt=data.get("attempt"),
        result=data.get("result"),
        retry_after=data.get("retry_after"),
    )


def complete(
    cid: str,
    attempt: int,
    result: dict,
    profile_id: str | None = None,
    action: str | None = None,
    confidence: float | None = None,
) -> dict:
    """Finaliza a requisição. Com `profile_id`, registra a presença na mesma transação.

    Devolve {"outcome": "completed" | "stale", "result": {...}, "replayed": bool}.
    """
    data = _rpc(
        "complete_recognition_request",
        {
            "p_cid": cid,
            "p_attempt": attempt,
            "p_result": result,
            "p_profile_id": profile_id,
            "p_action": action,
            "p_confidence": confidence,
            "p_debounce_seconds": settings.debounce_seconds,
            "p_max_session_hours": settings.max_session_hours,
        },
    )
    if not isinstance(data, dict) or "outcome" not in data:
        raise ReplayStoreUnavailable("complete_recognition_request")
    return data


def fail(cid: str, attempt: int, retryable: bool, result: dict | None = None) -> None:
    """Registra falha de processamento. Erros aqui não escondem a falha original."""
    try:
        _rpc(
            "fail_recognition_request",
            {"p_cid": cid, "p_attempt": attempt, "p_retryable": retryable, "p_result": result},
        )
    except ReplayStoreUnavailable:
        log.warning("Não foi possível registrar a falha da requisição; o lease expirará sozinho.")


def purge() -> int:
    data = _rpc("purge_recognition_requests", {})
    return int(data) if isinstance(data, int) else 0
