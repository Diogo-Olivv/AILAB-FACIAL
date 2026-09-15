-- Migration 10: Sincronização atômica de credenciais de tutor no Supabase Auth e RPC verify_tutor_login
-- Garante que tutores personalizados (@ailab.com) existam tanto em auth.users quanto em auth.identities,
-- permitindo login direto pelo GoTrue oficial em qualquer dispositivo e validação resiliente via RPC.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 1. Atualiza sync_tutor_credentials para sincronizar auth.users E auth.identities
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
    v_clean_curr text := lower(trim(coalesce(p_current_email, '')));
    v_hashed_pw text;
BEGIN
    IF NOT v_clean_new LIKE '%@ailab.com' THEN
        RAISE EXCEPTION 'O e-mail institucional deve pertencer ao domínio @ailab.com';
    END IF;

    IF length(p_new_password) < 6 THEN
        RAISE EXCEPTION 'A nova senha deve conter pelo menos 6 caracteres';
    END IF;

    v_hashed_pw := crypt(p_new_password, gen_salt('bf'));

    -- Localiza usuário existente pelo novo e-mail ou pelo e-mail atual
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE lower(email) = v_clean_new
    LIMIT 1;

    IF v_user_id IS NULL AND v_clean_curr <> '' AND v_clean_curr <> v_clean_new THEN
        SELECT id INTO v_user_id
        FROM auth.users
        WHERE lower(email) = v_clean_curr
        LIMIT 1;
    END IF;

    IF v_user_id IS NOT NULL THEN
        -- Atualiza auth.users existente (sem a coluna gerada confirmed_at)
        UPDATE auth.users
        SET email = v_clean_new,
            encrypted_password = v_hashed_pw,
            email_confirmed_at = coalesce(email_confirmed_at, now()),
            raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role": "tutor", "provider": "email", "providers": ["email"]}'::jsonb,
            raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'tutor', 'name', split_part(v_clean_new, '@', 1)),
            updated_at = now()
        WHERE id = v_user_id;

        -- Sincroniza auth.identities (sem a coluna gerada email)
        UPDATE auth.identities
        SET identity_data = jsonb_build_object('sub', v_user_id::text, 'email', v_clean_new, 'email_verified', true, 'phone_verified', false),
            updated_at = now()
        WHERE user_id = v_user_id AND provider = 'email';

        IF NOT FOUND THEN
            INSERT INTO auth.identities (
                id,
                user_id,
                identity_data,
                provider,
                provider_id,
                last_sign_in_at,
                created_at,
                updated_at
            ) VALUES (
                gen_random_uuid(),
                v_user_id,
                jsonb_build_object('sub', v_user_id::text, 'email', v_clean_new, 'email_verified', true, 'phone_verified', false),
                'email',
                v_user_id::text,
                now(),
                now(),
                now()
            );
        END IF;
    ELSE
        -- Cria novo usuário em auth.users (sem confirmed_at)
        v_user_id := gen_random_uuid();
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
            aud,
            is_sso_user,
            is_anonymous
        ) VALUES (
            v_user_id,
            '00000000-0000-0000-0000-000000000000',
            v_clean_new,
            v_hashed_pw,
            now(),
            '{"role": "tutor", "provider": "email", "providers": ["email"]}'::jsonb,
            jsonb_build_object('role', 'tutor', 'name', split_part(v_clean_new, '@', 1)),
            now(),
            now(),
            'authenticated',
            'authenticated',
            false,
            false
        );

        -- Insere identidade correspondente em auth.identities (sem email)
        INSERT INTO auth.identities (
            id,
            user_id,
            identity_data,
            provider,
            provider_id,
            last_sign_in_at,
            created_at,
            updated_at
        ) VALUES (
            gen_random_uuid(),
            v_user_id,
            jsonb_build_object('sub', v_user_id::text, 'email', v_clean_new, 'email_verified', true, 'phone_verified', false),
            'email',
            v_user_id::text,
            now(),
            now(),
            now()
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'user_id', v_user_id,
        'email', v_clean_new
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_tutor_credentials(text, text, text) TO anon, authenticated, service_role;

-- 2. Cria RPC verify_tutor_login para validação direta e resiliente de credenciais
CREATE OR REPLACE FUNCTION public.verify_tutor_login(
    p_email text,
    p_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_clean_email text := lower(trim(p_email));
    v_user record;
BEGIN
    -- Validação estática de contingência para o tutor mestre padrão
    IF v_clean_email = 'tutor@ailab.com' AND p_password = 'apenasParaTutores@42' THEN
        RETURN jsonb_build_object(
            'valid', true,
            'user_id', 'tutor-master-id',
            'email', 'tutor@ailab.com',
            'role', 'tutor',
            'name', 'Tutor Master'
        );
    END IF;

    -- Busca na tabela auth.users
    SELECT id, email, encrypted_password, raw_app_meta_data, raw_user_meta_data
    INTO v_user
    FROM auth.users
    WHERE lower(email) = v_clean_email
    LIMIT 1;

    IF v_user.id IS NOT NULL THEN
        -- Verifica se a senha confere com o hash bcrypt
        IF v_user.encrypted_password = crypt(p_password, v_user.encrypted_password) THEN
            -- Exige papel de tutor ou domínio @ailab.com
            IF (v_user.raw_app_meta_data->>'role' = 'tutor') OR v_clean_email LIKE '%@ailab.com' THEN
                RETURN jsonb_build_object(
                    'valid', true,
                    'user_id', v_user.id,
                    'email', v_user.email,
                    'role', 'tutor',
                    'name', coalesce(v_user.raw_user_meta_data->>'name', split_part(v_clean_email, '@', 1))
                );
            END IF;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'valid', false,
        'message', 'Credenciais inválidas ou conta sem privilégios de tutor'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_tutor_login(text, text) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
