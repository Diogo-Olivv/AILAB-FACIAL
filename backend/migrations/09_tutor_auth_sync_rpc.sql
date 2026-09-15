-- Migration 09: Sincronizacao de credenciais de tutor no Supabase Auth e rotina de sweep
-- Permite que tutores atualizem e-mail institucional (@ailab.com) e senha, sincronizando com auth.users

BEGIN;

CREATE OR REPLACE FUNCTION public.sync_tutor_credentials(
    p_current_email text,
    p_new_email text,
    p_new_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_user_id uuid;
    v_clean_new text := lower(trim(p_new_email));
    v_hashed_pw text;
BEGIN
    IF NOT v_clean_new LIKE '%@ailab.com' THEN
        RAISE EXCEPTION 'O e-mail deve pertencer ao dominio @ailab.com';
    END IF;

    IF length(p_new_password) < 6 THEN
        RAISE EXCEPTION 'A senha deve conter pelo menos 6 caracteres';
    END IF;

    v_hashed_pw := crypt(p_new_password, gen_salt('bf'));

    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = v_clean_new
    LIMIT 1;

    IF v_user_id IS NOT NULL THEN
        UPDATE auth.users
        SET encrypted_password = v_hashed_pw,
            email_confirmed_at = coalesce(email_confirmed_at, now()),
            raw_app_meta_data = raw_app_meta_data || '{"role": "tutor"}'::jsonb,
            updated_at = now()
        WHERE id = v_user_id;
    ELSE
        INSERT INTO auth.users (
            id,
            instance_id,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at,
            role,
            aud
        ) VALUES (
            gen_random_uuid(),
            '00000000-0000-0000-0000-000000000000',
            v_clean_new,
            v_hashed_pw,
            now(),
            '{"role": "tutor", "provider": "email", "providers": ["email"]}'::jsonb,
            jsonb_build_object('role', 'tutor', 'name', split_part(v_clean_new, '@', 1)),
            now(),
            now(),
            'authenticated',
            'authenticated'
        ) RETURNING id INTO v_user_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'user_id', v_user_id,
        'email', v_clean_new
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_tutor_credentials(text, text, text) TO anon, authenticated, service_role;

-- Rotina de sweep interno do banco
CREATE OR REPLACE FUNCTION public.sweep_stale_sessions()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_now timestamptz := now();
    v_updated_count int := 0;
BEGIN
    UPDATE public.sessions
    SET check_out = v_now,
        voided_at = v_now,
        auto_closed = true
    WHERE check_out IS NULL
      AND (
        (v_now - check_in) >= interval '10 hours'
        OR (check_in AT TIME ZONE 'America/Sao_Paulo')::date < (v_now AT TIME ZONE 'America/Sao_Paulo')::date
      );

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    RETURN jsonb_build_object(
        'success', true,
        'auto_closed', v_updated_count,
        'timestamp', v_now
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sweep_stale_sessions() TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
