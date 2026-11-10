-- Migration 24: registro de presença atômico no banco (finding D-04)
--
-- Substitui a sequência read-check-write feita pelo backend por uma função que
-- roda sob lock transacional por perfil. O retorno preserva o contrato de
-- session_service.register_event():
--   {action, profile_id, session_id?, timestamp?, duration_minutes?, wait_seconds?}
--   action ∈ check_in | check_out | already_in | not_in | debounced
--
-- Invariantes garantidos:
--   * no máximo uma sessão aberta por perfil (índice único parcial + lock);
--   * nenhum checkout sem sessão aberta; checkout só atinge linha ainda aberta;
--   * retry dentro do debounce não gera segundo evento;
--   * evento inválido não altera nenhuma linha.
-- Efeito: só DDL. Recuperação: o backend volta ao caminho Python por configuração.

BEGIN;

CREATE OR REPLACE FUNCTION public.presence_lock_key(p_profile_id uuid)
RETURNS bigint
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
    SELECT pg_catalog.hashtextextended('presence:' || p_profile_id::text, 0);
$$;

CREATE OR REPLACE FUNCTION public.register_presence_event(
    p_profile_id uuid,
    p_action text DEFAULT NULL,
    p_debounce_seconds integer DEFAULT 60,
    p_max_session_hours integer DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    v_now timestamptz := clock_timestamp();
    v_last timestamptz;
    v_open_id bigint;
    v_open_check_in timestamptz;
    v_new_id bigint;
    v_wait integer;
    v_stale boolean;
BEGIN
    IF p_action IS NOT NULL AND p_action NOT IN ('check_in', 'check_out') THEN
        RAISE EXCEPTION 'Ação inválida: %', p_action USING ERRCODE = '22023';
    END IF;

    -- Serializa todos os eventos do mesmo perfil (kiosk, tutor e outras instâncias).
    PERFORM pg_catalog.pg_advisory_xact_lock(public.presence_lock_key(p_profile_id));

    -- 1. Histerese geral: último evento de qualquer sessão do perfil.
    SELECT max(coalesce(s.check_out, s.check_in)) INTO v_last
    FROM public.sessions s WHERE s.profile_id = p_profile_id;

    IF v_last IS NOT NULL AND (v_now - v_last) < make_interval(secs => p_debounce_seconds) THEN
        v_wait := p_debounce_seconds - floor(extract(epoch FROM (v_now - v_last)))::int;
        RETURN jsonb_build_object('action', 'debounced', 'profile_id', p_profile_id,
                                  'wait_seconds', greatest(1, v_wait));
    END IF;

    SELECT s.id, s.check_in INTO v_open_id, v_open_check_in
    FROM public.sessions s
    WHERE s.profile_id = p_profile_id AND s.check_out IS NULL AND s.voided_at IS NULL
    ORDER BY s.check_in DESC
    LIMIT 1
    FOR UPDATE;

    -- 2. Saída esquecida: anula (0 h) e segue como "sem sessão aberta".
    IF v_open_id IS NOT NULL THEN
        v_stale := (v_now - v_open_check_in) >= make_interval(hours => p_max_session_hours)
                OR (v_open_check_in AT TIME ZONE 'America/Sao_Paulo')::date
                   < (v_now AT TIME ZONE 'America/Sao_Paulo')::date;
        IF v_stale THEN
            UPDATE public.sessions
            SET check_out = v_now, voided_at = v_now, auto_closed = true
            WHERE id = v_open_id AND check_out IS NULL;
            v_open_id := NULL;
            v_open_check_in := NULL;
        END IF;
    END IF;

    -- 3. Intenção explícita incompatível com o estado.
    IF p_action = 'check_in' AND v_open_id IS NOT NULL THEN
        RETURN jsonb_build_object('action', 'already_in', 'profile_id', p_profile_id);
    END IF;
    IF p_action = 'check_out' AND v_open_id IS NULL THEN
        RETURN jsonb_build_object('action', 'not_in', 'profile_id', p_profile_id);
    END IF;

    -- 4. CHECK-IN
    IF v_open_id IS NULL THEN
        BEGIN
            INSERT INTO public.sessions (profile_id, check_in)
            VALUES (p_profile_id, v_now)
            RETURNING id INTO v_new_id;
        EXCEPTION WHEN unique_violation THEN
            -- Sessão aberta (inclusive anulada sem checkout) já existe para o perfil.
            RETURN jsonb_build_object('action', 'already_in', 'profile_id', p_profile_id);
        END;
        RETURN jsonb_build_object('action', 'check_in', 'profile_id', p_profile_id,
                                  'session_id', v_new_id, 'timestamp', v_now);
    END IF;

    -- 5. CHECK-OUT
    IF p_action IS NULL
       AND (v_now - v_open_check_in) < make_interval(secs => p_debounce_seconds) THEN
        v_wait := p_debounce_seconds - floor(extract(epoch FROM (v_now - v_open_check_in)))::int;
        RETURN jsonb_build_object('action', 'debounced', 'profile_id', p_profile_id,
                                  'wait_seconds', greatest(1, v_wait));
    END IF;

    UPDATE public.sessions SET check_out = v_now
    WHERE id = v_open_id AND check_out IS NULL;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('action', 'not_in', 'profile_id', p_profile_id);
    END IF;

    RETURN jsonb_build_object(
        'action', 'check_out',
        'profile_id', p_profile_id,
        'session_id', v_open_id,
        'timestamp', v_now,
        'duration_minutes',
            greatest(0, round((extract(epoch FROM (v_now - v_open_check_in)) / 60.0)::numeric, 1))
    );
END;
$$;

REVOKE ALL ON FUNCTION public.presence_lock_key(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.presence_lock_key(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.register_presence_event(uuid, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_presence_event(uuid, text, integer, integer) TO service_role;

-- As RPCs de tutor que competem com o kiosk passam a usar o mesmo lock.
CREATE OR REPLACE FUNCTION public.tutor_close_session(p_profile_id uuid, p_action text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public', 'auth', 'pg_catalog'
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_updated_count int := 0;
BEGIN
  PERFORM public.require_tutor_or_service();
  PERFORM pg_advisory_xact_lock(public.presence_lock_key(p_profile_id));
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
SET search_path TO 'public', 'auth', 'pg_catalog'
AS $$
DECLARE
  v_open_session_id bigint;
  v_new_id bigint;
  v_now timestamptz := clock_timestamp();
BEGIN
  PERFORM public.require_tutor_or_service();
  PERFORM pg_advisory_xact_lock(public.presence_lock_key(p_profile_id));
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

COMMIT;
