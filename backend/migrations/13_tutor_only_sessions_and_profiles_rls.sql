-- Migration 13: Tutor-Only RBAC for Sessions and Profiles (RLS)
-- Revoga a leitura anônima de sessões (Migration 07) e restringe consultas de sessões e perfis
-- exclusivamente para usuários autenticados com papel de Tutor (app_metadata->>'role' = 'tutor').
--
-- INVARIANTE DE SEGURANÇA:
-- Consultas anônimas ou de usuários sem o papel 'tutor' serão estritamente bloqueadas (fail-closed).
-- O backend (service_role) permanece operacional sem alterações.

BEGIN;

-- ─── 1. Revoga políticas de leitura anônima em sessions ──────────────────────
DROP POLICY IF EXISTS "anon_select_open_sessions" ON public.sessions;
DROP POLICY IF EXISTS "anon_select_sessions" ON public.sessions;

-- ─── 2. Cria política estrita de leitura exclusiva para Tutores em sessions ───
DROP POLICY IF EXISTS "tutor_select_sessions" ON public.sessions;
CREATE POLICY "tutor_select_sessions"
  ON public.sessions FOR SELECT TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'tutor'
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'tutor'
  );

-- ─── 3. Restringe leitura de profiles para tutores autenticados ───────────────
-- Mantém leitura segura de profiles ativos apenas para tutores autenticados
DROP POLICY IF EXISTS "tutor_select_profiles" ON public.profiles;
CREATE POLICY "tutor_select_profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'tutor'
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'tutor'
  );

-- ─── 4. Recarrega o cache do PostgREST ────────────────────────────────────────
NOTIFY pgrst, 'reload schema';

COMMIT;
