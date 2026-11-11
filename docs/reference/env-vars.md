# Referência de variáveis de ambiente (backend)

> Gerado a partir de `backend/app/config.py` (45 configurações) por leitura da AST. Reexecutar após mudar `Settings`. Não edite a tabela à mão.
> Fonte de valores de exemplo: `backend/.env.example`, que é **incompleto** e tem valores divergentes (ver `audit/DOCUMENTATION_AUDIT.md`, DOC-07 e DOC-08).

## Regras que valem para todas

- Variáveis são lidas de ambiente ou de `backend/.env` (pydantic-settings, nome em maiúsculas).
- `ENVIRONMENT=production` ativa comportamentos obrigatórios: PAD obrigatório, replay guard em banco e falha fechada onde couber.
- Nunca commitar valores reais. Segredos (coluna "Segredo") vão para o secret manager da plataforma (Cloud Run) ou para variável local não versionada.

## Variáveis obrigatórias em produção

| Variável | Por quê |
|---|---|
| `ENVIRONMENT=production` | Liga os controles fail-closed |
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | Banco e autenticação |
| `CHALLENGE_SECRET` | Assinatura de desafios; sem ele, o desafio é recusado em produção |
| `BIOHASHING_SEED` | Semente de rotação dos templates; padrão público (**N-12**) |
| `ADMIN_API_KEY` | Manutenção (`X-Admin-Key`) |
| `CORS_ORIGINS` | Origens do painel web (fail-closed se vazio) |
| `CLOUD_SCHEDULER_SA_EMAIL`, `GCP_PROJECT_NUMBER`, `SERVICE_URL` | Validação OIDC do agendador |

**Estado atual (F, `audit/DOCUMENTATION_AUDIT.md`):** `render.yaml` e o deploy não definem `ENVIRONMENT`, `CHALLENGE_SECRET` nem `BIOHASHING_SEED` (**N-11**). Verificar no Cloud Run antes de assumir o contrário.

## Tabela

| Variável de ambiente | Tipo | Padrão | Segredo | Descrição (comentário no código) |
|---|---|---|---|---|
| `ENVIRONMENT` | `str` | `"development"` | não | — |
| `SUPABASE_URL` | `str` | `""` | não | — |
| `SUPABASE_SERVICE_KEY` | `str` | `""` | **sim** | — |
| `FACE_THRESHOLD` | `float` | `0.87` | não | Distância euclidiana máxima calibrada (sqrt(2-2cos)) |
| `FACE_MIN_COSINE` | `float` | `0.62` | não | Limiar de similaridade cosseno: aceite definitivo |
| `FACE_UNCERTAIN_COSINE` | `float` | `0.55` | não | Zona incerta: 0.55-0.62 → second-factor ou rejeição |
| `MIN_FACE_SIZE` | `int` | `40` | não | Tamanho mínimo da face em pixels (adaptado para det_size 640) |
| `MIN_LAPLACIAN_VAR` | `float` | `20.0` | não | FIQA: adaptado para câmeras frontais de tablet com denoising |
| `LIVENESS_ENABLED` | `bool` | `True` | não | Ativação de checagem anti-spoofing (ONNX + heurísticas) |
| `LIVENESS_MIN_SCORE` | `float` | `0.45` | não | Score mínimo de vivacidade (ONNX model calibrado) |
| `ENROLL_MAX_PAIRWISE_DISTANCE` | `float` | `0.82` | não | Distância máxima entre fotos (permite variação natural com/sem óculos) |
| `MAX_ENROLL_FRAMES` | `int` | `5` | não | Máximo de fotos no payload de cadastro (mitigação DoS) |
| `DEBOUNCE_SECONDS` | `int` | `60` | não | Janela mínima de histerese (segundos) entre transições |
| `FLASH_LIVENESS_ENABLED` | `bool` | `True` | não | Analisa reflexo fotométrico na sequência multi-frame |
| `FLASH_MIN_DELTA` | `float` | `0.4` | não | Variação mínima de luminância facial sob pulso fotométrico |
| `BIOHASHING_ENABLED` | `bool` | `True` | não | Rotação ortogonal com chave: cancelável, NÃO irreversível |
| `BIOHASHING_SEED` | `str` | `"ailab-biometric-salt-v1"` | **sim** | Semente institucional para matriz ortogonal determinística |
| `MAX_SESSION_HOURS` | `int` | `10` | não | Limite para considerar saída esquecida |
| `INSIGHTFACE_ROOT` | `str` | `"~/.insightface"` | não | Onde o pacote buffalo_s fica salvo |
| `ADMIN_API_KEY` | `str` | `""` | **sim** | Chave de manutenção (X-Admin-Key): só agendador/operação; nunca em cliente |
| `USE_PGVECTOR` | `bool` | `True` | não | Habilita busca vetorial via RPC match_face (pgvector HNSW) |
| `GCP_PROJECT_NUMBER` | `str` | `""` | não | Número ou ID do projeto GCP para validação OIDC |
| `CLOUD_SCHEDULER_SA_EMAIL` | `str` | `""` | não | E-mail da Service Account do Cloud Scheduler |
| `SERVICE_URL` | `str` | `""` | não | URL do Cloud Run para validação de audiência OIDC |
| `CORS_ORIGINS` | `str` | `""` | não | Origens permitidas para CORS (separadas por vírgula); vazio = rejeita todas |
| `ENFORCE_CAPTURE_CHALLENGE` | `bool` | `True` | não | Exige challenge_id assinado em POST /recognize |
| `CHALLENGE_TTL_SECONDS` | `int` | `30` | não | Janela temporal de validade do desafio (segundos) |
| `MAX_CONCURRENT_INFERENCES` | `int` | `10` | não | Teto de inferências biométricas simultâneas por worker |
| `RATE_LIMIT_PER_MINUTE` | `int` | `60` | não | Limite de requisições por minuto por chave/IP |
| `HNSW_EF_SEARCH` | `int` | `40` | não | ef_search: trade-off qualidade/velocidade (≥ ef_construction/2) |
| `KIOSK_EMAIL_DOMAIN` | `str` | `"kiosk.ailab.invalid"` | não | Domínio das contas de dispositivo (nunca recebe e-mail) |
| `KIOSK_TOKEN_CACHE_SECONDS` | `int` | `60` | não | Cache da validação do JWT do kiosk (atraso máximo de revogação) |
| `AUTH_TIMEOUT_SECONDS` | `float` | `5.0` | não | Tempo máximo da consulta de identidade ao Supabase Auth |
| `CHALLENGE_SECRET` | `str` | `""` | **sim** | Segredo dedicado do desafio de captura (obrigatório em produção) |
| `MAX_UPLOAD_BYTES` | `int` | `27 * 1024 * 1024` | não | Teto do corpo multipart (5 frames de 5 MB + margem) |
| `MAX_RECOGNIZE_FRAMES` | `int` | `5` | não | Máximo de frames aceitos em /recognize |
| `UPLOAD_RATE_LIMIT_PER_MINUTE` | `int` | `20` | não | Limite de cadastros/recadastros por identidade |
| `PERSISTENT_REPLAY_GUARD` | `bool` | `True` | não | Usa public.recognition_requests (obrigatório em produção) |
| `PRESENCE_VIA_RPC` | `bool` | `True` | não | Usa public.register_presence_event |
| `RECOGNITION_LEASE_SECONDS` | `int` | `30` | não | Prazo máximo de processamento antes de permitir retomada |
| `RECOGNITION_MAX_ATTEMPTS` | `int` | `3` | não | Tentativas por desafio |
| `RECOGNITION_RETENTION_SECONDS` | `int` | `300` | não | Retenção do resultado (cobre o orçamento de retry do cliente) |
| `PAD_REQUIRE_MODEL` | `bool | None` | `None` | não | None = exigido em produção; sem modelo o serviço responde 503 |
| `FLASH_UNABLE_POLICY` | `str` | `"allow"` | não | "allow" (comportamento histórico) \| "reject" quando não der para verificar |
| `TERMS_VERSION` | `str` | `"v1.0"` | não | — |

## Variáveis que aparecem em exemplos mas não existem no código

| Nome | Onde aparece | Situação |
|---|---|---|
| `API_KEY` | `backend/.env.example`, `render.yaml` | Não é lida pela autenticação atual; remover |
| `MAX_SESSION_CAP_HOURS` | `backend/.env.example` | Não existe em `config.py` (F). Teste de ausência citado por agente (F\*, `test_supply_chain_hardening.py`), não reconfirmado |
| `KIOSK_API_KEY` | `render.yaml` | Não é lida; o totem usa JWT de conta de kiosk |
