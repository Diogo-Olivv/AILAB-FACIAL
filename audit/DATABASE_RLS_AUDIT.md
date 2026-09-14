# AILAB-FACIAL V4 — AUDITORIA PROFUNDA DE BANCO DE DADOS, MIGRATIONS & RLS

**Data:** 13 de Setembro de 2026  
**Auditoria:** AILAB-FACIAL V4  
**Ambiente:** PostgreSQL 15+ / Supabase / PostgREST / pgvector  
**Status:** AUDITED  

---

## 1. Matriz de Tabelas e Políticas Row Level Security (RLS)

| Tabela | Colunas Sensíveis | RLS Habilitado | RLS Forçado | Política `service_role` | Política `anon` | Política `authenticated` | Veredito de Segurança |
|---|---|:---:|:---:|---|---|---|:---:|
| **`public.profiles`** | `matricula`, `terms_version`, `consent_revoked_at` | ✅ Sim | ✅ Sim | `FOR ALL USING (true)` | `SELECT` onde `active = true AND consent_revoked_at IS NULL` | **Schema Legado:** `SELECT / UPDATE USING (true)`<br>**Migration 05:** `FOR ALL USING (role == 'tutor')` | **DIVERGÊNCIA CRÍTICA (Drift entre schema.sql e Migration 05)** |
| **`public.face_embeddings`** | `embedding` (float array), `vec` (vector 512-D) | ✅ Sim | ✅ Sim | `FOR ALL USING (true)` | **Nenhuma** (Bloqueio Total) | **Nenhuma** (Bloqueio Total) | **VERIFIED (Isolamento Forte)** |
| **`public.sessions`** | `check_in`, `check_out`, `voided_at` | ✅ Sim | ✅ Sim | `FOR ALL USING (true)` | `SELECT` onde `check_out IS NULL AND voided_at IS NULL` | **Schema Legado:** `ALL USING (true)`<br>**Migration 05:** `FOR ALL USING (role == 'tutor')` | **DIVERGÊNCIA CRÍTICA (Risco de sobrescrita se schema for rodado)** |
| **`public.face_logs`** | `confidence` | ✅ Sim | ✅ Sim | `FOR ALL USING (true)` | **Nenhuma** (Bloqueio Total) | `SELECT USING (true)` | **VERIFIED** |

---

## 2. Inconsistência Crítica entre `schema.sql` e Migrações (Deployment Drift)

### 2.1 Conflito das Políticas RLS de `authenticated`
- No cabeçalho de `backend/schema.sql` lê-se expressamente:
  `"Fonte de verdade: deve refletir exatamente o que o codigo em app/ acessa. Idempotente: pode ser rodado no SQL Editor do Supabase a qualquer momento."`
- No entanto, nas linhas 155–165 de `schema.sql`:
  ```sql
  create policy "authenticated_update_profiles"
    on public.profiles for update to authenticated
    using (true) with check (true);

  create policy "authenticated_manage_sessions"
    on public.sessions for all to authenticated
    using (true) with check (true);
  ```
- Na migração `backend/migrations/05_secure_rls_policies.sql`, essas duas políticas foram substituídas por políticas restritas a `app_metadata ->> 'role' = 'tutor'`.
- **Risco Material:** Se um administrador de banco de dados ou desenvolvedor re-executar o `schema.sql` no SQL Editor do Supabase (acreditando que se trata da fonte autoritativa de verdade), o banco **reinstala as políticas inseguras**, permitindo que qualquer usuário autenticado (incluindo contas de estudantes ou visualizadores) edite qualquer perfil e crie/altere/delete qualquer registro de presença via PostgREST!

### 2.2 Inversão de Parâmetro na RPC `match_face`
- Em `backend/schema.sql`:
  ```sql
  create or replace function public.match_face(
    query_embedding vector(512),
    match_threshold float default 0.68,
    match_count int default 1
  ) ...
    where p.active = true
      and (1 - (fe.vec <=> query_embedding)) >= match_threshold
  ```
  Aqui, `match_threshold` é uma **similaridade mínima** (onde $1 - \text{dist} \ge \text{threshold}$).
- Na migração `backend/migrations/06_recalibrate_biometrics_hnsw.sql`:
  ```sql
  create or replace function public.match_face(
    query_embedding vector(512),
    match_threshold float8 default 0.32,
    match_count int default 1
  ) ...
    where p.active = true
      and (fe.vec <=> query_embedding) <= match_threshold
  ```
  Aqui, `match_threshold` é uma **distância máxima** (onde $\text{dist} \le \text{threshold}$).
- No backend Python (`backend/app/services/face_service.py#L320-L327`):
  ```python
  max_distance = float(round(1.0 - settings.face_uncertain_cosine, 4)) # 1.0 - 0.62 = 0.38
  res = db.rpc("match_face", {
      "query_embedding": enc.tolist(),
      "match_threshold": max_distance,
      "match_count": 1,
  }).execute()
  ```
- **Consequência Devastadora:** Se o banco for inicializado pelo `schema.sql`, o valor `0.38` passado pelo Python será avaliado como:
  `(1 - dist) >= 0.38` $\rightarrow$ aceitando qualquer candidato que possua similaridade de apenas 38%! Isso quebra completamente a barreira de segurança biométrica do sistema.

---

## 3. Análise da Integridade Transacional e Índices

### 3.1 Índice Parcial Único de Sessões Abertas
- Definição:
  ```sql
  CREATE UNIQUE INDEX idx_sessions_profile_single_open
    ON public.sessions (profile_id)
    WHERE check_out IS NULL;
  ```
- **Avaliação:** **Excelente prática de engenharia de banco.** Impede no nível de armazenamento do PostgreSQL que corridas concorrentes de requests criem mais de um registro em aberto para o mesmo aluno. O código Python captura especificamente a violação de constraint única (código `23505`) e converte em status amigável `already_in`.

### 3.2 Ausência de Transações ACID Multistep no Backend
- Como a biblioteca `@supabase/supabase-js` e o cliente Python do Supabase realizam requisições HTTP REST independentes via PostgREST, o backend executa:
  1. `GET /sessions?...` (Leitura de sessão aberta)
  2. `PATCH /sessions?...` (Atualização de saída)
- Entre o passo 1 e o passo 2 não há transação com lock pessimista (`SELECT FOR UPDATE`). Embora o índice único mitigue a inserção de duplicatas na entrada, transações concorrentes de saída contra entrada podem sofrer inconsistências transitórias.
- **Recomendação:** Encapsular a lógica de transição de `register_event` em uma RPC transacional única no PostgreSQL (`register_session_event(p_profile_id, p_action)`).
