-- Schema autoritativo do Supabase para o backend AILAB-FACIAL.
-- Fonte de verdade: deve refletir exatamente o que o codigo em app/ acessa.
-- Idempotente: pode ser rodado no SQL Editor do Supabase a qualquer momento.

-- ── Extensões ─────────────────────────────────────────────────────────────────
create extension if not exists vector;

-- ── Tabelas ───────────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  matricula text,
  avatar_url text,
  active boolean not null default true,
  consent_given boolean not null default false,
  consent_at timestamptz,
  terms_version text default 'v1.0',
  consent_revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.face_embeddings (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  embedding double precision[] not null,
  vec vector(512),
  created_at timestamptz not null default now()
);

create table if not exists public.sessions (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  check_in timestamptz not null,
  check_out timestamptz,
  voided_at timestamptz,  -- saída esquecida (sessão > max_session_hours): não conta horas
  auto_closed boolean not null default false,
  duration_s integer generated always as (
    case
      when check_out is not null and voided_at is null then
        greatest(0, extract(epoch from (check_out - check_in))::integer)
      else null
    end
  ) stored
);

create table if not exists public.face_logs (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  confidence double precision,
  created_at timestamptz not null default now()
);

-- ── Reconciliacao de bancos criados antes deste arquivo ─────────────────────────

alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists active boolean not null default true;
alter table public.profiles add column if not exists consent_given boolean not null default false;
alter table public.profiles add column if not exists consent_at timestamptz;
alter table public.profiles add column if not exists terms_version text default 'v1.0';
alter table public.profiles add column if not exists consent_revoked_at timestamptz;
alter table public.profiles add column if not exists created_at timestamptz not null default now();

-- Embedding vive em face_embeddings; coluna homonima em profiles e vestigial.
alter table public.profiles drop column if exists embedding;
alter table public.face_embeddings add column if not exists vec vector(512);

alter table public.sessions add column if not exists voided_at timestamptz;
alter table public.sessions add column if not exists auto_closed boolean not null default false;
alter table public.sessions add column if not exists duration_s integer generated always as (
  case
    when check_out is not null and voided_at is null then
      greatest(0, extract(epoch from (check_out - check_in))::integer)
    else null
  end
) stored;

-- ── Indices ─────────────────────────────────────────────────────────────────────

-- Índice parcial ÚNICO: impede múltiplas sessões abertas simultâneas para o mesmo perfil (Race Condition)
drop index if exists public.idx_sessions_profile_open;
create unique index if not exists idx_sessions_profile_single_open
  on public.sessions (profile_id) where check_out is null;

create index if not exists idx_face_embeddings_profile
  on public.face_embeddings (profile_id);

-- Índice HNSW com operador de distância cosseno (<=>) para busca vetorial acelerada
create index if not exists idx_face_embeddings_hnsw
  on public.face_embeddings
  using hnsw (vec vector_cosine_ops)
  with (m = 24, ef_construction = 128);

-- ── Row Level Security (RLS) Mandatório ──────────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.profiles force row level security;

alter table public.face_embeddings enable row level security;
alter table public.face_embeddings force row level security;

alter table public.sessions enable row level security;
alter table public.sessions force row level security;

alter table public.face_logs enable row level security;
alter table public.face_logs force row level security;

-- Limpeza de políticas existentes para re-execução idempotente
drop policy if exists "service_role_all_profiles" on public.profiles;
drop policy if exists "service_role_all_embeddings" on public.face_embeddings;
drop policy if exists "service_role_all_sessions" on public.sessions;
drop policy if exists "service_role_all_logs" on public.face_logs;

drop policy if exists "anon_select_active_profiles" on public.profiles;
drop policy if exists "anon_select_open_sessions" on public.sessions;

drop policy if exists "authenticated_select_profiles" on public.profiles;
drop policy if exists "authenticated_update_profiles" on public.profiles;
drop policy if exists "tutor_write_profiles" on public.profiles;
drop policy if exists "authenticated_select_sessions" on public.sessions;
drop policy if exists "authenticated_manage_sessions" on public.sessions;
drop policy if exists "tutor_write_sessions" on public.sessions;
drop policy if exists "authenticated_select_logs" on public.face_logs;

-- 1. Políticas para service_role (Backend FastAPI via SUPABASE_SERVICE_KEY)
create policy "service_role_all_profiles"
  on public.profiles for all to service_role using (true) with check (true);

create policy "service_role_all_embeddings"
  on public.face_embeddings for all to service_role using (true) with check (true);

create policy "service_role_all_sessions"
  on public.sessions for all to service_role using (true) with check (true);

create policy "service_role_all_logs"
  on public.face_logs for all to service_role using (true) with check (true);

-- 2. Políticas para anon (Kiosk Tablet / App Mobile Público)
-- 'anon' pode ler apenas nomes e avatares de perfis ativos (para exibir na sidebar de presença)
create policy "anon_select_active_profiles"
  on public.profiles for select to anon
  using (active = true and consent_revoked_at is null);

-- 'anon' pode ler todas as sessões válidas (abertas ou fechadas) para o Painel do Aluno; sessões anuladas permanecem ocultas
create policy "anon_select_sessions"
  on public.sessions for select to anon
  using (voided_at is null);

-- Bloqueio Total para 'anon': face_embeddings e face_logs não possuem NENHUMA policy para anon,
-- garantindo que qualquer tentativa de select/insert/update/delete com a anon key resulte em erro/vazio.

-- 3. Políticas para authenticated (Tutores autenticados no Painel Web - restrito a app_metadata)
drop policy if exists "authenticated_select_profiles" on public.profiles;
drop policy if exists "authenticated_update_profiles" on public.profiles;
drop policy if exists "tutor_write_profiles" on public.profiles;
drop policy if exists "tutor_update_profiles" on public.profiles;
drop policy if exists "tutor_delete_profiles" on public.profiles;
drop policy if exists "tutor_select_profiles" on public.profiles;

create policy "tutor_select_profiles"
  on public.profiles for select to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'tutor');

create policy "tutor_write_profiles"
  on public.profiles for insert to authenticated
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'tutor');

create policy "tutor_update_profiles"
  on public.profiles for update to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'tutor')
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'tutor');

create policy "tutor_delete_profiles"
  on public.profiles for delete to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'tutor');

drop policy if exists "authenticated_select_sessions" on public.sessions;
drop policy if exists "authenticated_manage_sessions" on public.sessions;
drop policy if exists "tutor_write_sessions" on public.sessions;
drop policy if exists "tutor_update_sessions" on public.sessions;
drop policy if exists "tutor_delete_sessions" on public.sessions;
drop policy if exists "tutor_select_sessions" on public.sessions;

create policy "tutor_select_sessions"
  on public.sessions for select to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'tutor');

create policy "tutor_write_sessions"
  on public.sessions for insert to authenticated
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'tutor');

create policy "tutor_update_sessions"
  on public.sessions for update to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'tutor')
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'tutor');

create policy "tutor_delete_sessions"
  on public.sessions for delete to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'tutor');

drop policy if exists "authenticated_select_logs" on public.face_logs;
drop policy if exists "tutor_select_logs" on public.face_logs;

create policy "tutor_select_logs"
  on public.face_logs for select to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'tutor');

-- ── Funções e RPCs ─────────────────────────────────────────────────────────────

-- RPC match_face: busca vetorial acelerada por HNSW e distância cosseno (<=>)
-- match_threshold opera em distância cosseno (1 - cos): <= 0.32 corresponde a similaridade >= 0.68
drop function if exists public.match_face(vector(512), float8, int);
drop function if exists public.match_face(vector, float8, int);
drop function if exists public.match_face(vector(512), float, int);

create or replace function public.match_face(
  query_embedding vector(512),
  match_threshold float8 default 0.32,
  match_count int default 1
)
returns table (
  profile_id uuid,
  name text,
  avatar_url text,
  similarity float8
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    p.id as profile_id,
    p.name,
    p.avatar_url,
    (1.0 - (fe.vec <=> query_embedding))::float8 as similarity
  from public.face_embeddings fe
  join public.profiles p on p.id = fe.profile_id
  where p.active = true
    and (fe.vec is not null)
    and (fe.vec <=> query_embedding) <= match_threshold
  order by fe.vec <=> query_embedding asc
  limit match_count;
end;
$$;

revoke all on function public.match_face(vector(512), float8, int) from public, anon, authenticated;
grant execute on function public.match_face(vector(512), float8, int) to service_role;

-- ── Publicação Supabase Realtime ───────────────────────────────────────────────
-- Permite que clientes WebSocket (ex: tablet kiosk) recebam mutações em sessions
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sessions'
  ) then
    alter publication supabase_realtime add table public.sessions;
  end if;
end $$;

-- ── Notificação para Reload de Cache no PostgREST ────────────────────────────────

notify pgrst, 'reload schema';
