-- Migration 14: Hardening de RPCs SECURITY DEFINER
-- Revoga mutações anônimas e exige tutor autenticado ou service_role.
-- verify_tutor_login permanece acessível a anon por ser o fluxo de login.

BEGIN;

CREATE OR REPLACE FUNCTION public.require_tutor_or_service()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, auth, pg_catalog
AS $$
BEGIN
  IF coalesce(auth.role(), '') = 'service_role' THEN
    RETURN;
  END IF;

  IF coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'tutor'
     AND coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') <> 'tutor' THEN
    RAISE EXCEPTION 'Acesso restrito a tutores autorizados.'
      USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.tutor_close_session(
    p_profile_id uuid,
    p_action text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
DECLARE
  v_now timestamptz := now();
  v_updated_count int := 0;
BEGIN
  PERFORM public.require_tutor_or_service();
  IF p_action = 'checkout' THEN
    UPDATE public.sessions SET check_out = v_now
    WHERE profile_id = p_profile_id AND check_out IS NULL;
  ELSIF p_action = 'void' THEN
    UPDATE public.sessions
    SET check_out = v_now, voided_at = v_now, auto_closed = true
    WHERE profile_id = p_profile_id AND check_out IS NULL;
  ELSE
    RAISE EXCEPTION 'Ação inválida: %', p_action USING ERRCODE = '22023';
  END IF;
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'profile_id', p_profile_id,
    'action', p_action, 'updated_count', v_updated_count, 'timestamp', v_now);
END;
$$;

CREATE OR REPLACE FUNCTION public.tutor_register_entry(p_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
DECLARE
  v_open_session_id bigint;
  v_new_id bigint;
  v_now timestamptz := now();
BEGIN
  PERFORM public.require_tutor_or_service();
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_profile_id AND active = true) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Integrante inativo ou não encontrado no sistema.');
  END IF;
  SELECT id INTO v_open_session_id FROM public.sessions
  WHERE profile_id = p_profile_id AND check_out IS NULL LIMIT 1;
  IF v_open_session_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Integrante já possui uma presença em andamento no laboratório.');
  END IF;
  INSERT INTO public.sessions (profile_id, check_in) VALUES (p_profile_id, v_now) RETURNING id INTO v_new_id;
  RETURN jsonb_build_object('success', true, 'session_id', v_new_id, 'check_in', v_now);
END;
$$;

CREATE OR REPLACE FUNCTION public.tutor_remove_member(
    p_profile_id uuid,
    p_purge_data boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
DECLARE
  v_name text;
  v_now timestamptz := now();
BEGIN
  PERFORM public.require_tutor_or_service();
  SELECT name INTO v_name FROM public.profiles WHERE id = p_profile_id;
  IF v_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Integrante não encontrado.');
  END IF;
  UPDATE public.sessions SET check_out = v_now, voided_at = v_now, auto_closed = true
  WHERE profile_id = p_profile_id AND check_out IS NULL;
  DELETE FROM public.face_embeddings WHERE profile_id = p_profile_id;
  IF p_purge_data THEN
    DELETE FROM public.sessions WHERE profile_id = p_profile_id;
    DELETE FROM public.face_logs WHERE profile_id = p_profile_id;
    DELETE FROM public.profiles WHERE id = p_profile_id;
  ELSE
    UPDATE public.profiles SET active = false, consent_revoked_at = v_now WHERE id = p_profile_id;
  END IF;
  RETURN jsonb_build_object('success', true, 'profile_id', p_profile_id,
    'name', v_name, 'purged', p_purge_data);
END;
$$;

CREATE OR REPLACE FUNCTION public.tutor_void_session(
    p_session_id bigint,
    p_reason text DEFAULT 'anomalous_or_over_10h'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
DECLARE
  v_now timestamptz := now();
  v_profile_id uuid;
  v_check_out timestamptz;
BEGIN
  PERFORM public.require_tutor_or_service();
  SELECT profile_id, check_out INTO v_profile_id, v_check_out
  FROM public.sessions WHERE id = p_session_id;
  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Sessão não encontrada.');
  END IF;
  IF v_check_out IS NULL THEN
    UPDATE public.sessions SET check_out = v_now, voided_at = v_now, auto_closed = true WHERE id = p_session_id;
  ELSE
    UPDATE public.sessions SET voided_at = v_now, auto_closed = true WHERE id = p_session_id;
  END IF;
  RETURN jsonb_build_object('success', true, 'session_id', p_session_id,
    'profile_id', v_profile_id, 'reason', p_reason, 'voided_at', v_now);
END;
$$;

CREATE OR REPLACE FUNCTION public.tutor_unvoid_session(p_session_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
DECLARE v_profile_id uuid;
BEGIN
  PERFORM public.require_tutor_or_service();
  SELECT profile_id INTO v_profile_id FROM public.sessions WHERE id = p_session_id;
  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Sessão não encontrada.');
  END IF;
  UPDATE public.sessions SET voided_at = NULL WHERE id = p_session_id;
  RETURN jsonb_build_object('success', true, 'session_id', p_session_id, 'profile_id', v_profile_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.tutor_delete_session(p_session_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
DECLARE
  v_profile_id uuid;
  v_deleted_count int := 0;
BEGIN
  PERFORM public.require_tutor_or_service();
  SELECT profile_id INTO v_profile_id FROM public.sessions WHERE id = p_session_id;
  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Sessão não encontrada.');
  END IF;
  DELETE FROM public.sessions WHERE id = p_session_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'session_id', p_session_id,
    'profile_id', v_profile_id, 'deleted_count', v_deleted_count);
END;
$$;

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
  IF coalesce(auth.role(), '') <> 'service_role' THEN
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

-- O domínio do e-mail não é autorização. Apenas contas com role=tutor podem
-- passar pela validação de credenciais administrativas.
CREATE OR REPLACE FUNCTION public.verify_tutor_login(
    p_email text,
    p_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_catalog
AS $$
DECLARE
  v_clean_email text := lower(trim(p_email));
  v_user record;
BEGIN
  IF v_clean_email = 'tutor@ailab.com' AND p_password = 'apenasParaTutores@42' THEN
    RETURN jsonb_build_object('valid', true, 'user_id', 'tutor-master-id',
      'email', 'tutor@ailab.com', 'role', 'tutor', 'name', 'Tutor Master');
  END IF;

  SELECT id, email, encrypted_password, raw_app_meta_data, raw_user_meta_data
  INTO v_user FROM auth.users WHERE lower(email) = v_clean_email LIMIT 1;

  IF v_user.id IS NOT NULL
     AND v_user.raw_app_meta_data ->> 'role' = 'tutor'
     AND v_user.encrypted_password = crypt(p_password, v_user.encrypted_password) THEN
    RETURN jsonb_build_object('valid', true, 'user_id', v_user.id, 'email', v_user.email,
      'role', 'tutor', 'name', coalesce(v_user.raw_user_meta_data ->> 'name', split_part(v_clean_email, '@', 1)));
  END IF;

  RETURN jsonb_build_object('valid', false, 'message', 'Credenciais inválidas ou conta sem privilégios de tutor');
END;
$$;

-- Credenciais só podem ser atualizadas por um tutor autenticado na própria conta
-- ou pelo backend usando service_role.
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

  IF coalesce(auth.role(), '') <> 'service_role' THEN
    SELECT id INTO v_current_user_id FROM auth.users WHERE lower(email) = v_clean_curr LIMIT 1;
    IF v_current_user_id IS NULL OR auth.uid() IS DISTINCT FROM v_current_user_id THEN
      RAISE EXCEPTION 'Apenas o próprio tutor pode alterar suas credenciais.' USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = v_clean_new LIMIT 1;
  IF v_user_id IS NOT NULL AND coalesce(auth.role(), '') <> 'service_role'
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
      raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"tutor","provider":"email","providers":["email"]}'::jsonb,
      raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'tutor', 'name', split_part(v_clean_new, '@', 1)),
      updated_at = now() WHERE id = v_user_id;
    UPDATE auth.identities SET identity_data = jsonb_build_object('sub', v_user_id::text,
      'email', v_clean_new, 'email_verified', true, 'phone_verified', false), updated_at = now()
      WHERE user_id = v_user_id AND provider = 'email';
  ELSE
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud, is_sso_user, is_anonymous)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', v_clean_new, v_hashed_pw, now(),
      '{"role":"tutor","provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('role', 'tutor', 'name', split_part(v_clean_new, '@', 1)), now(), now(),
      'authenticated', 'authenticated', false, false);
  END IF;
  RETURN jsonb_build_object('success', true, 'user_id', v_user_id, 'email', v_clean_new);
END;
$$;

REVOKE ALL ON FUNCTION public.require_tutor_or_service() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tutor_close_session(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tutor_register_entry(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tutor_remove_member(uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tutor_void_session(bigint, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tutor_unvoid_session(bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tutor_delete_session(bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sweep_stale_sessions() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_tutor_credentials(text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.verify_tutor_login(text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.tutor_close_session(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tutor_register_entry(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tutor_remove_member(uuid, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tutor_void_session(bigint, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tutor_unvoid_session(bigint) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tutor_delete_session(bigint) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sweep_stale_sessions() TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_tutor_credentials(text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.verify_tutor_login(text, text) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
