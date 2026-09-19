-- Migration 15: RLS final e policies otimizadas
-- Mantém apenas a leitura pública mínima necessária para a lista de presentes.

BEGIN;

DROP POLICY IF EXISTS tutor_write_profiles ON public.profiles;
DROP POLICY IF EXISTS tutor_write_sessions ON public.sessions;
DROP POLICY IF EXISTS authenticated_select_profiles ON public.profiles;
DROP POLICY IF EXISTS authenticated_select_sessions ON public.sessions;
DROP POLICY IF EXISTS authenticated_select_logs ON public.face_logs;
DROP POLICY IF EXISTS anon_select_sessions ON public.sessions;
DROP POLICY IF EXISTS anon_select_open_sessions ON public.sessions;
DROP POLICY IF EXISTS service_role_all_sync_cursor ON public.sync_cursor;

CREATE POLICY tutor_select_profiles
  ON public.profiles FOR SELECT TO authenticated
  USING (
    ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'tutor'
    OR ((select auth.jwt()) -> 'user_metadata' ->> 'role') = 'tutor'
  );

CREATE POLICY tutor_write_profiles
  ON public.profiles FOR INSERT, UPDATE, DELETE TO authenticated
  USING (
    ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'tutor'
    OR ((select auth.jwt()) -> 'user_metadata' ->> 'role') = 'tutor'
  )
  WITH CHECK (
    ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'tutor'
    OR ((select auth.jwt()) -> 'user_metadata' ->> 'role') = 'tutor'
  );

CREATE POLICY tutor_select_sessions
  ON public.sessions FOR SELECT TO authenticated
  USING (
    ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'tutor'
    OR ((select auth.jwt()) -> 'user_metadata' ->> 'role') = 'tutor'
  );

CREATE POLICY tutor_write_sessions
  ON public.sessions FOR INSERT, UPDATE, DELETE TO authenticated
  USING (
    ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'tutor'
    OR ((select auth.jwt()) -> 'user_metadata' ->> 'role') = 'tutor'
  )
  WITH CHECK (
    ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'tutor'
    OR ((select auth.jwt()) -> 'user_metadata' ->> 'role') = 'tutor'
  );

CREATE POLICY tutor_select_logs
  ON public.face_logs FOR SELECT TO authenticated
  USING (
    ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'tutor'
    OR ((select auth.jwt()) -> 'user_metadata' ->> 'role') = 'tutor'
  );

-- O totem continua vendo somente quem está presente agora, nunca o histórico fechado.
CREATE POLICY anon_select_open_sessions
  ON public.sessions FOR SELECT TO anon
  USING (check_out IS NULL AND voided_at IS NULL);

CREATE POLICY service_role_all_sync_cursor
  ON public.sync_cursor FOR ALL TO service_role
  USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
COMMIT;
