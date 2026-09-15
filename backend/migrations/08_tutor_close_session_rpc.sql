-- Migration 08: RPC tutor_close_session
-- Permite que tutores encerrem (checkout) ou anulem (void) sessões de presença em aberto diretamente no banco
-- Executa com SECURITY DEFINER para garantir atomicidade e resolver restrições de RLS do PostgREST.

BEGIN;

CREATE OR REPLACE FUNCTION public.tutor_close_session(
    p_profile_id uuid,
    p_action text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_now timestamptz := now();
    v_updated_count int := 0;
BEGIN
    IF p_action = 'checkout' THEN
        UPDATE public.sessions
        SET check_out = v_now
        WHERE profile_id = p_profile_id
          AND check_out IS NULL;
        GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    ELSIF p_action = 'void' THEN
        UPDATE public.sessions
        SET check_out = v_now,
            voided_at = v_now,
            auto_closed = true
        WHERE profile_id = p_profile_id
          AND check_out IS NULL;
        GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    ELSE
        RAISE EXCEPTION 'Ação inválida: %', p_action;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'profile_id', p_profile_id,
        'action', p_action,
        'updated_count', v_updated_count,
        'timestamp', v_now
    );
END;
$$;

-- Concede permissão de execução aos papéis necessários
GRANT EXECUTE ON FUNCTION public.tutor_close_session(uuid, text) TO anon, authenticated, service_role;

-- Notifica o PostgREST para recarregar o schema
NOTIFY pgrst, 'reload schema';

COMMIT;
