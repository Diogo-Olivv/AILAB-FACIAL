# Registro de achados (fonte única)

> Reescrito em 2026-11-11 · base `master@5f1d99c` · substitui o registro `F-xx` de 2026-09-13.
> Status de cada `AF-xx` está em `REMEDIATION_STATUS.md`. Este arquivo define o que é o achado, a evidência e a severidade.
> Legenda de classificação: **F** fato reconfirmado nesta revisão · **F\*** relatado por leitura de agente, não reconfirmado · **I** inferência · **H** hipótese · **NV** não verificado.
> Severidade: **Crítica** explorável agora com impacto sobre dados biométricos ou acesso administrativo · **Alta** explorável com pré-requisito, ou falha de integridade grave · **Média** risco real limitado · **Baixa** higiene, documentação ou robustez.

## 1. Equivalência com a numeração antiga

A numeração `F-xx` de 2026-09-13 não é mais usada. Equivalência aproximada:

| Antigo | Novo | Observação |
|---|---|---|
| E-1, INV-06 | AF-01 | "Verificado" antes; falso hoje |
| F-015 (eas.json sanitizado) | AF-02 | Falso: segredo continua no histórico público |
| F-002 (captura vinculada) | AF-15 | Reclassificado como risco aceito |
| F-004 (`verify_kiosk_key`) | — | Símbolo inexistente; ver `API_CONTRACT_AUDIT.md` |
| F-008 (rate limit) | AF-16, N-23 | |
| F-009 (lockfile com hashes) | AF-08 | 0 hashes |
| F-013 (`max_session_cap_hours`) | — | Removido, verificado por teste |
| F-014 (magic bytes) | — | Implementado; cobertura parcial de rotas (ver `TEST_STRATEGY_AUDIT.md`) |

## 2. Achados `AF-xx` (validados)

Lista completa com status e evidência em `REMEDIATION_STATUS.md`. Resumo por severidade:

| Severidade | IDs |
|---|---|
| Crítica | AF-01 (credencial mestra), AF-02 (segredo no histórico público), AF-24 (escrita anon, fechada em produção) |
| Alta | AF-03 (senhas mestras no cliente), AF-04 (fallback de chave no mobile), AF-06 (testes de banco pulados), AF-08 (CI ≠ produção), AF-14 (login legado em produção), AF-23 (`link_tutor_profile` por anon, fechado em produção), AF-25 (SELECT anon em perfis), AF-26 (senhas vazadas), AF-27 (Auto-Scan) |
| Média | AF-05 (migration 15, corrigida), AF-07, AF-09, AF-10, AF-11, AF-12, AF-13, AF-19, AF-20, AF-22, AF-28, AF-29 |
| Baixa | AF-16, AF-17 (corrigida), AF-18, AF-21 |

## 3. Achados `N-xx` (revisão de backend e banco, 2026-11-11)

Origem: leitura completa do backend e das migrations (`FLOWS.md`). Classificação indicada por item.

### 3.1 Confirmados nesta revisão (F)

| ID | Sev. | Evidência | Impacto | Correção sugerida |
|---|---|---|---|---|
| N-01 | Alta | `backend/migrations/19_seed_and_auto_sync_tutor_master.sql:2,9,15` semeia uma conta de tutor, com e-mail e senha literais, em `auth.users` (o e-mail não é reproduzido aqui) | Se a 19 for aplicada (ou já foi, em banco que não é o de produção), existe conta de tutor com senha pública | Remover o seed da 19; migration para desativar a conta; mover dados pessoais de seed para fora do repositório |
| N-04 | Média | `backend/app/deps.py:146` devolve `user_id="tutor-master-id"`; `backend/app/routers/profiles.py:137,161` passa `tutor.get("user_id")` como `p_actor` | Operações LGPD com token mestre falham; cast de tipo (**F\*** para o erro, a passagem é F) | Mapear ator não UUID para nulo e rótulo de texto; tornar falha de auditoria visível |
| N-13 | Alta | `backend/app/services/face_service.py:349-355` captura qualquer exceção e devolve `rows=[]`; `_load_embeddings` devolve `None` (linha 355); `backend/app/services/enroll_service.py:132-134` trata `None` como "sem cadastrados" e retorna | **Fail-open** na checagem de duplicidade: falha transitória do banco permite cadastrar a mesma pessoa de novo | Falhar fechado (erro 503) em falha de leitura; trava consultiva ou RPC única para checagem + inserção |

### 3.2 Reportados por leitura de agente (F\*, reconfirmar antes de corrigir)

| ID | Sev. | Resumo | Ref. |
|---|---|---|---|
| N-02 | Alta | Pool de identidade de 4 threads sem cache negativo; quatro requisições lentas causam 503 global | `deps.py:46, 98-104` |
| N-03 | Média (latente) | Caminho de troca de template dentro da janela, sem comparação com o template anterior; janela vencida | `deps.py:206-222`, `enroll_service.py:255-315` |
| N-05 | Média | Sem auditoria para cadastro, manual, entry, tutor-close, manutenção; `tutor_remove_member` ainda concedido a authenticated; `admin_audit_log` editável por `service_role` | `recognize.py:370-444`, `migrations/14:82-110`, `26` |
| N-06 | Média | `/sessions/manual` sem validação de intervalo, sobreposição ou perfil; `/sessions/entry` sem lock; tutor-close com fallback silencioso | `recognize.py:375-444` |
| N-07 | Média | Estatísticas: mês 13 gera 500; sem paginação; kiosk lê horas de qualquer perfil | `session_service.py:231-271` |
| N-08 | Média | Sessões abertas de perfil revogado continuam aparecendo no totem | `recognize.py:333-345`, `migrations/23` |
| N-09 | Média | `schema.sql` recria policies anon e `match_face` sem filtro de revogação, desfazendo as migrações 20, 26 e 28 | `backend/schema.sql:142-149, 212-248` |
| N-10 | Média | Prontidão não verifica RPCs nem versão de migração; falha de schema só gera log | `main.py:28-30`, `health.py`, `db/schema.py` |
| N-11 | Média | `render.yaml` sem `ENVIRONMENT`, `CHALLENGE_SECRET`, `BIOHASHING_SEED`; deploy usa `requirements.txt` em Python 3.12 e a imagem usa o lock em Python 3.11; deploy não depende do CI | `render.yaml`, `deploy-backend.yml`, `Dockerfile` |
| N-12 | Média | Semente de BioHash pública por padrão; sem versão de template; rotação silenciosa invalida tudo | `config.py:32-33`, `face_service.py:55-58` |
| N-14 | Média | Identidade por quadro sem exigir concordância entre frames; checagem de flash cobre só 2 quadros; `flash_unable_policy=allow` | `face_service.py:546-605`, `config.py:78` |
| N-16 | Média | Logs com dados pessoais (nomes e IDs de candidatos em WARNING) | `face_service.py:402-418` (IDs e nomes a reconfirmar) |
| N-17 | Média | Sem request ID, métricas, tracing nem evento de segurança para spoof e rejeições | `recognize.py`, `migrations/25` |
| N-18 | Média | Purga de logs engole erro e devolve 0; `replay_guard.purge()` nunca é chamado; sweeps divergentes; anulação sem `check_out IS NULL` | `maintenance.py:18-28`, `replay_guard.py:134`, `session_service.py` |
| N-19 | Média | Sessão que atravessa meia-noite ou passa de 10 h é anulada; checkout legítimo vira entrada nova | `migrations/24`, `session_service.py:51-62` |
| N-21 | Média | Perfil com justificativa não pode ser apagado (RESTRICT + 409); texto livre sensível sem prazo; `terms_version` não é gravado | `migrations/27:23,37-40`, `migrations/26` |
| N-15 | Baixa | Limiar de distância 0,87 equivale a cosseno ~0,6216; documentação e `.env.example` com outros valores; `ef_search` não aplicado; segunda camada anunciada e não implementada | `face_service.py:7,217-224,412`, `.env.example:14-20` |
| N-20 | Baixa | `compare_digest` em `str` não ASCII gera 500 (cabeçalho decodificado em latin-1); headers de retry não expostos ao CORS; `Idempotency-Key` validado e ignorado | `challenge_service.py:112`, `deps.py:238`, `main.py:47-57` |
| N-22 | Baixa | Listagem de kiosks só lê 2000 contas; revogação com cache de 60 s por processo; sem limite de kiosks | `kiosks.py:26-27, 111-127` |
| N-23 | Baixa | Rate limit em memória por processo, sem dimensão por IP | `recognize.py:57-93` |
| N-24 | Baixa | `APIKeyHeader` para `Authorization` (OpenAPI errado); respostas sem `response_model`; erros de texto livre; `/docs` público | `deps.py:44`, `main.py:38` |
| N-25 | Baixa | `fairness_audit` usa vetores aleatórios e sempre passa; `restore_drill` não restaura nada e usa service_role | `backend/scripts/` |
| N-26 | Baixa | Inicialização do PAD guarda flag antes de carregar: falha vira 503 permanente sem reinício | `liveness_service.py:62` |
| N-27 | Baixa | "Zero armazenamento de biometria bruta" superestimado: a imagem continua referenciada pelo chamador | `enroll_service.py:186,288`, `enroll.py:76-82` |

## 4. Itens fechados nesta revisão

| ID | Como foi fechado | Evidência |
|---|---|---|
| AF-05 | Migration 15 corrigida; gate de sintaxe | PR #76, `test_migration_syntax.py` |
| AF-06 | CI com Postgres 17 e `REQUIRE_DB_TESTS=1` | PR #76, run verde com 254 passed, 0 skipped |
| AF-17 | Fallback offline corrigido | PR #77, `sw_offline.test.ts` |
| AF-22 | Fixture recusa host não local | PR #76 |

## 5. Não verificado (NV)

- Se a migration 19 foi aplicada em algum banco além do de teste (N-01).
- Variáveis de ambiente do Cloud Run (N-11, N-12).
- Erro de tipo do `p_actor` (N-04) e fail-open (N-13) não foram reproduzidos em banco de teste ainda.
- Nomes e IDs de pessoas em log (N-16): o trecho lido registra apenas o tipo de exceção em um caso; os demais precisam de confirmação.
- pg_cron ativo no projeto (N-18).
