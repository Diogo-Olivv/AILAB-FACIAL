# Snapshot do estado de produção (somente leitura)

> **Capturado em:** 2026-11-11 03:08:05 UTC · **Projeto Supabase:** `ailab-facial` (região sa-east-1) · **Postgres:** 17.6
> **Método:** consultas `SELECT` via Supabase MCP (sem DDL, sem DML). Sem IDs de usuário, e-mails ou valores de credenciais neste documento.
> **Validade:** este snapshot envelhece. Produção muda sem aviso (ver `CODE_DB_DRIFT.md`). Reexecutar antes de qualquer decisão.

Legenda: **F** fato observado nesta captura · **I** inferência · **NV** não verificado.

## 1. Registro de migrations (F)

Tabela `supabase_migrations.schema_migrations`: **10 entradas**.

| Versão | Nome registrado |
|---|---|
| 20260817161352 | 001_initial_schema |
| 20260817161401 | 002_rls_and_rpc |
| 20260817161408 | 003_realtime |
| 20260910155450 | enable_rls_and_lgpd |
| 20260910155513 | sessions_concurrency_and_duration |
| 20260910155529 | pgvector_and_maintenance |
| 20260919202521 | 014_harden_tutor_rpc_permissions |
| 20260919202534 | 015_harden_rls_policies |
| 20260919202626 | 016_optimize_tutor_rls_policies |
| 20260929174408 | universal_tutor_linking_and_roles |

Os nomes não seguem a numeração de `backend/migrations/` (01–29). Não há registro reconhecível para as migrations 17–29 do repositório: os objetos delas aparecem (ou não) na seção 2, independentemente do registro.

## 2. Objetos existentes (F)

**Tabelas em `public` (6):** `attendance_justifications`, `face_embeddings`, `face_logs`, `profiles`, `sessions`, `sync_cursor`.

**Funções em `public` (18):** `attendance_require_tutor`, `attendance_row_json`, `justify_attendance_debt`, `last_event_time`, `link_tutor_profile`, `list_attendance_justifications`, `match_face`, `require_tutor_or_service`, `revoke_attendance_justification`, `sweep_stale_sessions`, `sync_tutor_credentials`, `tutor_close_session`, `tutor_delete_session`, `tutor_register_entry`, `tutor_remove_member`, `tutor_unvoid_session`, `tutor_void_session`, `verify_tutor_login`.

**Policies RLS em `public`:** 19.

**Objetos presentes no código atual e AUSENTES no banco (F):**

| Objeto | Migration de origem | Efeito no código |
|---|---|---|
| `register_presence_event` | 24 | Usado por padrão quando `presence_via_rpc=True` (`backend/app/config.py:71`, `backend/app/services/session_service.py:133`) |
| `recognition_requests` (tabela) | 25 | Usada por padrão quando `persistent_replay_guard=True` (`config.py:70`) |
| `admin_audit_log` (tabela) | 26 | Gravada por `backend/app/routers/kiosks.py:60-64` |
| `kiosk_presence`, `kiosk_directory`, `public_lab_stats` | 23 | Chamadas por `mobile/hooks/usePresence.ts:51`, `mobile/hooks/useProfiles.ts:21`, `web/src/lib/reports.ts:45` |
| `revoke_profile_consent`, `delete_profile_cascade`, `replace_profile_embeddings` | 26 | Chamadas por `backend/app/routers/profiles.py:137,161` |

Contagem de objetos de código ausentes: **0 de 7 funções-chave presentes** (consulta direta, 2026-11-11).

**Objetos presentes com origem em migration posterior ao registro:** `attendance_justifications` e funções `justify_attendance_debt`, `list_attendance_justifications`, `revoke_attendance_justification` (migration 27) existem, mas a migration 27 não está registrada (F).

**Login legado (F):** `verify_tutor_login` e `sync_tutor_credentials` existem. Ambas são `SECURITY DEFINER`. O corpo de `verify_tutor_login` contém o literal de domínio de tutor e uso de `crypt` (verificado sem exibir o corpo). Migrations 22 e 19 as removeriam ou não se aplicam (ver `REMEDIATION_STATUS.md`, item AF-14).

## 3. Contas (F, contagens apenas)

| Papel em `app_metadata` | Total | Ativas (sem `banned_until`) |
|---|---|---|
| `tutor` | 7 | 7 |
| `kiosk` | **0** | 0 |
| usuário semeado pela migration 19 | 1 | 1 |

**Consequência (F + I):** não existe nenhum totem com credencial própria. O código de kiosk exige JWT de conta `kiosk` (`backend/app/deps.py`, `verify_kiosk_identity`). A remoção da chave compartilhada depende de provisionar totens antes (`REMEDIATION_STATUS.md`, AF-04).

## 4. Privilégios efetivos (F)

Grants em tabelas de `public` para `anon` e `authenticated` após a revogação manual de 2026-11-10:

| Tabela | `anon` | `authenticated` |
|---|---|---|
| `profiles` | SELECT | DELETE, INSERT, SELECT, UPDATE |
| `sessions` | SELECT | DELETE, INSERT, SELECT, UPDATE |
| `face_logs` | SELECT | DELETE, INSERT, SELECT, UPDATE |
| `face_embeddings` | SELECT | DELETE, INSERT, SELECT, UPDATE |
| `sync_cursor` | SELECT | DELETE, INSERT, SELECT, UPDATE |

Observações (F):
- `anon` mantém **SELECT** em `face_embeddings` e `face_logs`. Isso só é inócuo se as policies de RLS não permitirem linhas a `anon`. Não verificado nesta captura (NV) para cada tabela.
- `anon` mantém SELECT em `profiles` e `sessions`. Migration 28 (não aplicada) removeria esse acesso.
- `EXECUTE` de `link_tutor_profile`: concedido a `authenticated`, `postgres` e `service_role`. **Não** a `anon` (revogação de 2026-11-10 mantida).

RLS: ativado e forçado em `profiles`, `sessions`, `face_logs` e `face_embeddings`. `sync_cursor` tem RLS ativado sem FORCE (F).

## 5. Advisors do Supabase (F, 2026-11-11 03:01 UTC)

**Segurança:**
- `authenticated_security_definer_function_executable` (WARN, 4 ocorrências): `justify_attendance_debt`, `link_tutor_profile`, `list_attendance_justifications`, `revoke_attendance_justification` são `SECURITY DEFINER` executáveis por `authenticated`. `link_tutor_profile` é o caso que exige revisão: não verifica identidade do chamador além do papel (ver `FINDINGS.md`).
- `auth_leaked_password_protection` (WARN): proteção contra senhas vazadas (HaveIBeenPwned) **desativada**.

**Performance:**
- `unindexed_foreign_keys` (INFO, 2): `attendance_justifications_justified_by_fkey` e `attendance_justifications_revoked_by_fkey`.
- `unused_index` (INFO, 3): `idx_face_embeddings_hnsw`, `idx_profiles_is_tutor`, `idx_attendance_justifications_period`. O índice HNSW "nunca usado" pode indicar que a busca vetorial não está passando pelo índice (I; confirmar com `EXPLAIN` na consulta de `match_face`).
- `multiple_permissive_policies` (WARN, 6 ocorrências): `profiles` e `sessions` têm `tutor_write_*` (FOR ALL) somado a `tutor_select_*`, `tutor_update_*`, `tutor_delete_*` para `authenticated`. Redundante e custa avaliação extra por linha.

## 6. Backend implantado (F, leitura HTTP pública)

Serviço Cloud Run `ailab-facial-api` (URL usada em `mobile/eas.json`):

- `GET /health` → 200 `{"status":"ok"}`.
- `GET /health/ready` → 200 `{"status":"ready","models_loaded":true}`.
- `GET /api/v1/recognize/challenge` sem autenticação → 401.
- `GET /openapi.json` → título `AILAB-FACIAL API`, versão `1.0.0`, **17 caminhos**:

| Caminho | Métodos |
|---|---|
| `/api/v1/enroll` | POST |
| `/api/v1/kiosks` | GET, POST |
| `/api/v1/kiosks/{kiosk_id}` | DELETE |
| `/api/v1/maintenance/cleanup` | POST |
| `/api/v1/profiles/{profile_id}` | DELETE, GET |
| `/api/v1/profiles/{profile_id}/refresh-embedding` | POST |
| `/api/v1/profiles/{profile_id}/revoke-consent` | POST |
| `/api/v1/recognize` | POST |
| `/api/v1/recognize/challenge` | GET, POST |
| `/api/v1/sessions/close-stale` | POST |
| `/api/v1/sessions/entry` | POST |
| `/api/v1/sessions/manual` | POST |
| `/api/v1/sessions/open` | GET |
| `/api/v1/sessions/stats/{profile_id}` | GET |
| `/api/v1/sessions/tutor-close` | POST |
| `/health` | GET |
| `/health/ready` | GET |

**Não verificado (NV):** variáveis de ambiente do serviço (`ENVIRONMENT`, `PRESENCE_VIA_RPC`, `PERSISTENT_REPLAY_GUARD`). Confirmar só por leitura da configuração no Cloud Run, sem escrever. A incompatibilidade com o banco (seção 2) só se confirma com essa leitura e com logs de erro de RPC.

## 7. Como reproduzir

```sql
-- Somente leitura. Reexecutar antes de congelar qualquer conclusão.
select now() as capturado_em_utc,
       (select count(*) from supabase_migrations.schema_migrations) as migrations_registradas,
       (select count(*) from information_schema.tables where table_schema = 'public') as tabelas_public,
       (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public') as funcoes_public,
       (select count(*) from pg_policies where schemaname = 'public') as policies,
       (select count(*) from auth.users where raw_app_meta_data ->> 'role' = 'tutor') as contas_tutor,
       (select count(*) from auth.users where raw_app_meta_data ->> 'role' = 'kiosk') as contas_kiosk;
```

Grants e objetos ausentes: consultar `information_schema.role_table_grants` e `pg_proc` pelos nomes da seção 2.

Advisors: ferramenta `get_advisors` (tipos `security` e `performance`) do Supabase.
