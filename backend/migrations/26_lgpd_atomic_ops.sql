-- Migration 26: operações LGPD atômicas e revogação efetiva (findings B-04, D-07, L-01)
--
-- Objetivo
--   * match_face deixa de devolver perfis com consentimento revogado.
--   * revogar consentimento, excluir perfil e substituir templates passam a ser
--     transações únicas no banco, com registro de quem executou.
-- NÃO faz expurgo de dados existentes. Os templates remanescentes de perfis já
-- revogados (finding L-02) dependem de aprovação: ver backend/db/ops/.
-- Recuperação: recriar match_face a partir da migração 20; DROP das funções novas.

BEGIN;

-- Trilha mínima de operações administrativas sensíveis ------------------------
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
    id bigserial PRIMARY KEY,
    action text NOT NULL,
    actor uuid,
    target uuid,
    detail jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.admin_audit_log FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.admin_audit_log_id_seq FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.admin_audit_log TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.admin_audit_log_id_seq TO service_role;
DROP POLICY IF EXISTS service_role_all_admin_audit_log ON public.admin_audit_log;
CREATE POLICY service_role_all_admin_audit_log ON public.admin_audit_log
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Busca vetorial: revogado nunca casa ----------------------------------------
CREATE OR REPLACE FUNCTION public.match_face(
    query_embedding extensions.vector,
    match_threshold double precision DEFAULT 0.32,
    match_count integer DEFAULT 1
)
RETURNS TABLE(profile_id uuid, name text, avatar_url text, similarity double precision)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_catalog'
AS $$
BEGIN
    RETURN QUERY
    SELECT p.id AS profile_id, p.name, p.avatar_url,
           1.0 - (fe.vec <=> query_embedding) AS similarity
    FROM public.face_embeddings fe
    JOIN public.profiles p ON p.id = fe.profile_id
    WHERE p.active = TRUE
      AND p.consent_revoked_at IS NULL
      AND (fe.vec <=> query_embedding) <= match_threshold
    ORDER BY fe.vec <=> query_embedding
    LIMIT match_count;
END;
$$;
REVOKE ALL ON FUNCTION public.match_face(extensions.vector, double precision, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_face(extensions.vector, double precision, integer) TO service_role;

-- Revogação de consentimento --------------------------------------------------
CREATE OR REPLACE FUNCTION public.revoke_profile_consent(p_profile_id uuid, p_actor uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    v_name text;
    v_now timestamptz := clock_timestamp();
    v_deleted integer;
BEGIN
    SELECT p.name INTO v_name FROM public.profiles p WHERE p.id = p_profile_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('found', false);
    END IF;

    UPDATE public.profiles
    SET active = false, consent_given = false, consent_revoked_at = v_now
    WHERE id = p_profile_id;

    DELETE FROM public.face_embeddings WHERE profile_id = p_profile_id;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;

    INSERT INTO public.admin_audit_log (action, actor, target, detail)
    VALUES ('revoke_consent', p_actor, p_profile_id,
            jsonb_build_object('embeddings_deleted', v_deleted));

    RETURN jsonb_build_object('found', true, 'name', v_name, 'revoked_at', v_now,
                              'embeddings_deleted', v_deleted);
END;
$$;

-- Exclusão definitiva ---------------------------------------------------------
-- As FKs reais de sessions e face_logs não têm cascade: a ordem é explícita.
-- Se existirem justificativas de frequência, a exclusão é recusada (decisão DP-6
-- pendente): nada é removido em cascata silenciosa.
CREATE OR REPLACE FUNCTION public.delete_profile_cascade(p_profile_id uuid, p_actor uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    v_has_just boolean := false;
    v_sessions integer;
    v_logs integer;
    v_embeddings integer;
BEGIN
    PERFORM 1 FROM public.profiles p WHERE p.id = p_profile_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('found', false, 'deleted', false);
    END IF;

    IF pg_catalog.to_regclass('public.attendance_justifications') IS NOT NULL THEN
        EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.attendance_justifications WHERE profile_id = $1)'
            INTO v_has_just USING p_profile_id;
    END IF;
    IF v_has_just THEN
        RETURN jsonb_build_object('found', true, 'deleted', false, 'reason', 'has_justifications');
    END IF;

    PERFORM pg_catalog.pg_advisory_xact_lock(public.presence_lock_key(p_profile_id));

    DELETE FROM public.face_embeddings WHERE profile_id = p_profile_id;
    GET DIAGNOSTICS v_embeddings = ROW_COUNT;
    DELETE FROM public.face_logs WHERE profile_id = p_profile_id;
    GET DIAGNOSTICS v_logs = ROW_COUNT;
    DELETE FROM public.sessions WHERE profile_id = p_profile_id;
    GET DIAGNOSTICS v_sessions = ROW_COUNT;
    DELETE FROM public.profiles WHERE id = p_profile_id;

    INSERT INTO public.admin_audit_log (action, actor, target, detail)
    VALUES ('delete_profile', p_actor, p_profile_id,
            jsonb_build_object('sessions', v_sessions, 'face_logs', v_logs, 'embeddings', v_embeddings));

    RETURN jsonb_build_object('found', true, 'deleted', true, 'sessions', v_sessions,
                              'face_logs', v_logs, 'embeddings', v_embeddings);
END;
$$;

-- Substituição de templates (recadastro) --------------------------------------
-- p_embeddings: array JSON de vetores (cada um com 512 números).
CREATE OR REPLACE FUNCTION public.replace_profile_embeddings(
    p_profile_id uuid,
    p_embeddings jsonb,
    p_actor uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    v_elem jsonb;
    v_count integer := 0;
    v_active boolean;
    v_revoked timestamptz;
BEGIN
    IF p_embeddings IS NULL OR jsonb_typeof(p_embeddings) <> 'array' OR jsonb_array_length(p_embeddings) = 0 THEN
        RAISE EXCEPTION 'Lista de templates vazia.' USING ERRCODE = '22023';
    END IF;

    SELECT p.active, p.consent_revoked_at INTO v_active, v_revoked
    FROM public.profiles p WHERE p.id = p_profile_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('found', false, 'replaced', false);
    END IF;
    IF NOT v_active OR v_revoked IS NOT NULL THEN
        RETURN jsonb_build_object('found', true, 'replaced', false, 'reason', 'inactive_or_revoked');
    END IF;

    DELETE FROM public.face_embeddings WHERE profile_id = p_profile_id;

    FOR v_elem IN SELECT * FROM jsonb_array_elements(p_embeddings)
    LOOP
        IF jsonb_typeof(v_elem) <> 'array' OR jsonb_array_length(v_elem) <> 512 THEN
            RAISE EXCEPTION 'Template com dimensão inválida.' USING ERRCODE = '22023';
        END IF;
        INSERT INTO public.face_embeddings (profile_id, embedding, vec)
        VALUES (
            p_profile_id,
            ARRAY(SELECT t.value::double precision FROM jsonb_array_elements_text(v_elem) AS t(value)),
            (v_elem::text)::extensions.vector
        );
        v_count := v_count + 1;
    END LOOP;

    INSERT INTO public.admin_audit_log (action, actor, target, detail)
    VALUES ('replace_embeddings', p_actor, p_profile_id, jsonb_build_object('count', v_count));

    RETURN jsonb_build_object('found', true, 'replaced', true, 'count', v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_profile_consent(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_profile_cascade(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.replace_profile_embeddings(uuid, jsonb, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_profile_consent(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_profile_cascade(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.replace_profile_embeddings(uuid, jsonb, uuid) TO service_role;

COMMIT;
