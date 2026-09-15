-- Migration 11: RPCs tutor_register_entry e tutor_remove_member
-- Permite que tutores:
-- 1. Registrem manualmente a entrada de integrantes quando o reconhecimento facial travar ou falhar.
-- 2. Descadastrem integrantes desistentes, removendo biometria facial e inativando o perfil da lista ativa.

BEGIN;

CREATE OR REPLACE FUNCTION public.tutor_register_entry(
    p_profile_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_open_session_id bigint;
    v_new_id bigint;
    v_now timestamptz := now();
    v_profile_exists boolean;
BEGIN
    SELECT exists(SELECT 1 FROM public.profiles WHERE id = p_profile_id AND active = true)
    INTO v_profile_exists;

    IF NOT v_profile_exists THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Integrante inativo ou não encontrado no sistema.'
        );
    END IF;

    SELECT id INTO v_open_session_id
    FROM public.sessions
    WHERE profile_id = p_profile_id AND check_out IS NULL
    LIMIT 1;

    IF v_open_session_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Integrante já possui uma presença em andamento no laboratório.'
        );
    END IF;

    INSERT INTO public.sessions (profile_id, check_in)
    VALUES (p_profile_id, v_now)
    RETURNING id INTO v_new_id;

    RETURN jsonb_build_object(
        'success', true,
        'session_id', v_new_id,
        'check_in', v_now
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.tutor_remove_member(
    p_profile_id uuid,
    p_purge_data boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_name text;
    v_now timestamptz := now();
BEGIN
    SELECT name INTO v_name FROM public.profiles WHERE id = p_profile_id;
    IF v_name IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Integrante não encontrado.'
        );
    END IF;

    -- 1. Encerra qualquer sessão em aberto
    UPDATE public.sessions
    SET check_out = v_now,
        voided_at = v_now,
        auto_closed = true
    WHERE profile_id = p_profile_id AND check_out IS NULL;

    -- 2. Remove biometria facial para conformidade LGPD
    DELETE FROM public.face_embeddings WHERE profile_id = p_profile_id;

    -- 3. Purga completa ou desativação segura
    IF p_purge_data THEN
        DELETE FROM public.sessions WHERE profile_id = p_profile_id;
        DELETE FROM public.face_logs WHERE profile_id = p_profile_id;
        DELETE FROM public.profiles WHERE id = p_profile_id;
    ELSE
        UPDATE public.profiles
        SET active = false,
            consent_revoked_at = v_now
        WHERE id = p_profile_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'profile_id', p_profile_id,
        'name', v_name,
        'purged', p_purge_data
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.tutor_register_entry(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tutor_remove_member(uuid, boolean) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
