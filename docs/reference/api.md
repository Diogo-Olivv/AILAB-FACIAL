# Referência da API

> Gerada a partir do `GET /openapi.json` do serviço implantado em **2026-11-11** (versão `1.0.0`, **17 caminhos**, **20 operações**). A coluna "Autenticação" vem de `backend/app/deps.py` e dos routers, e não do OpenAPI: o esquema publicado declara `Authorization` como chave de API (achado API-01 em `audit/API_CONTRACT_AUDIT.md`).
> Para o estado mais recente, consulte `/openapi.json` do próprio serviço. Este arquivo envelhece.

Todas as rotas ficam sob `/api/v1`, exceto `/health` e `/health/ready`. O corpo de erro é `{"detail": "..."}` em texto livre em português; não há código de erro estável (API-03).

## Operações

| Método | Caminho | Operação | Autenticação | Respostas |
|---|---|---|---|---|
| `POST` | `/api/v1/enroll` | Enroll Endpoint | tutor | 200 |
| `GET` | `/api/v1/kiosks` | List Kiosks | tutor | 200 |
| `POST` | `/api/v1/kiosks` | Provision Kiosk | tutor | 201, 422 |
| `DELETE` | `/api/v1/kiosks/{kiosk_id}` | Revoke Kiosk | tutor | 204, 422 |
| `POST` | `/api/v1/maintenance/cleanup` | Run Maintenance Cleanup | admin ou agendador | 200 |
| `GET` | `/api/v1/profiles/{profile_id}` | Get Profile | tutor | 200, 422 |
| `DELETE` | `/api/v1/profiles/{profile_id}` | Delete Profile | tutor | 200, 422 |
| `POST` | `/api/v1/profiles/{profile_id}/refresh-embedding` | Refresh Embedding Endpoint | tutor (ou kiosk dentro da janela de cadastro) | 200, 422 |
| `POST` | `/api/v1/profiles/{profile_id}/revoke-consent` | Revoke Consent | tutor | 200, 422 |
| `POST` | `/api/v1/recognize` | Recognize | kiosk | 200, 422 |
| `GET` | `/api/v1/recognize/challenge` | Request Challenge | kiosk | 200 |
| `POST` | `/api/v1/recognize/challenge` | Request Challenge | kiosk | 200 |
| `POST` | `/api/v1/sessions/close-stale` | Close Stale | admin ou agendador | 200 |
| `POST` | `/api/v1/sessions/entry` | Entry Session Endpoint | tutor | 200, 422 |
| `POST` | `/api/v1/sessions/manual` | Manual Session Endpoint | tutor | 200, 422 |
| `GET` | `/api/v1/sessions/open` | Open Sessions | kiosk ou tutor | 200 |
| `GET` | `/api/v1/sessions/stats/{profile_id}` | Session Stats | kiosk ou tutor | 200, 422 |
| `POST` | `/api/v1/sessions/tutor-close` | Tutor Close Session Endpoint | tutor | 200, 422 |
| `GET` | `/health` | Health | nenhuma | 200 |
| `GET` | `/health/ready` | Readiness | nenhuma | 200 |

Autenticação: **kiosk** é um JWT de conta de totem (`app_metadata.role = 'kiosk'`); **tutor** é um JWT de conta de tutor (`app_metadata.role = 'tutor'`); **admin ou agendador** é `X-Admin-Key` ou o token OIDC do Cloud Scheduler. Credenciais compartilhadas legadas ainda são aceitas pelo backend (**AF-01**) até a remoção planejada.

## Schemas publicados

| Schema | Campos | Obrigatórios |
|---|---|---|
| `ChallengeResponse` | `challenge_id`, `expires_at`, `ttl_seconds` | `challenge_id`, `expires_at`, `ttl_seconds` |
| `EnrollResponse` | `profile_id`, `name`, `photos_used` | `profile_id`, `name`, `photos_used` |
| `EventDetail` | `action`, `profile_id`, `session_id`, `timestamp`, `duration_minutes`, `wait_seconds` | `action` |
| `HTTPValidationError` | `detail` | — |
| `KioskCredential` | `kiosk_id`, `label`, `email`, `password` | `kiosk_id`, `label`, `email`, `password` |
| `KioskInfo` | `kiosk_id`, `label`, `created_at`, `last_sign_in_at`, `disabled` | `kiosk_id`, `label` |
| `KioskProvisionRequest` | `label` | `label` |
| `ManualSessionRequest` | `profile_id`, `check_in`, `check_out` | `profile_id`, `check_in`, `check_out` |
| `RecognizeResponse` | `recognized`, `status`, `message`, `profile_id`, `name`, `confidence`, `distance`, `cosine_similarity`, `is_tutor`, `event` | `recognized` |
| `RevokeConsentResponse` | `revoked`, `profile_id`, `name`, `revoked_at`, `message` | `revoked`, `profile_id`, `message` |
| `TutorCloseSessionRequest` | `profile_id`, `action` | `profile_id`, `action` |
| `TutorEntryRequest` | `profile_id` | `profile_id` |
| `ValidationError` | `loc`, `msg`, `type` | `loc`, `msg`, `type` |

## Erros de `POST /api/v1/recognize`

Levantados por leitura de `backend/app/routers/recognize.py` e `backend/app/deps.py` (F\*: parte foi reconfirmada, os códigos 413, 415 e o texto exato das mensagens não). Fluxo completo em `audit/FLOWS.md`, seção 2.

| Código | Quando | Cabeçalhos |
|---|---|---|
| 200 | Reconhecido, não reconhecido, incerto, spoof ou sem rosto. O resultado vai no corpo (`recognized`, `status`) | `X-Idempotent-Replayed: true` se for repetição de resultado guardado |
| 400 | Ação inválida ou número de quadros acima do limite | — |
| 401 | Sem credencial ou credencial inválida | — |
| 403 | Desafio inválido, expirado, de outro dispositivo, ou papel sem permissão | — |
| 409 | Mesmo desafio em processamento, ou com conteúdo diferente, ou tentativas esgotadas | `Retry-After` e `X-Recognition-State` (não expostos a navegadores: API-07) |
| 413 / 415 | Corpo ou imagem acima do limite, ou tipo não permitido | — |
| 429 | Limite de 60 requisições por minuto por identidade | `Retry-After: 60` |
| 503 | Biometria ou armazenamento de replay indisponível | — |

## Como regenerar

```bash
curl -s https://<URL-DO-SERVICO>/openapi.json -o openapi.json
```

O gerador usado nesta página lê `paths` e `components.schemas` desse arquivo. A proposta de versionar o `openapi.json` no repositório e comparar no CI está em `docs/adr/0009-contract-first.md`.
