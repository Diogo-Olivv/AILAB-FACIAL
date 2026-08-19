-- Colunas de consentimento LGPD exigidas pelo enroll_service.enroll().
-- Rodar no SQL Editor do Supabase. Idempotente.

alter table public.profiles
  add column if not exists consent_given boolean not null default false,
  add column if not exists consent_at timestamptz;

notify pgrst, 'reload schema';
