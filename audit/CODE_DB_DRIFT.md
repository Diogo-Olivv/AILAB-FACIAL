# Drift entre código, banco de produção e registro de migrations

> Revisado em 2026-11-11 · base `master@5f1d99c` · snapshot `PROD_STATE_SNAPSHOT.md` (03:08 UTC)
> **Atualização de 2026-11-11 (~11:55 UTC):** as migrations 22 a 26 foram aplicadas na produção (ver seção 6). D-01, D-02, D-03 e D-06 estão fechados; D-04, D-05 (parte), D-08 e D-09 seguem abertos.
> Legenda: **F** fato · **I** inferência · **H** hipótese · **NV** não verificado

Drift = diferença entre o que o código do repositório **espera** do banco, o que o banco **tem**, e o que o registro de migrations **diz** que foi aplicado. Os três precisam convergir.

## 1. O que o código espera (F)

Migrations em `backend/migrations/` (01–29) são a fonte da verdade declarada. O código usa, por padrão:

| Configuração padrão | Valor | Objeto de banco exigido | Arquivo |
|---|---|---|---|
| `presence_via_rpc` | `True` | `register_presence_event` (24) | `backend/app/config.py:71`, `session_service.py:133` |
| `persistent_replay_guard` | `True` (e forçado em produção) | `recognition_requests` e funções de claim (25) | `config.py:70`, `config.py:94-95` |
| registro em `admin_audit_log` | sempre em kiosk provisioning | tabela (26) | `backend/app/routers/kiosks.py:60-64` |
| `kiosk_presence`, `kiosk_directory`, `public_lab_stats` | — | funções (23) | `mobile/hooks/usePresence.ts:51`, `useProfiles.ts:21`, `web/src/lib/reports.ts:45` |
| `revoke_profile_consent`, `delete_profile_cascade` | — | funções (26) | `backend/app/routers/profiles.py:137,161` |
| JWT de kiosk com `app_metadata.role='kiosk'` | — | contas `kiosk` (provisionamento via API) | `backend/app/deps.py` (`verify_kiosk_identity`), `kiosks.py:88` |

## 2. O que a produção tem (F)

Ver `PROD_STATE_SNAPSHOT.md` seções 2 e 3. Resumo:

- **Ausentes** (0 de 7 funções-chave acima): `register_presence_event`, `kiosk_presence`, `kiosk_directory`, `public_lab_stats`, `revoke_profile_consent`, `delete_profile_cascade`, `replace_profile_embeddings`. Tabelas `recognition_requests` e `admin_audit_log` também ausentes.
- **Presentes sem registro**: objetos da migration 27 (`attendance_justifications` e três funções).
- **Presentes que deveriam ter sido removidas**: `verify_tutor_login` e `sync_tutor_credentials` (migration 22 as dropa).
- **Contas**: 0 kiosk. Todo o fluxo de totem depende hoje da chave compartilhada (`mobile/lib/api.ts:67-71`).

## 3. Matriz de convergência

| # | Divergência | Tipo | Consequência | Severidade | Ação de convergência |
|---|---|---|---|---|---|
| D-01 | Código usa `register_presence_event` por padrão; função ausente | código ↔ banco | Check-in/out por RPC falha, ou o ambiente de produção sobrescreve a flag (**H**: confirmar env do Cloud Run, NV) | Alta (bloqueia voltar ao ar) | Aplicar migration 24 em produção depois de teste local, ou desligar a flag com ADR |
| D-02 | Código usa `recognition_requests` por padrão; tabela ausente | código ↔ banco | Replay guard persistente indisponível: `recognize` devolve 503 (`ReplayStoreUnavailable`) | Alta | Migration 25 |
| D-03 | Funções de LGPD (26) ausentes | código ↔ banco | Revogar consentimento e excluir perfil pelo backend falham | Alta (LGPD) | Migration 26 |
| D-04 | Migration 27 aplicada sem registro | registro ↔ banco | Não é possível reproduzir o estado a partir do registro | Média | Registrar a versão manualmente após verificar o catálogo, ou recriar via migration forward idempotente |
| D-05 | Migrations 17–23 e 28–29 sem registro (29 aplicada manualmente em 2026-11-10 para os privilégios; demais não) | registro ↔ banco | Estado não reproduzível | Média | Plano de convergência abaixo |
| D-06 | Login legado com literal presente | banco ↔ segurança | Ver AF-14 em `FINDINGS.md` | Alta | Migration 22 em produção, após confirmar que nada depende de `verify_tutor_login` (grep do código: nenhum chamador no `backend/`) |
| D-07 | 0 contas kiosk; app usa chave compartilhada | operação ↔ segurança | Remover a chave derruba totens | Crítica (AF-01) | Provisionar o tablet primeiro (pendência do dono) |
| D-08 | Advisors: `anon` com SELECT em tabelas biométricas e de perfis | banco ↔ privacidade | Leitura pública, dependendo das policies | Alta | Migration 28 depois de confirmar a tela pública (`web/src/lib/reports.ts`, `usePresence.ts`) |
| D-09 | Políticas redundantes (`tutor_write_*` + `tutor_*`) | banco ↔ performance | Custo extra por linha; não é falha | Baixa | Consolidar em uma policy por comando |
| D-10 | Índice HNSW sem uso registrado | banco ↔ performance | Busca vetorial pode não usar o índice | Média (I) | `EXPLAIN` em `match_face` com dados reais; confirmar `hnsw.ef_search` |

## 4. Plano de convergência (ordem)

1. **Congelar o estado atual** (feito: `PROD_STATE_SNAPSHOT.md`). Repetir antes de cada passo.
2. **Verificar o catálogo de cada objeto da migration 17–28** contra o arquivo correspondente, por diff de `pg_get_functiondef` e de `pg_policies`. Sem isso, qualquer migration forward pode sobrescrever algo diferente do que está no repositório.
3. **Testar localmente** a cadeia completa (`test_migration_chain.py`, a ser criado em PR de banco), com Postgres 17 + pgvector, a partir de um baseline histórico.
4. **Aplicar em produção, em ordem, cada migration forward**, depois de teste verde e aprovação explícita do mantenedor. Uma por vez, com o snapshot antes e depois.
5. **Atualizar o registro** (`supabase_migrations`) somente para o que foi de fato aplicado, com nota no `CHANGELOG.md`.

Nada disso é feito por este documento. Cada passo é uma decisão do mantenedor.

## 5. Riscos

- **I:** a produção pode diferir do repositório de formas que não aparecem nas consultas feitas. A verificação completa exige diff de catálogo, não só contagens.
- **H:** o backend implantado pode ter variáveis de ambiente que desligam as flags de RPC (NV). Se for o caso, o drift D-01 e D-02 não são falha ativa, mas o código do repositório continua não reproduzindo o ambiente.
- **NV:** conteúdo exato das funções presentes em produção (só o nome e os metadados foram verificados).

## 6. Aplicação das migrations 22 a 26 na produção (2026-11-11)

**Sintoma (F):** o totem ativado mostrava "serviço de reconhecimento indisponível" ao escanear. O app exibe esse texto para qualquer resposta 503 (`mobile/lib/errors.ts`). Em produção o backend força o guarda de replay persistente (`config.py:93-95`) e chama `claim_recognition_request`, que não existia (**I**: causa do 503; os logs do Cloud Run não estavam acessíveis).

**Ação (F):** aprovada pelo mantenedor no chat e aplicada uma migration por vez, pelo Supabase, na ordem 22, 23, 24, 25, 26. Cada uma devolveu sucesso e entrou no registro como `022_` a `026_`. O conteúdo é o dos arquivos de `backend/migrations/`, sem os `BEGIN/COMMIT` (o aplicador já abre transação).

**Verificação depois (F):**
- Existem `recognition_requests`, `admin_audit_log` e as funções `claim_`, `complete_`, `fail_` e `purge_recognition_request(s)`, `register_presence_event`, `presence_lock_key`, `kiosk_presence`, `kiosk_directory`, `public_lab_stats`, `revoke_profile_consent`, `delete_profile_cascade` e `replace_profile_embeddings`.
- `verify_tutor_login` e `sync_tutor_credentials` foram removidas.
- `anon` não executa `claim_recognition_request`; `authenticated` não executa `register_presence_event`; `service_role` executa.
- As contagens de dados não mudaram (53 perfis, 1432 sessões, 72 templates).
- O mantenedor confirmou que o escaneamento no tablet voltou a funcionar.

**Limites:** a 28 não foi aplicada (revoga leitura anônima das tabelas e depende de confirmar a tela pública). O catálogo da produção não foi comparado função a função com os arquivos (NV).
