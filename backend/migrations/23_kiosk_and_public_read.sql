-- Migration 23 (EXPAND): superfícies mínimas de leitura (finding D-01, decisão DP-1)
--
-- Objetivo
--   * kiosk autenticado (JWT com app_metadata.role = 'kiosk') lê presença e a lista
--     de integrantes por RPC, sem acesso às tabelas.
--   * painel sem login recebe apenas agregados, sem nomes nem identificadores.
-- Esta migração só ADICIONA objetos. O fechamento da leitura de anon nas tabelas
-- é a migração 28, aplicada depois que os clientes novos estiverem em uso.
-- Recuperação: DROP das funções e da policy criadas aqui.

BEGIN;

-- Presença atual para o totem -------------------------------------------------
CREATE OR REPLACE FUNCTION public.kiosk_presence()
RETURNS TABLE (
    session_id bigint,
    check_in timestamptz,
    profile_id uuid,
    name text,
    avatar_url text,
    is_tutor boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_role text := coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '');
BEGIN
    IF auth.uid() IS NULL OR v_role NOT IN ('kiosk', 'tutor') THEN
        RAISE EXCEPTION 'Acesso restrito a dispositivos autorizados.' USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT s.id, s.check_in, p.id, p.name, p.avatar_url, p.is_tutor
    FROM public.sessions s
    JOIN public.profiles p ON p.id = s.profile_id
    WHERE s.check_out IS NULL
      AND s.voided_at IS NULL
      AND p.active = true
      AND p.consent_revoked_at IS NULL
    ORDER BY s.check_in ASC;
END;
$$;

-- Lista de integrantes para recadastro ---------------------------------------
-- A matrícula só é devolvida quando o chamador é tutor.
CREATE OR REPLACE FUNCTION public.kiosk_directory()
RETURNS TABLE (
    id uuid,
    name text,
    matricula text,
    avatar_url text,
    is_tutor boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_role text := coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '');
BEGIN
    IF auth.uid() IS NULL OR v_role NOT IN ('kiosk', 'tutor') THEN
        RAISE EXCEPTION 'Acesso restrito a dispositivos autorizados.' USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT p.id, p.name,
           CASE WHEN v_role = 'tutor' THEN p.matricula ELSE NULL END,
           p.avatar_url, p.is_tutor
    FROM public.profiles p
    WHERE p.active = true AND p.consent_revoked_at IS NULL
    ORDER BY p.name ASC;
END;
$$;

-- Agregados para o painel sem login ------------------------------------------
-- Sem nomes, matrículas ou ids. Janela limitada; recortes com menos de 3 sessões
-- são suprimidos para não individualizar ninguém em horários pouco usados.
CREATE OR REPLACE FUNCTION public.public_lab_stats(p_days integer DEFAULT 28)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_days integer := least(greatest(coalesce(p_days, 28), 1), 90);
    v_now timestamptz := now();
    v_from timestamptz := v_now - make_interval(days => v_days);
    v_present integer;
    v_buckets jsonb;
    v_total_sessions integer;
BEGIN
    SELECT count(*) INTO v_present
    FROM public.sessions s
    JOIN public.profiles p ON p.id = s.profile_id
    WHERE s.check_out IS NULL AND s.voided_at IS NULL
      AND p.active = true AND p.consent_revoked_at IS NULL;

    WITH base AS (
        SELECT
            extract(isodow FROM (s.check_in AT TIME ZONE 'America/Sao_Paulo'))::int AS dow,
            extract(hour FROM (s.check_in AT TIME ZONE 'America/Sao_Paulo'))::int AS hour,
            greatest(0, extract(epoch FROM (coalesce(s.check_out, v_now) - s.check_in)))::bigint AS seconds
        FROM public.sessions s
        WHERE s.voided_at IS NULL
          AND s.check_in >= v_from
    ),
    grouped AS (
        SELECT dow, hour, count(*) AS sessions, sum(seconds) AS seconds
        FROM base
        WHERE dow BETWEEN 1 AND 5
        GROUP BY dow, hour
        HAVING count(*) >= 3
    )
    SELECT coalesce(jsonb_agg(jsonb_build_object(
               'dow', g.dow, 'hour', g.hour, 'sessions', g.sessions, 'seconds', g.seconds)
               ORDER BY g.dow, g.hour), '[]'::jsonb),
           coalesce(sum(g.sessions), 0)::int
      INTO v_buckets, v_total_sessions
    FROM grouped g;

    RETURN jsonb_build_object(
        'present_now', v_present,
        'window_days', v_days,
        'total_sessions', v_total_sessions,
        'buckets', v_buckets,
        'timezone', 'America/Sao_Paulo',
        'generated_at', v_now
    );
END;
$$;

REVOKE ALL ON FUNCTION public.kiosk_presence() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.kiosk_directory() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.public_lab_stats(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kiosk_presence() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.kiosk_directory() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.public_lab_stats(integer) TO anon, authenticated, service_role;

-- Realtime do totem: o kiosk só enxerga eventos de sessões das últimas 24 h
-- (colunas da própria sessão; nomes vêm sempre de kiosk_presence()).
DROP POLICY IF EXISTS kiosk_select_recent_sessions ON public.sessions;
CREATE POLICY kiosk_select_recent_sessions ON public.sessions
    FOR SELECT TO authenticated
    USING (
        ((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') = 'kiosk'
        AND check_in >= (now() - interval '24 hours')
    );

COMMIT;
