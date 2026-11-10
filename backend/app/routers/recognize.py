"""Router de reconhecimento facial e eventos de sessão.

Ordem de processamento de POST /recognize (do mais barato ao mais caro):
  1. identidade do dispositivo (dependência) — antes de ler o corpo;
  2. rate limit por dispositivo;
  3. leitura do multipart com teto de partes (o tamanho total já foi limitado
     pela camada ASGI em app/upload_guard.py);
  4. validação superficial: quantidade, tamanho e assinatura dos arquivos;
  5. desafio: assinatura e vínculo com o dispositivo;
  6. impressão digital do pedido e CLAIM atômico no banco;
  7. só então decode, detecção, PAD e embedding;
  8. presença + finalização na mesma transação.
"""
from __future__ import annotations

import asyncio
import collections
import logging
import threading
import time

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from starlette.datastructures import UploadFile

from app.config import settings
from app.db.supabase_client import get_client
from app.deps import (
    validate_image,
    verify_admin_or_scheduler,
    verify_kiosk_identity,
    verify_kiosk_or_tutor,
    verify_tutor_token,
)
from app.routers.contracts import ChallengeResponse, RecognizeResponse
from app.services import replay_guard
from app.services.challenge_service import (
    ChallengeSecretMissing,
    create_capture_challenge,
    parse_challenge,
    verify_and_consume_challenge,
)
from app.services.face_service import BiometricUnavailable, identify_frames
from app.services.session_service import (
    close_stale_sessions,
    register_event,
    total_hours,
)

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1", tags=["recognize"])

# Teto de inferências simultâneas por processo.
_inference_semaphore = asyncio.Semaphore(settings.max_concurrent_inferences)

# Rate limit em janela deslizante de 60 s por identidade. É por processo: o
# limite efetivo com N instâncias é N vezes o configurado (risco residual declarado).
_rate_limit_lock = threading.Lock()
_request_history: dict[str, collections.deque] = collections.defaultdict(collections.deque)

# Lock por perfil — usado apenas no modo sem banco (dev/testes). Em produção a
# serialização é feita no Postgres (register_presence_event).
_profile_locks_guard = threading.Lock()
_profile_locks: dict[str, asyncio.Lock] = collections.defaultdict(asyncio.Lock)

_RESULT_FIELDS = ("recognized", "status", "message", "confidence", "distance", "cosine_similarity")
_MAX_IDEMPOTENCY_KEY_LEN = 128


def _get_profile_lock(profile_id: str) -> asyncio.Lock:
    with _profile_locks_guard:
        return _profile_locks[profile_id]


def check_rate_limit(identity: str, limit: int | None = None, bucket: str = "recognize") -> None:
    """Aplica o limite por identidade. A identidade nunca é escrita em log."""
    effective = limit if limit is not None else settings.rate_limit_per_minute
    key = f"{bucket}:{identity}"
    now = time.time()
    window_start = now - 60.0
    with _rate_limit_lock:
        timestamps = _request_history[key]
        while timestamps and timestamps[0] < window_start:
            timestamps.popleft()
        if len(timestamps) >= effective:
            log.warning("Rate limit excedido no bucket '%s' (%d req/min).", bucket, len(timestamps))
            raise HTTPException(
                status_code=429,
                detail=f"Muitas requisições. Limite de {effective} req/min excedido.",
                headers={"Retry-After": "60"},
            )
        timestamps.append(now)


def clear_rate_limits_for_testing() -> None:
    """Limpa o histórico de requisições entre testes."""
    with _rate_limit_lock:
        _request_history.clear()


def _challenge_or_503(device_id: str) -> dict:
    try:
        return create_capture_challenge(device_id=device_id)
    except ChallengeSecretMissing as exc:
        log.error("Desafio indisponível: segredo não configurado.")
        raise HTTPException(status_code=503, detail="Serviço de desafio indisponível.") from exc


@router.post("/recognize/challenge", response_model=ChallengeResponse)
@router.get("/recognize/challenge", response_model=ChallengeResponse)
def request_challenge(kiosk: dict = Depends(verify_kiosk_identity)):
    """Emite um desafio assinado, vinculado ao dispositivo que o pediu."""
    check_rate_limit(kiosk["user_id"], bucket="challenge")
    return _challenge_or_503(kiosk["user_id"])


def _storable_result(result: dict) -> dict:
    """Subconjunto do resultado que pode ser persistido: sem nome, imagem ou embedding."""
    return {k: result[k] for k in _RESULT_FIELDS if k in result and result[k] is not None}


def _profile_display(profile_id: str) -> tuple[str | None, bool]:
    try:
        res = (
            get_client().table("profiles").select("name, is_tutor").eq("id", profile_id).maybe_single().execute()
        )
        data = getattr(res, "data", None) or {}
        return data.get("name"), bool(data.get("is_tutor"))
    except Exception as exc:  # noqa: BLE001
        log.warning("Falha ao consultar dados de exibição do perfil: %s", type(exc).__name__)
        return None, False


async def _response_from_stored(stored: dict | None) -> dict:
    """Reconstrói a resposta ao cliente a partir do resultado persistido."""
    stored = dict(stored or {})
    profile_id = stored.get("profile_id")
    if profile_id and stored.get("recognized"):
        name, is_tutor = await asyncio.to_thread(_profile_display, profile_id)
        stored["name"] = name
        stored["is_tutor"] = is_tutor
    return stored


def _validated_idempotency_key(value: str | None) -> None:
    """O cabeçalho é aceito por compatibilidade; a identidade idempotente é o `cid`.

    Só é validado (formato e tamanho); não há consulta por ele antes da autenticação.
    """
    if value is None:
        return
    if not (1 <= len(value) <= _MAX_IDEMPOTENCY_KEY_LEN) or not all(c.isalnum() or c in "-_." for c in value):
        raise HTTPException(status_code=400, detail="Idempotency-Key inválido.")


@router.post("/recognize", response_model=RecognizeResponse)
async def recognize(
    request: Request,
    kiosk: dict = Depends(verify_kiosk_identity),
    x_challenge_id: str | None = Header(None, alias="X-Challenge-Id"),
    x_challenge_token: str | None = Header(None, alias="X-Challenge-Token"),
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
):
    """Recebe frame(s), valida o desafio, identifica o rosto e registra o evento.

    Repetir a MESMA requisição (mesmo desafio e mesmos frames) devolve a resposta
    original com `X-Idempotent-Replayed: true`, sem novo registro de presença.
    """
    device_id = kiosk["user_id"]

    # 2. Rate limit antes de ler o corpo.
    check_rate_limit(device_id)
    _validated_idempotency_key(idempotency_key)

    # 3. Multipart com teto de partes.
    form = await request.form(max_files=settings.max_recognize_frames + 1, max_fields=8)
    frames = [f for f in form.getlist("frames") if isinstance(f, UploadFile)]
    single_frame = form.get("frame")
    raw_action = form.get("action")
    action = str(raw_action).strip() if raw_action and str(raw_action).strip() else None
    if action is not None and action not in ("check_in", "check_out"):
        raise HTTPException(status_code=400, detail="Ação inválida.")
    challenge_token = form.get("challenge_id") or x_challenge_token or x_challenge_id

    uploads: list[UploadFile] = list(frames) if frames else (
        [single_frame] if isinstance(single_frame, UploadFile) else []
    )
    if len(uploads) > settings.max_recognize_frames:
        raise HTTPException(status_code=400, detail="Quantidade de frames acima do permitido.")

    # 5. Desafio: assinatura e vínculo com o dispositivo (não consome ainda).
    parsed = None
    if settings.enforce_capture_challenge:
        try:
            parsed, reason = parse_challenge(str(challenge_token) if challenge_token else None)
        except ChallengeSecretMissing as exc:
            raise HTTPException(status_code=503, detail="Serviço de desafio indisponível.") from exc
        if parsed is None:
            raise HTTPException(status_code=403, detail=f"Desafio de captura inválido ou expirado: {reason}")
        if parsed.device_id is not None and parsed.device_id != device_id:
            raise HTTPException(status_code=403, detail="Desafio de captura inválido ou expirado: dispositivo diferente.")

    if not uploads:
        return {"recognized": False, "status": "no_face", "message": "Nenhum frame de imagem fornecido."}

    # 4. Validação superficial (barata): tamanho, tipo e assinatura binária.
    raw_images: list[bytes] = []
    for f in uploads:
        b = await f.read()
        validate_image(f.content_type, len(b), b)
        raw_images.append(b)

    use_store = parsed is not None and settings.use_persistent_replay_guard
    attempt = 1

    if parsed is not None and not use_store:
        # Modo sem banco (dev/testes): uso único em memória.
        valid, reason = verify_and_consume_challenge(str(challenge_token))
        if not valid:
            raise HTTPException(status_code=403, detail=f"Desafio de captura inválido ou expirado: {reason}")

    if use_store:
        # 6. Claim atômico ANTES de qualquer processamento biométrico.
        fingerprint = replay_guard.compute_fingerprint(device_id, parsed.cid, action, raw_images)
        try:
            claim = await asyncio.to_thread(replay_guard.claim, parsed.cid, device_id, fingerprint, parsed.expired)
        except replay_guard.ReplayStoreUnavailable as exc:
            raise HTTPException(
                status_code=503, detail="Serviço temporariamente indisponível.", headers={"Retry-After": "2"}
            ) from exc

        if claim.outcome in ("completed", "failed_final"):
            payload = await _response_from_stored(claim.result)
            if claim.outcome == "failed_final" and not payload:
                raise HTTPException(status_code=409, detail="Requisição encerrada. Faça uma nova captura.")
            resp = JSONResponse(content=RecognizeResponse(**{"recognized": False, **payload}).model_dump())
            resp.headers["X-Idempotent-Replayed"] = "true"
            return resp
        if claim.outcome == "processing":
            raise HTTPException(
                status_code=409,
                detail="Requisição em processamento. Tente novamente em instantes.",
                headers={"Retry-After": str(claim.retry_after or 1), "X-Recognition-State": "processing"},
            )
        if claim.outcome == "conflict":
            raise HTTPException(status_code=409, detail="Este desafio já foi usado com outro conteúdo.")
        if claim.outcome == "exhausted":
            raise HTTPException(status_code=409, detail="Tentativas esgotadas. Faça uma nova captura.")
        if claim.outcome in ("expired", "forbidden"):
            raise HTTPException(status_code=403, detail="Desafio de captura inválido ou expirado.")
        if claim.outcome != "claimed" or claim.attempt is None:
            raise HTTPException(status_code=503, detail="Serviço temporariamente indisponível.")
        attempt = claim.attempt

    # 7. Processamento biométrico (caro), limitado por semáforo.
    try:
        async with _inference_semaphore:
            result = await asyncio.to_thread(identify_frames, raw_images)
    except BiometricUnavailable as exc:
        if use_store:
            await asyncio.to_thread(replay_guard.fail, parsed.cid, attempt, True, None)
        raise HTTPException(
            status_code=503, detail="Verificação biométrica indisponível no momento.", headers={"Retry-After": "5"}
        ) from exc
    except Exception:
        if use_store:
            await asyncio.to_thread(replay_guard.fail, parsed.cid, attempt, True, None)
        raise

    if not result or not result.get("recognized"):
        final_result = result or {
            "recognized": False,
            "status": "not_recognized",
            "message": "Rosto não reconhecido na base.",
        }
        if use_store:
            try:
                await asyncio.to_thread(replay_guard.complete, parsed.cid, attempt, _storable_result(final_result))
            except replay_guard.ReplayStoreUnavailable as exc:
                raise HTTPException(status_code=503, detail="Serviço temporariamente indisponível.") from exc
        return final_result

    profile_id = result.get("profile_id")

    if use_store:
        # 8. Presença + finalização na mesma transação do banco.
        try:
            done = await asyncio.to_thread(
                replay_guard.complete,
                parsed.cid,
                attempt,
                _storable_result({**result, "recognized": True}),
                profile_id,
                action,
                float(result.get("confidence") or 0.0),
            )
        except replay_guard.ReplayStoreUnavailable as exc:
            # O banco pode ter confirmado: o retry do cliente (mesmo cid) recebe o resultado gravado.
            raise HTTPException(
                status_code=503, detail="Não foi possível confirmar o registro.", headers={"Retry-After": "2"}
            ) from exc
        if done.get("outcome") != "completed":
            raise HTTPException(status_code=409, detail="Requisição substituída por nova tentativa.")
        stored = done.get("result") or {}
        _, is_tutor = await asyncio.to_thread(_profile_display, profile_id)
        return {
            "recognized": True,
            **result,
            "is_tutor": is_tutor,
            "event": stored.get("event"),
        }

    # Modo sem banco (dev/testes).
    event = None
    is_tutor = False
    if profile_id:
        async with _get_profile_lock(profile_id):
            try:
                await asyncio.to_thread(
                    lambda: get_client().table("face_logs").insert(
                        {"profile_id": profile_id, "confidence": result.get("confidence", 0.0)}
                    ).execute()
                )
            except Exception as exc:  # noqa: BLE001
                log.warning("Falha ao gravar face_log: %s", type(exc).__name__)
            event = await asyncio.to_thread(register_event, profile_id, action)
            _, is_tutor = await asyncio.to_thread(_profile_display, profile_id)

    return {"recognized": True, **result, "is_tutor": is_tutor, "event": event}


@router.get("/sessions/open", dependencies=[Depends(verify_kiosk_or_tutor)])
def open_sessions():
    """Lista quem está no laboratório agora. Não devolve matrícula."""
    rows = (
        get_client()
        .table("sessions")
        .select("id, check_in, profiles(id, name, avatar_url, is_tutor)")
        .is_("check_out", "null")
        .is_("voided_at", "null")
        .order("check_in", desc=False)
        .execute()
    )
    return rows.data


@router.post("/sessions/close-stale", dependencies=[Depends(verify_admin_or_scheduler)])
def close_stale():
    """Fecha sessões de saída esquecida. Uso exclusivo de operação/agendador."""
    return close_stale_sessions()


@router.get("/sessions/stats/{profile_id}", dependencies=[Depends(verify_kiosk_or_tutor)])
def session_stats(
    profile_id: str,
    year: int | None = None,
    month: int | None = None,
):
    """Retorna total de horas do membro, opcionalmente filtrado por mês."""
    hours = total_hours(profile_id, year=year, month=month)
    return {
        "profile_id": profile_id,
        "total_hours": hours,
        "year": year,
        "month": month,
    }


class TutorCloseSessionRequest(BaseModel):
    profile_id: str
    action: str = Field(pattern="^(checkout|void)$")


@router.post("/sessions/tutor-close", dependencies=[Depends(verify_tutor_token)])
def tutor_close_session_endpoint(body: TutorCloseSessionRequest):
    """Tutor autenticado registra saída imediata ou anula a sessão aberta.

    Usa a RPC tutor_close_session, que compartilha o lock por perfil com o kiosk.
    """
    res = get_client().rpc(
        "tutor_close_session", {"p_profile_id": body.profile_id, "p_action": body.action}
    ).execute()
    data = res.data if isinstance(res.data, dict) else {}
    return {
        "success": True,
        "action": body.action,
        "profile_id": body.profile_id,
        "updated_rows": int(data.get("updated_count", 0)),
    }
