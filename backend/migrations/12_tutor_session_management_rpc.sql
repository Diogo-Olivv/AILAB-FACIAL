-- Migration 12: RPCs para gestão de sessões pelo tutor
-- Permite que tutores:
-- 1. Anulem/invalidem sessões anômalas ou que ultrapassaram 10h (zerando horas computadas)
-- 2. Reativem sessões anuladas por engano
-- 3. Excluam permanentemente sessões incorretas ou anômalas

BEGIN;

-- 1. RPC para invalidar/anular uma sessão específica
CREATE OR REPLACE FUNCTION public.tutor_void_session(
    p_session_id bigint,
    p_reason text DEFAULT 'anomalous_or_over_10h'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_now timestamptz := now();
    v_profile_id uuid;
    v_check_out timestamptz;
BEGIN
    SELECT profile_id, check_out INTO v_profile_id, v_check_out
    FROM public.sessions
    WHERE id = p_session_id;

    IF v_profile_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Sessão não encontrada.'
        );
    END IF;

    -- Se a sessão ainda estiver aberta, encerra com o horário atual
    IF v_check_out IS NULL THEN
        UPDATE public.sessions
        SET check_out = v_now,
            voided_at = v_now,
            auto_closed = true
        WHERE id = p_session_id;
    ELSE
        UPDATE public.sessions
        SET voided_at = v_now,
            auto_closed = true
        WHERE id = p_session_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'session_id', p_session_id,
        'profile_id', v_profile_id,
        'reason', p_reason,
        'voided_at', v_now
    );
END;
$$;

-- 2. RPC para reverter a anulação (reativar) de uma sessão
CREATE OR REPLACE FUNCTION public.tutor_unvoid_session(
    p_session_id bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_profile_id uuid;
BEGIN
    SELECT profile_id INTO v_profile_id
    FROM public.sessions
    WHERE id = p_session_id;

    IF v_profile_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Sessão não encontrada.'
        );
    END IF;

    UPDATE public.sessions
    SET voided_at = NULL
    WHERE id = p_session_id;

    RETURN jsonb_build_object(
        'success', true,
        'session_id', p_session_id,
        'profile_id', v_profile_id
    );
END;
$$;

-- 3. RPC para excluir definitivamente uma sessão
CREATE OR REPLACE FUNCTION public.tutor_delete_session(
    p_session_id bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_profile_id uuid;
    v_deleted_count int := 0;
BEGIN
    SELECT profile_id INTO v_profile_id
    FROM public.sessions
    WHERE id = p_session_id;

    IF v_profile_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Sessão não encontrada.'
        );
    END IF;

    DELETE FROM public.sessions
    WHERE id = p_session_id;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    RETURN jsonb_build_object(
        'success', true,
        'session_id', p_session_id,
        'profile_id', v_profile_id,
        'deleted_count', v_deleted_count
    );
END;
$$;

-- Permissões de execução
GRANT EXECUTE ON FUNCTION public.tutor_void_session(bigint, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tutor_unvoid_session(bigint) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tutor_delete_session(bigint) TO anon, authenticated, service_role;

-- Notifica o PostgREST para recarregar o schema imediatamente
NOTIFY pgrst, 'reload schema';

COMMIT;
