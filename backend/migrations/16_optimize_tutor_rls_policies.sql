-- Migration 16: remove sobreposição de policies e otimizar auth.jwt()

BEGIN;

DROP POLICY IF EXISTS tutor_select_profiles ON public.profiles;
DROP POLICY IF EXISTS tutor_write_profiles ON public.profiles;
DROP POLICY IF EXISTS tutor_select_sessions ON public.sessions;
DROP POLICY IF EXISTS tutor_write_sessions ON public.sessions;
DROP POLICY IF EXISTS tutor_select_logs ON public.face_logs;

CREATE POLICY tutor_select_profiles
  ON public.profiles FOR SELECT TO authenticated
  USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'tutor'
    OR ((select auth.jwt()) -> 'user_metadata' ->> 'role') = 'tutor');

CREATE POLICY tutor_write_profiles
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'tutor'
    OR ((select auth.jwt()) -> 'user_metadata' ->> 'role') = 'tutor');

CREATE POLICY tutor_update_profiles
  ON public.profiles FOR UPDATE TO authenticated
  USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'tutor'
    OR ((select auth.jwt()) -> 'user_metadata' ->> 'role') = 'tutor')
  WITH CHECK (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'tutor'
    OR ((select auth.jwt()) -> 'user_metadata' ->> 'role') = 'tutor');

CREATE POLICY tutor_delete_profiles
  ON public.profiles FOR DELETE TO authenticated
  USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'tutor'
    OR ((select auth.jwt()) -> 'user_metadata' ->> 'role') = 'tutor');

CREATE POLICY tutor_select_sessions
  ON public.sessions FOR SELECT TO authenticated
  USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'tutor'
    OR ((select auth.jwt()) -> 'user_metadata' ->> 'role') = 'tutor');

CREATE POLICY tutor_write_sessions
  ON public.sessions FOR INSERT TO authenticated
  WITH CHECK (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'tutor'
    OR ((select auth.jwt()) -> 'user_metadata' ->> 'role') = 'tutor');

CREATE POLICY tutor_update_sessions
  ON public.sessions FOR UPDATE TO authenticated
  USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'tutor'
    OR ((select auth.jwt()) -> 'user_metadata' ->> 'role') = 'tutor')
  WITH CHECK (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'tutor'
    OR ((select auth.jwt()) -> 'user_metadata' ->> 'role') = 'tutor');

CREATE POLICY tutor_delete_sessions
  ON public.sessions FOR DELETE TO authenticated
  USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'tutor'
    OR ((select auth.jwt()) -> 'user_metadata' ->> 'role') = 'tutor');

CREATE POLICY tutor_select_logs
  ON public.face_logs FOR SELECT TO authenticated
  USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'tutor'
    OR ((select auth.jwt()) -> 'user_metadata' ->> 'role') = 'tutor');

NOTIFY pgrst, 'reload schema';
COMMIT;
