"""Guarda de upload em camada ASGI pura.

Roda ANTES do roteamento e de qualquer parsing de multipart:
  1. exige credencial Bearer presente (a validação completa fica nas dependências);
  2. recusa Content-Length acima do teto;
  3. conta os bytes recebidos em streaming e interrompe ao passar do teto
     (corpos "chunked" sem Content-Length).

Limite assumido: o proxy do Cloud Run pode receber/bufferizar o corpo antes do
contêiner. A garantia aqui é que o processo não analisa multipart nem executa
biometria para requisição sem credencial ou acima do limite.
"""
from __future__ import annotations

import json

from fastapi import HTTPException

from app.config import settings

GUARDED_PREFIX = "/api/v1/"


async def _send_json(send, status: int, detail: str) -> None:
    body = json.dumps({"detail": detail}).encode("utf-8")
    await send({
        "type": "http.response.start",
        "status": status,
        "headers": [
            (b"content-type", b"application/json"),
            (b"content-length", str(len(body)).encode()),
        ],
    })
    await send({"type": "http.response.body", "body": body})


class UploadGuardMiddleware:
    def __init__(self, app, max_body_bytes: int | None = None):
        self.app = app
        self._max = max_body_bytes

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope.get("method") not in ("POST", "PUT", "PATCH"):
            return await self.app(scope, receive, send)
        if not scope.get("path", "").startswith(GUARDED_PREFIX):
            return await self.app(scope, receive, send)

        headers = {k.decode("latin-1").lower(): v.decode("latin-1") for k, v in scope.get("headers", [])}
        content_type = headers.get("content-type", "")
        limit = self._max if self._max is not None else settings.max_upload_bytes

        if content_type.startswith("multipart/"):
            authorization = headers.get("authorization", "")
            if not authorization.startswith("Bearer ") or not authorization[7:].strip():
                return await _send_json(send, 401, "Credencial ausente. Autentique-se para continuar.")

        declared = headers.get("content-length")
        if declared is not None:
            try:
                too_large = int(declared) > limit
            except ValueError:
                return await _send_json(send, 400, "Content-Length inválido.")
            if too_large:
                return await _send_json(send, 413, "Corpo da requisição excede o limite permitido.")

        received = 0

        async def counting_receive():
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > limit:
                    raise HTTPException(status_code=413, detail="Corpo da requisição excede o limite permitido.")
            return message

        return await self.app(scope, counting_receive, send)
