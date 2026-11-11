# Auditoria de contratos de API

> Revisado em 2026-11-11 · base `master@5f1d99c` · OpenAPI obtido do serviço implantado em 2026-11-11 (`GET /openapi.json`, somente leitura).
> Legenda: **F** verificado · **F\*** relatado por leitura de agente · **I** inferência.

## 1. Estado do contrato

- O backend publica OpenAPI 3 com título `AILAB-FACIAL API` e versão `1.0.0` (F, produção).
- São **17 caminhos** publicados (lista em `PROD_STATE_SNAPSHOT.md`, seção 6).
- O OpenAPI é gerado pelo FastAPI a partir do código. **Não há arquivo `openapi.json` versionado no repositório** (F). Mudanças de contrato não aparecem em revisão de PR.
- Não há fixture compartilhada de erros nem de payloads entre backend, web e mobile (F\*).

## 2. Achados

| ID | Sev. | Evidência | Impacto | Correção |
|---|---|---|---|---|
| API-01 | Média | `deps.py:44` declara `Authorization` como `APIKeyHeader`; o OpenAPI mostra API key, não bearer (**N-24**, F\*) | Clientes gerados por OpenAPI usam o esquema errado | `HTTPBearer` |
| API-02 | Média | Respostas de rotas de sessão e de perfil sem `response_model` (**N-24**, F\*) | Clientes não conseguem tipar a resposta | Modelos Pydantic de resposta |
| API-03 | Média | Erros em texto livre em português; sem código de erro estável (F\*) | Clientes comparam strings; mudança de texto quebra o app | Taxonomia de códigos (`error.code`) e mensagem separada |
| API-04 | Média | Tipos copiados à mão em `mobile/lib/api.ts` e `web/src/lib/recognitionService.ts` (F\*) | Deriva silenciosa entre cliente e servidor | Gerar tipos a partir do `openapi.json` versionado |
| API-05 | Média | Web lê `matricula` de resposta que o schema não define (F\*, `recognitionService.ts`) | Campo sempre vazio, sem erro de tipo | Remover ou adicionar ao schema |
| API-06 | Média | Web não trata `debounced` nem `wait_seconds` (F\*) | Estado de debounce some para o painel | Tratar o valor do enum |
| API-07 | Média | `Retry-After`, `X-Recognition-State` e `X-Idempotent-Replayed` não são expostos ao CORS (**N-20**, F\*) | Navegadores não leem os cabeçalhos de nova tentativa | `expose_headers` |
| API-08 | Baixa | `Idempotency-Key` validado e ignorado (**N-20**, F\*) | Cliente acredita que há idempotência extra | Implementar ou remover a validação |
| API-09 | Baixa | `/docs` público em produção (F\*: `main.py:38`) | Superfície exposta | Desabilitar docs em produção |
| API-10 | Baixa | Janela de cadastro em duas fontes com mesmas constantes e sem contrato (F: `enrollment_window.py`, `enrollmentWindow.ts`) | Deriva na borda de data | Servir a janela pela API |
| API-11 | Média | Erros de banco podem chegar ao cliente com mensagem bruta (**N-13**, F\*) | Vazamento de detalhes internos | Mensagem fixa e log interno |

## 3. Matriz de autenticação por rota (F, de `deps.py` e `routers/`)

| Rota | Método | Autenticação |
|---|---|---|
| `/recognize/challenge` | GET, POST | kiosk |
| `/recognize` | POST | kiosk |
| `/sessions/open` | GET | kiosk ou tutor |
| `/sessions/stats/{profile_id}` | GET | kiosk ou tutor (**N-07**: kiosk lê qualquer perfil) |
| `/sessions/close-stale` | POST | admin ou scheduler |
| `/sessions/tutor-close` | POST | tutor |
| `/sessions/manual`, `/sessions/entry` | POST | tutor |
| `/enroll` | POST | tutor |
| `/profiles/{id}` | GET, DELETE | tutor |
| `/profiles/{id}/refresh-embedding` | POST | tutor, ou kiosk dentro da janela (**N-03**) |
| `/profiles/{id}/revoke-consent` | POST | tutor |
| `/kiosks` | GET, POST | tutor |
| `/kiosks/{id}` | DELETE | tutor |
| `/maintenance/cleanup` | POST | admin ou scheduler |
| `/health`, `/health/ready` | GET | nenhuma |

Qualquer token mestre aceito pelo código (**AF-01**) passa em todas as linhas de autenticação de tutor e de kiosk.

## 4. Proposta: contrato primeiro

1. Gerar `backend/openapi.json` a partir do app e versionar; falhar o CI se o arquivo divergir (`openapi-diff` com regra de quebra).
2. Tipos do web e do mobile gerados a partir desse arquivo.
3. Fixtures de erro e de resposta em `contracts/fixtures/` consumidas por pytest, Vitest (web) e `node --test` (mobile lib).
4. Registro de versão de API em `CHANGELOG.md` e política de compatibilidade em `docs/reference/api.md`.

Decisão registrada como ADR 0009 (proposto) em `docs/adr/`.
