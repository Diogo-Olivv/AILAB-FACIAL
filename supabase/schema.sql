-- AILAB-FACIAL — Schema Supabase (PostgreSQL)
-- Aplicar em: Supabase Studio > SQL Editor, ou `supabase db push`.
--
-- Modelo de acesso (reconhecimento server-side com InsightFace no backend):
--   - profiles / sessions: leitura para usuarios AUTENTICADOS (dashboard web e app).
--   - reconhecimento, cadastro e escrita de sessoes: feitos pelo backend usando a
--     service_role key, que ignora RLS. Nenhum cliente escreve biometria nem sessoes.
--   - face_embeddings: sem policy alguma => acessivel APENAS pela service_role
--     (backend). A biometria nunca chega ao browser nem ao app.
--   - escrita direta de profiles/sessions fica disponivel so ao OWNER (correcoes
--     manuais pelo painel), identificado pelo email no JWT.

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
-- Descritor facial 512-D (InsightFace buffalo_s), L2-normalizado, gerado no
-- cadastro pelo backend. Isolado por LGPD: acesso exclusivo da service_role, o
-- match acontece no servidor e o vetor nunca sai do backend.
create table if not exists public.face_embeddings (
    profile_id uuid primary key references public.profiles (id) on delete cascade,
    embedding  jsonb not null,
    updated_at timestamptz not null default now()
);

-- ─── sessions ────────────────────────────────────────────────────────────────
-- Uma linha por permanencia (check-in ... check-out). duration_s e calculado.
-- confirmacao: 'auto' quando o reconhecimento facial bateu e o usuario confirmou;
--   'manual' quando escolheu o nome na lista de fallback.
-- abandoned: sessao fechada por exceder o limite sem registro de saida (check_out
--   ficticio = check_in + limite); nesses casos a duracao nao representa presenca real.
create table if not exists public.sessions (
    id          bigint generated always as identity primary key,
    profile_id  uuid not null references public.profiles (id) on delete cascade,
    check_in    timestamptz not null default now(),
    check_out   timestamptz,
    confirmacao text not null default 'auto',
    abandoned   boolean not null default false,
    duration_s  integer generated always as (
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

-- ─── is_owner ────────────────────────────────────────────────────────────────
-- Ponto unico que define quem e o dono (dispositivo do laboratorio). Trocar o
-- email aqui muda todas as policies de escrita e de acesso a biometria.
create or replace function public.is_owner()
returns boolean
language sql
stable
as $$
    select coalesce(auth.jwt() ->> 'email', '') = 'diogocorjesu@gmail.com';
$$;

-- ─── Row Level Security ──────────────────────────────────────────────────────
alter table public.profiles        enable row level security;
alter table public.sessions        enable row level security;
alter table public.face_embeddings enable row level security;
alter table public.face_logs       enable row level security;

-- profiles: qualquer autenticado le (dashboard e app); so o owner escreve (correcoes).
drop policy if exists profiles_read_authenticated on public.profiles;
create policy profiles_read_authenticated
    on public.profiles for select to authenticated using (true);

drop policy if exists profiles_write_owner on public.profiles;
create policy profiles_write_owner
    on public.profiles for all to authenticated
    using (public.is_owner()) with check (public.is_owner());

-- sessions: qualquer autenticado le (dashboard); backend escreve via service_role.
-- O owner mantem escrita direta para correcoes manuais pelo painel.
drop policy if exists sessions_read_authenticated on public.sessions;
create policy sessions_read_authenticated
    on public.sessions for select to authenticated using (true);

drop policy if exists sessions_write_owner on public.sessions;
create policy sessions_write_owner
    on public.sessions for all to authenticated
    using (public.is_owner()) with check (public.is_owner());

-- face_embeddings: sem policy => somente service_role (backend). A biometria nunca
-- chega a nenhum cliente autenticado.
drop policy if exists face_embeddings_owner on public.face_embeddings;

-- face_logs: leitura do owner para auditoria; escrita vem do backend (service_role).
drop policy if exists face_logs_owner on public.face_logs;
create policy face_logs_owner
    on public.face_logs for all to authenticated
    using (public.is_owner()) with check (public.is_owner());
