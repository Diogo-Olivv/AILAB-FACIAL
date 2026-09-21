-- Migration 18: Correção de tokens NULL em auth.users, sweep_stale_sessions no pg_cron e RLS hardening
-- 1. Sanitiza tokens em auth.users evitando erro de scan GoTrue no Supabase Dashboard
-- 2. Permite ao pg_cron (executado como usuário postgres) rodar sweep_stale_sessions()
-- 3. Restringe políticas RLS em profiles, sessions e face_logs estritamente ao app_metadata

BEGIN;

-- 1. Sanitização de tokens existentes em auth.users
UPDATE auth.users
SET confirmation_token = coalesce(confirmation_token, ''),
    recovery_token = coalesce(recovery_token, ''),
    email_change_token_new = coalesce(email_change_token_new, ''),
    email_change = coalesce(email_change, '')
WHERE confirmation_token IS NULL
   OR recovery_token IS NULL
   OR email_change_token_new IS NULL
   OR email_change IS NULL;

-- 2. Atualização de sweep_stale_sessions para permitir execução nativa pelo pg_cron (postgres/supabase_admin)
CREATE OR REPLACE FUNCTION public.sweep_stale_sessions()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
DECLARE
  v_now timestamptz := now();
  v_updated_count int := 0;
BEGIN
  IF current_user NOT IN ('postgres', 'supabase_admin') AND coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Rotina de manutenção restrita ao service_role.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.sessions
  SET check_out = v_now, voided_at = v_now, auto_closed = true
  WHERE check_out IS NULL AND ((v_now - check_in) >= interval '10 hours'
    OR (check_in AT TIME ZONE 'America/Sao_Paulo')::date < (v_now AT TIME ZONE 'America/Sao_Paulo')::date);
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'auto_closed', v_updated_count, 'timestamp', v_now);
END;
$$;

-- 3. Atualização de require_tutor_or_service para autorizar superusuário e fechar brecha de user_metadata
CREATE OR REPLACE FUNCTION public.require_tutor_or_service()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, auth, pg_catalog
AS $$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin') OR coalesce(auth.role(), '') = 'service_role' THEN
    RETURN;
  END IF;

  IF coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'tutor' THEN
    RAISE EXCEPTION 'Acesso restrito a tutores autorizados.'
      USING ERRCODE = '42501';
  END IF;
END;
$$;

-- 4. Atualização de sync_tutor_credentials para sempre gravar strings vazias nos tokens ao inserir
CREATE OR REPLACE FUNCTION public.sync_tutor_credentials(
    p_current_email text,
    p_new_email text,
    p_new_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_catalog
AS $$
DECLARE
  v_user_id uuid;
  v_current_user_id uuid;
  v_clean_new text := lower(trim(p_new_email));
  v_clean_curr text := lower(trim(coalesce(p_current_email, '')));
  v_hashed_pw text;
BEGIN
  PERFORM public.require_tutor_or_service();
  IF NOT v_clean_new LIKE '%@ailab.com' THEN
    RAISE EXCEPTION 'O e-mail institucional deve pertencer ao domínio @ailab.com';
  END IF;
  IF length(p_new_password) < 6 THEN
    RAISE EXCEPTION 'A nova senha deve conter pelo menos 6 caracteres';
  END IF;

  IF current_user NOT IN ('postgres', 'supabase_admin') AND coalesce(auth.role(), '') <> 'service_role' THEN
    SELECT id INTO v_current_user_id FROM auth.users WHERE lower(email) = v_clean_curr LIMIT 1;
    IF v_current_user_id IS NULL OR auth.uid() IS DISTINCT FROM v_current_user_id THEN
      RAISE EXCEPTION 'Apenas o próprio tutor pode alterar suas credenciais.' USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = v_clean_new LIMIT 1;
  IF v_user_id IS NOT NULL AND current_user NOT IN ('postgres', 'supabase_admin') AND coalesce(auth.role(), '') <> 'service_role'
     AND v_user_id IS DISTINCT FROM v_current_user_id THEN
    RAISE EXCEPTION 'O novo e-mail já pertence a outro usuário.' USING ERRCODE = '23505';
  END IF;
  IF v_user_id IS NULL AND v_current_user_id IS NOT NULL AND v_clean_curr <> v_clean_new THEN
    v_user_id := v_current_user_id;
  END IF;

  v_hashed_pw := crypt(p_new_password, gen_salt('bf'));
  IF v_user_id IS NOT NULL THEN
    UPDATE auth.users SET email = v_clean_new, encrypted_password = v_hashed_pw,
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      confirmation_token = coalesce(confirmation_token, ''),
      recovery_token = coalesce(recovery_token, ''),
      email_change_token_new = coalesce(email_change_token_new, ''),
      email_change = coalesce(email_change, ''),
      raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"tutor","provider":"email","providers":["email"]}'::jsonb,
      raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'tutor', 'name', split_part(v_clean_new, '@', 1)),
      updated_at = now() WHERE id = v_user_id;
    UPDATE auth.identities SET identity_data = jsonb_build_object('sub', v_user_id::text,
      'email', v_clean_new, 'email_verified', true, 'phone_verified', false), updated_at = now()
      WHERE user_id = v_user_id AND provider = 'email';
  ELSE
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud, is_sso_user, is_anonymous
    ) VALUES (
      v_user_id, '00000000-0000-0000-0000-000000000000', v_clean_new, v_hashed_pw, now(),
      '', '', '', '',
      '{"role":"tutor","provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('role', 'tutor', 'name', split_part(v_clean_new, '@', 1)), now(), now(),
      'authenticated', 'authenticated', false, false
    );
    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', v_clean_new, 'email_verified', true, 'phone_verified', false),
      'email', v_user_id::text, now(), now(), now()
    );
  END IF;
  RETURN jsonb_build_object('success', true, 'user_id', v_user_id, 'email', v_clean_new);
END;
$$;

-- 5. Endurecimento das políticas RLS: checar exclusivamente app_metadata (elimina alertas críticos no Supabase linter)
DROP POLICY IF EXISTS tutor_select_profiles ON public.profiles;
DROP POLICY IF EXISTS tutor_write_profiles ON public.profiles;
DROP POLICY IF EXISTS tutor_update_profiles ON public.profiles;
DROP POLICY IF EXISTS tutor_delete_profiles ON public.profiles;

CREATE POLICY tutor_select_profiles
  ON public.profiles FOR SELECT TO authenticated
  USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'tutor');

CREATE POLICY tutor_write_profiles
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'tutor');

CREATE POLICY tutor_update_profiles
  ON public.profiles FOR UPDATE TO authenticated
  USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'tutor')
  WITH CHECK (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'tutor');

CREATE POLICY tutor_delete_profiles
  ON public.profiles FOR DELETE TO authenticated
  USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'tutor');

DROP POLICY IF EXISTS tutor_select_sessions ON public.sessions;
DROP POLICY IF EXISTS tutor_write_sessions ON public.sessions;
DROP POLICY IF EXISTS tutor_update_sessions ON public.sessions;
DROP POLICY IF EXISTS tutor_delete_sessions ON public.sessions;

CREATE POLICY tutor_select_sessions
  ON public.sessions FOR SELECT TO authenticated
  USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'tutor');

CREATE POLICY tutor_write_sessions
  ON public.sessions FOR INSERT TO authenticated
  WITH CHECK (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'tutor');

CREATE POLICY tutor_update_sessions
  ON public.sessions FOR UPDATE TO authenticated
  USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'tutor')
  WITH CHECK (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'tutor');

CREATE POLICY tutor_delete_sessions
  ON public.sessions FOR DELETE TO authenticated
  USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'tutor');

DROP POLICY IF EXISTS tutor_select_logs ON public.face_logs;

CREATE POLICY tutor_select_logs
  ON public.face_logs FOR SELECT TO authenticated
  USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'tutor');

NOTIFY pgrst, 'reload schema';
COMMIT;
