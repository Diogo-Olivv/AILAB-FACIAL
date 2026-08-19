-- Schema autoritativo do Supabase para o backend AILAB-FACIAL.
-- Fonte de verdade: deve refletir exatamente o que o codigo em app/ acessa.
-- Idempotente: pode ser rodado no SQL Editor do Supabase a qualquer momento.

-- ── Tabelas ───────────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  matricula text,
  avatar_url text,
  active boolean not null default true,
  consent_given boolean not null default false,
  consent_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.face_embeddings (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  embedding double precision[] not null,
  created_at timestamptz not null default now()
);

create table if not exists public.sessions (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  check_in timestamptz not null,
  check_out timestamptz
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
alter table public.profiles add column if not exists created_at timestamptz not null default now();

-- Embedding vive em face_embeddings; coluna homonima em profiles e vestigial.
alter table public.profiles drop column if exists embedding;

-- ── Indices ─────────────────────────────────────────────────────────────────────

create index if not exists idx_sessions_profile_open
  on public.sessions (profile_id) where check_out is null;
create index if not exists idx_face_embeddings_profile
  on public.face_embeddings (profile_id);

-- ── RPC ─────────────────────────────────────────────────────────────────────────
-- session_service._last_event_ts() depende de last_event_time(p_profile_id uuid).
-- Ja existe no banco; recriar so se montar um ambiente do zero.

notify pgrst, 'reload schema';
