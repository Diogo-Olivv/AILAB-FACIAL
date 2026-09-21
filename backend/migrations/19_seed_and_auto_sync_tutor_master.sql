-- Migration 19: Seed e auto-sincronização do tutor mestre de primeiro acesso
-- Garante a criação de tutor@ailab.com em auth.users e auth.identities com a senha padrão apenasParaTutores@42
-- e atualiza verify_tutor_login para auto-recuperar a conta caso seja excluída acidentalmente.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 1. Seed idempotente de tutor@ailab.com no Supabase Auth
DO $$
DECLARE
  v_user_id uuid;
  v_hashed_pw text;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = 'tutor@ailab.com' LIMIT 1;
  v_hashed_pw := extensions.crypt('apenasParaTutores@42', extensions.gen_salt('bf'));

  IF v_user_id IS NOT NULL THEN
    UPDATE auth.users SET
      encrypted_password = v_hashed_pw,
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      confirmation_token = coalesce(confirmation_token, ''),
      recovery_token = coalesce(recovery_token, ''),
      email_change_token_new = coalesce(email_change_token_new, ''),
      email_change = coalesce(email_change, ''),
      raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"tutor","provider":"email","providers":["email"]}'::jsonb,
      raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'tutor', 'name', 'tutor'),
      updated_at = now()
    WHERE id = v_user_id;

    UPDATE auth.identities SET
      identity_data = jsonb_build_object('sub', v_user_id::text, 'email', 'tutor@ailab.com', 'email_verified', true, 'phone_verified', false),
      updated_at = now()
    WHERE user_id = v_user_id AND provider = 'email';

    IF NOT FOUND THEN
      INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), v_user_id,
        jsonb_build_object('sub', v_user_id::text, 'email', 'tutor@ailab.com', 'email_verified', true, 'phone_verified', false),
        'email', v_user_id::text, now(), now(), now()
      );
    END IF;
  ELSE
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud, is_sso_user, is_anonymous
    ) VALUES (
      v_user_id, '00000000-0000-0000-0000-000000000000', 'tutor@ailab.com', v_hashed_pw, now(),
      '', '', '', '',
      '{"role":"tutor","provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('role', 'tutor', 'name', 'tutor'), now(), now(),
      'authenticated', 'authenticated', false, false
    );

    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', 'tutor@ailab.com', 'email_verified', true, 'phone_verified', false),
      'email', v_user_id::text, now(), now(), now()
    );
  END IF;
END;
$$;

-- 2. Atualiza RPC verify_tutor_login com auto-recuperação resiliente
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
  v_user_id uuid;
  v_hashed_pw text;
BEGIN
  IF v_clean_email = 'tutor@ailab.com' AND p_password = 'apenasParaTutores@42' THEN
    SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = 'tutor@ailab.com' LIMIT 1;
    v_hashed_pw := extensions.crypt('apenasParaTutores@42', extensions.gen_salt('bf'));

    IF v_user_id IS NOT NULL THEN
      UPDATE auth.users SET
        encrypted_password = v_hashed_pw,
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        confirmation_token = coalesce(confirmation_token, ''),
        recovery_token = coalesce(recovery_token, ''),
        email_change_token_new = coalesce(email_change_token_new, ''),
        email_change = coalesce(email_change, ''),
        raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"tutor","provider":"email","providers":["email"]}'::jsonb,
        raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'tutor', 'name', 'tutor'),
        updated_at = now()
      WHERE id = v_user_id;

      UPDATE auth.identities SET
        identity_data = jsonb_build_object('sub', v_user_id::text, 'email', 'tutor@ailab.com', 'email_verified', true, 'phone_verified', false),
        updated_at = now()
      WHERE user_id = v_user_id AND provider = 'email';

      IF NOT FOUND THEN
        INSERT INTO auth.identities (
          id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), v_user_id,
          jsonb_build_object('sub', v_user_id::text, 'email', 'tutor@ailab.com', 'email_verified', true, 'phone_verified', false),
          'email', v_user_id::text, now(), now(), now()
        );
      END IF;
    ELSE
      v_user_id := gen_random_uuid();
      INSERT INTO auth.users (
        id, instance_id, email, encrypted_password, email_confirmed_at,
        confirmation_token, recovery_token, email_change_token_new, email_change,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud, is_sso_user, is_anonymous
      ) VALUES (
        v_user_id, '00000000-0000-0000-0000-000000000000', 'tutor@ailab.com', v_hashed_pw, now(),
        '', '', '', '',
        '{"role":"tutor","provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('role', 'tutor', 'name', 'tutor'), now(), now(),
        'authenticated', 'authenticated', false, false
      );

      INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), v_user_id,
        jsonb_build_object('sub', v_user_id::text, 'email', 'tutor@ailab.com', 'email_verified', true, 'phone_verified', false),
        'email', v_user_id::text, now(), now(), now()
      );
    END IF;

    RETURN jsonb_build_object(
      'valid', true,
      'user_id', v_user_id::text,
      'email', 'tutor@ailab.com',
      'role', 'tutor',
      'name', 'Tutor Master',
      'synced', true
    );
  END IF;

  SELECT id, email, encrypted_password, raw_app_meta_data, raw_user_meta_data
  INTO v_user FROM auth.users WHERE lower(email) = v_clean_email LIMIT 1;

  IF v_user.id IS NOT NULL
     AND v_user.raw_app_meta_data ->> 'role' = 'tutor'
     AND v_user.encrypted_password = extensions.crypt(p_password, v_user.encrypted_password) THEN
    RETURN jsonb_build_object('valid', true, 'user_id', v_user.id, 'email', v_user.email,
      'role', 'tutor', 'name', coalesce(v_user.raw_user_meta_data ->> 'name', split_part(v_clean_email, '@', 1)));
  END IF;

  RETURN jsonb_build_object('valid', false, 'message', 'Credenciais inválidas ou conta sem privilégios de tutor');
END;
$$;

REVOKE ALL ON FUNCTION public.verify_tutor_login(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_tutor_login(text, text) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
