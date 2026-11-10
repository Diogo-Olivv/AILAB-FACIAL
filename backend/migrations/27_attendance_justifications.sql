-- Migration 27: justificativa de débito de frequência (requisito da cliente)
--
-- Uma justificativa vale para UM perfil e UMA semana civil (segunda a domingo,
-- America/Sao_Paulo). Ela não cria horas, não altera sessões e não transforma
-- "abaixo da meta" em "meta cumprida": apenas dispensa o débito daquele período.
--
-- Histórico imutável: o motivo original nunca é alterado; revogar preenche os
-- campos de revogação e mantém a linha. Não há caminho de UPDATE do motivo nem
-- de DELETE para clientes.
-- Acesso: a tabela não tem grants nem policies para anon/authenticated. A única
-- superfície são as três RPCs abaixo, restritas a tutores.
--
-- Decisões de produto adotadas como padrão (alteráveis sem reescrita, DP-10):
--   * categoria obrigatória; texto livre opcional (obrigatório quando "outro");
--   * motivo de revogação opcional;
--   * não é possível justificar semana futura (DP-5 / R9).
-- Recuperação: DROP só enquanto não houver dados; depois, correção para frente.

BEGIN;

CREATE TABLE IF NOT EXISTS public.attendance_justifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    period_start date NOT NULL,
    period_end date NOT NULL,
    category text NOT NULL,
    reason text,
    justified_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    justified_at timestamptz NOT NULL DEFAULT now(),
    revoked_at timestamptz,
    revoked_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
    revocation_reason text,
    CONSTRAINT attendance_justifications_week_starts_monday
        CHECK (extract(isodow FROM period_start) = 1),
    CONSTRAINT attendance_justifications_week_length
        CHECK (period_end = period_start + 6),
    CONSTRAINT attendance_justifications_category
        CHECK (category IN ('saude', 'academico', 'institucional', 'pessoal', 'outro')),
    CONSTRAINT attendance_justifications_reason_length
        CHECK (reason IS NULL OR char_length(btrim(reason)) BETWEEN 3 AND 500),
    CONSTRAINT attendance_justifications_reason_required_for_other
        CHECK (category <> 'outro' OR reason IS NOT NULL),
    CONSTRAINT attendance_justifications_revocation_reason_length
        CHECK (revocation_reason IS NULL OR char_length(btrim(revocation_reason)) BETWEEN 3 AND 500),
    CONSTRAINT attendance_justifications_revocation_consistency
        CHECK ((revoked_at IS NULL AND revoked_by IS NULL AND revocation_reason IS NULL)
            OR (revoked_at IS NOT NULL AND revoked_by IS NOT NULL))
);

-- Uma única justificativa ATIVA por perfil e semana.
CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_justifications_active
    ON public.attendance_justifications (profile_id, period_start)
    WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_attendance_justifications_period
    ON public.attendance_justifications (period_start DESC, justified_at DESC, id);

ALTER TABLE public.attendance_justifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_justifications FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.attendance_justifications FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.attendance_justifications TO service_role;
DROP POLICY IF EXISTS service_role_all_attendance_justifications ON public.attendance_justifications;
CREATE POLICY service_role_all_attendance_justifications ON public.attendance_justifications
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Helpers internos -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.attendance_require_tutor()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
    v_uid uuid := auth.uid();
BEGIN
    IF v_uid IS NULL OR coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'tutor' THEN
        RAISE EXCEPTION 'Acesso restrito a tutores autorizados.' USING ERRCODE = '42501';
    END IF;
    RETURN v_uid;
END;
$$;

CREATE OR REPLACE FUNCTION public.attendance_row_json(j public.attendance_justifications)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
    SELECT jsonb_build_object(
        'id', j.id,
        'profile_id', j.profile_id,
        'period_start', j.period_start,
        'period_end', j.period_end,
        'category', j.category,
        'reason', j.reason,
        'status', CASE WHEN j.revoked_at IS NULL THEN 'active' ELSE 'revoked' END,
        'justified_by', j.justified_by,
        'justified_by_label', (SELECT split_part(u.email, '@', 1) FROM auth.users u WHERE u.id = j.justified_by),
        'justified_at', j.justified_at,
        'revoked_at', j.revoked_at,
        'revoked_by', j.revoked_by,
        'revoked_by_label', (SELECT split_part(u.email, '@', 1) FROM auth.users u WHERE u.id = j.revoked_by),
        'revocation_reason', j.revocation_reason
    );
$$;

-- Justificar -------------------------------------------------------------------
-- Idempotente: se já existe justificativa ativa para o par, devolve a existente
-- com created=false (inclusive quando outro tutor chegou primeiro).
CREATE OR REPLACE FUNCTION public.justify_attendance_debt(
    p_profile_id uuid,
    p_period_start date,
    p_category text,
    p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_uid uuid := public.attendance_require_tutor();
    v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
    v_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
    v_current_week date := v_today - (extract(isodow FROM v_today)::int - 1);
    j public.attendance_justifications%ROWTYPE;
BEGIN
    IF p_profile_id IS NULL OR p_period_start IS NULL THEN
        RAISE EXCEPTION 'Perfil e semana são obrigatórios.' USING ERRCODE = '22023';
    END IF;
    IF extract(isodow FROM p_period_start) <> 1 THEN
        RAISE EXCEPTION 'A semana deve começar em uma segunda-feira.' USING ERRCODE = '22023';
    END IF;
    IF p_period_start > v_current_week THEN
        RAISE EXCEPTION 'Não é possível justificar uma semana futura.' USING ERRCODE = '22023';
    END IF;
    IF p_category IS NULL OR p_category NOT IN ('saude', 'academico', 'institucional', 'pessoal', 'outro') THEN
        RAISE EXCEPTION 'Categoria de justificativa inválida.' USING ERRCODE = '22023';
    END IF;
    IF p_category = 'outro' AND v_reason IS NULL THEN
        RAISE EXCEPTION 'Descreva o motivo quando a categoria for "outro".' USING ERRCODE = '22023';
    END IF;
    IF v_reason IS NOT NULL AND char_length(v_reason) NOT BETWEEN 3 AND 500 THEN
        RAISE EXCEPTION 'O motivo deve ter entre 3 e 500 caracteres.' USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = p_profile_id) THEN
        RAISE EXCEPTION 'Integrante não encontrado.' USING ERRCODE = 'P0002';
    END IF;

    -- Serializa justificar/revogar para o mesmo perfil + semana.
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
        'attendance_justification:' || p_profile_id::text || ':' || p_period_start::text, 0));

    SELECT * INTO j FROM public.attendance_justifications a
    WHERE a.profile_id = p_profile_id AND a.period_start = p_period_start AND a.revoked_at IS NULL;
    IF FOUND THEN
        RETURN jsonb_build_object('created', false, 'justification', public.attendance_row_json(j));
    END IF;

    INSERT INTO public.attendance_justifications
        (profile_id, period_start, period_end, category, reason, justified_by)
    VALUES (p_profile_id, p_period_start, p_period_start + 6, p_category, v_reason, v_uid)
    RETURNING * INTO j;

    RETURN jsonb_build_object('created', true, 'justification', public.attendance_row_json(j));
END;
$$;

-- Revogar ----------------------------------------------------------------------
-- Idempotente: revogar o que já está revogado devolve changed=false.
CREATE OR REPLACE FUNCTION public.revoke_attendance_justification(
    p_id uuid,
    p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_uid uuid := public.attendance_require_tutor();
    v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
    v_profile uuid;
    v_start date;
    j public.attendance_justifications%ROWTYPE;
BEGIN
    IF v_reason IS NOT NULL AND char_length(v_reason) NOT BETWEEN 3 AND 500 THEN
        RAISE EXCEPTION 'O motivo deve ter entre 3 e 500 caracteres.' USING ERRCODE = '22023';
    END IF;

    -- profile_id e period_start são imutáveis: resolve o par antes de travar.
    SELECT a.profile_id, a.period_start INTO v_profile, v_start
    FROM public.attendance_justifications a WHERE a.id = p_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Justificativa não encontrada.' USING ERRCODE = 'P0002';
    END IF;

    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
        'attendance_justification:' || v_profile::text || ':' || v_start::text, 0));

    SELECT * INTO j FROM public.attendance_justifications a WHERE a.id = p_id FOR UPDATE;
    IF j.revoked_at IS NOT NULL THEN
        RETURN jsonb_build_object('changed', false, 'justification', public.attendance_row_json(j));
    END IF;

    UPDATE public.attendance_justifications
    SET revoked_at = clock_timestamp(), revoked_by = v_uid, revocation_reason = v_reason
    WHERE id = p_id
    RETURNING * INTO j;

    RETURN jsonb_build_object('changed', true, 'justification', public.attendance_row_json(j));
END;
$$;

-- Listar -----------------------------------------------------------------------
-- Intervalo máximo de 92 dias; no máximo 100 linhas por página; ordem fixa
-- (semana desc, data desc, id) com paginação por cursor.
CREATE OR REPLACE FUNCTION public.list_attendance_justifications(
    p_from date,
    p_to date,
    p_profile_id uuid DEFAULT NULL,
    p_include_revoked boolean DEFAULT true,
    p_limit integer DEFAULT 100,
    p_cursor jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_uid uuid := public.attendance_require_tutor();
    v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 100);
    v_c_start date := (p_cursor ->> 'period_start')::date;
    v_c_at timestamptz := (p_cursor ->> 'justified_at')::timestamptz;
    v_c_id uuid := (p_cursor ->> 'id')::uuid;
    v_items jsonb;
    v_count integer;
    v_last public.attendance_justifications%ROWTYPE;
    v_next jsonb := NULL;
BEGIN
    IF p_from IS NULL OR p_to IS NULL OR p_to < p_from THEN
        RAISE EXCEPTION 'Intervalo inválido.' USING ERRCODE = '22023';
    END IF;
    IF (p_to - p_from) > 92 THEN
        RAISE EXCEPTION 'Intervalo máximo de 92 dias.' USING ERRCODE = '22023';
    END IF;

    WITH page AS (
        SELECT a.*
        FROM public.attendance_justifications a
        WHERE a.period_start <= p_to
          AND a.period_end >= p_from
          AND (p_profile_id IS NULL OR a.profile_id = p_profile_id)
          AND (p_include_revoked OR a.revoked_at IS NULL)
          AND (p_cursor IS NULL
               OR (a.period_start, a.justified_at, a.id) < (v_c_start, v_c_at, v_c_id))
        ORDER BY a.period_start DESC, a.justified_at DESC, a.id DESC
        LIMIT v_limit + 1
    ),
    numbered AS (
        SELECT p.*, row_number() OVER (ORDER BY p.period_start DESC, p.justified_at DESC, p.id DESC) AS rn
        FROM page p
    )
    SELECT
        coalesce(jsonb_agg(public.attendance_row_json(
            (n.id, n.profile_id, n.period_start, n.period_end, n.category, n.reason, n.justified_by,
             n.justified_at, n.revoked_at, n.revoked_by, n.revocation_reason)::public.attendance_justifications)
            ORDER BY n.rn) FILTER (WHERE n.rn <= v_limit), '[]'::jsonb),
        count(*)
      INTO v_items, v_count
    FROM numbered n;

    IF v_count > v_limit THEN
        v_next := jsonb_build_object(
            'period_start', v_items -> (v_limit - 1) ->> 'period_start',
            'justified_at', v_items -> (v_limit - 1) ->> 'justified_at',
            'id', v_items -> (v_limit - 1) ->> 'id');
    END IF;

    RETURN jsonb_build_object('items', v_items, 'next_cursor', v_next);
END;
$$;

REVOKE ALL ON FUNCTION public.attendance_require_tutor() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.attendance_row_json(public.attendance_justifications) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.justify_attendance_debt(uuid, date, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revoke_attendance_justification(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_attendance_justifications(date, date, uuid, boolean, integer, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.attendance_require_tutor() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.justify_attendance_debt(uuid, date, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.revoke_attendance_justification(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_attendance_justifications(date, date, uuid, boolean, integer, jsonb) TO authenticated, service_role;

COMMIT;
