-- AILAB-FACIAL — Schema Supabase (PostgreSQL)
-- Aplicar em: Supabase Studio > SQL Editor, ou `supabase db push`.
--
-- Modelo de acesso:
--   - profiles / sessions: leitura liberada para usuarios AUTENTICADOS (dashboard).
--   - face_embeddings / face_logs / sync_cursor: sem policy => acessiveis apenas
--     pelo service_role (backend). Dado biometrico nunca chega pela chave anon.

-- Extensao para gen_random_uuid()
create extension if not exists "pgcrypto";

-- ─── profiles ────────────────────────────────────────────────────────────────
-- Metadado publico do integrante (sem biometria).
create table if not exists public.profiles (
    id            uuid primary key default gen_random_uuid(),
    name          text not null,
    matricula     text unique,
    avatar_url    text,
    active        boolean not null default true,
    consent_given boolean not null default false,
    consent_at    timestamptz,
    created_at    timestamptz not null default now()
);

-- ─── face_embeddings ─────────────────────────────────────────────────────────
-- Vetor facial 512-D (InsightFace buffalo_s) normalizado L2. Isolado por LGPD.
create table if not exists public.face_embeddings (
    profile_id uuid primary key references public.profiles (id) on delete cascade,
    embedding  jsonb not null,
    updated_at timestamptz not null default now()
);

-- ─── sessions ────────────────────────────────────────────────────────────────
-- Uma linha por permanencia (check-in ... check-out). duration_s e calculado.
create table if not exists public.sessions (
    id         bigint generated always as identity primary key,
    profile_id uuid not null references public.profiles (id) on delete cascade,
    check_in   timestamptz not null default now(),
    check_out  timestamptz,
    duration_s integer generated always as (
        case
            when check_out is not null
            then floor(extract(epoch from (check_out - check_in)))::int
        end
    ) stored
);

create index if not exists sessions_profile_open_idx
    on public.sessions (profile_id)
    where check_out is null;

create index if not exists sessions_check_in_idx
    on public.sessions (check_in);

-- ─── face_logs ───────────────────────────────────────────────────────────────
-- Log bruto de cada reconhecimento (auditoria / ajuste de threshold).
create table if not exists public.face_logs (
    id         bigint generated always as identity primary key,
    profile_id uuid references public.profiles (id) on delete cascade,
    confidence real,
    created_at timestamptz not null default now()
);

-- ─── sync_cursor ─────────────────────────────────────────────────────────────
-- Cursor de idempotencia para sync incremental (Google Sheets legado).
create table if not exists public.sync_cursor (
    key   text primary key,
    value text not null
);

-- ─── RPC last_event_time ─────────────────────────────────────────────────────
-- Ultimo instante de qualquer evento (check-in ou check-out) do integrante.
-- Usado pelo backend para debounce eficiente.
create or replace function public.last_event_time(p_profile_id uuid)
returns timestamptz
language sql
stable
as $$
    select max(t) from (
        select check_in  as t from public.sessions where profile_id = p_profile_id
        union all
        select check_out from public.sessions
            where profile_id = p_profile_id and check_out is not null
    ) events;
$$;

grant execute on function public.last_event_time(uuid) to authenticated, service_role;

-- ─── Row Level Security ──────────────────────────────────────────────────────
alter table public.profiles        enable row level security;
alter table public.sessions        enable row level security;
alter table public.face_embeddings enable row level security;
alter table public.face_logs       enable row level security;
alter table public.sync_cursor     enable row level security;

-- Autenticados podem LER metadados e sessoes (dashboard). Escrita so via backend.
drop policy if exists profiles_read_authenticated on public.profiles;
create policy profiles_read_authenticated
    on public.profiles for select to authenticated using (true);

drop policy if exists sessions_read_authenticated on public.sessions;
create policy sessions_read_authenticated
    on public.sessions for select to authenticated using (true);

-- face_embeddings, face_logs, sync_cursor: sem policy => somente service_role.
