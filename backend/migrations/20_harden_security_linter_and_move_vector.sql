-- Migration 20: Hardening do Supabase Linter (splinter)
-- 1. Move extensão vector para o schema 'extensions' (0014_extension_in_public)
-- 2. Atualiza search_path de match_face e restringe execução estritamente a service_role
-- 3. Converte RPCs de gestão de presença para SECURITY INVOKER apoiadas por RLS
-- 4. Corrige policies RLS para referenciar estritamente app_metadata (0015_rls_references_user_metadata)
-- 5. Revoga chamadas anônimas e públicas de RPCs administrativas

BEGIN;

-- ─── 1. Mover extensão vector do schema public para extensions ───────────────
CREATE SCHEMA IF NOT EXISTS extensions;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'vector'
  ) THEN
    ALTER EXTENSION vector SET SCHEMA extensions;
  END IF;
END $$;

-- ─── 2. Atualizar RPC match_face (restrita estritamente a service_role) ──────
CREATE OR REPLACE FUNCTION public.match_face(
    query_embedding  extensions.vector(512),
    match_threshold  float8 DEFAULT 0.32,
    match_count      int    DEFAULT 1
)
RETURNS TABLE (
    profile_id  uuid,
    name        text,
    avatar_url  text,
    similarity  float8
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id                                  AS profile_id,
        p.name,
        p.avatar_url,
        1.0 - (fe.vec <=> query_embedding)   AS similarity
    FROM public.face_embeddings fe
    JOIN public.profiles p ON p.id = fe.profile_id
    WHERE p.active = TRUE
      AND (fe.vec <=> query_embedding) <= match_threshold
    ORDER BY fe.vec <=> query_embedding
    LIMIT match_count;
END;
$$;

-- match_face é executado exclusivamente pelo backend (FastAPI / Cloud Run) via service_role.
-- Revogar de anon e authenticated elimina 0028 e 0029 do linter.
REVOKE ALL ON FUNCTION public.match_face(extensions.vector, float8, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_face(extensions.vector, float8, int) TO service_role;

-- ─── 3. Hardening de RLS: usar estritamente app_metadata (corrige 0015) ──────
-- Supabase Linter 0015: user_metadata é editável pelo cliente final e NÃO pode
-- ser referenciado em regras de segurança. Usar unicamente app_metadata->'role'.

-- Profiles
DROP POLICY IF EXISTS tutor_select_profiles ON public.profiles;
CREATE POLICY tutor_select_profiles
  ON public.profiles FOR SELECT TO authenticated
  USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'tutor');

DROP POLICY IF EXISTS tutor_write_profiles ON public.profiles;
CREATE POLICY tutor_write_profiles
  ON public.profiles FOR INSERT, UPDATE, DELETE TO authenticated
  USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'tutor')
  WITH CHECK (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'tutor');

-- Sessions
DROP POLICY IF EXISTS tutor_select_sessions ON public.sessions;
CREATE POLICY tutor_select_sessions
  ON public.sessions FOR SELECT TO authenticated
  USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'tutor');

DROP POLICY IF EXISTS tutor_write_sessions ON public.sessions;
CREATE POLICY tutor_write_sessions
  ON public.sessions FOR INSERT, UPDATE, DELETE TO authenticated
  USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'tutor')
  WITH CHECK (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'tutor');

-- Face Logs
DROP POLICY IF EXISTS tutor_select_logs ON public.face_logs;
CREATE POLICY tutor_select_logs
  ON public.face_logs FOR SELECT TO authenticated
  USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'tutor');

DROP POLICY IF EXISTS tutor_delete_face_logs ON public.face_logs;
CREATE POLICY tutor_delete_face_logs
  ON public.face_logs FOR DELETE TO authenticated
  USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'tutor');

-- Face Embeddings
DROP POLICY IF EXISTS tutor_delete_face_embeddings ON public.face_embeddings;
CREATE POLICY tutor_delete_face_embeddings
  ON public.face_embeddings FOR DELETE TO authenticated
  USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'tutor');

-- ─── 4. Conversão das RPCs de presença para SECURITY INVOKER ─────────────────
CREATE OR REPLACE FUNCTION public.tutor_close_session(
    p_profile_id uuid,
    p_action text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, auth, pg_catalog
AS $$
DECLARE
  v_now timestamptz := now();
  v_updated_count int := 0;
BEGIN
  PERFORM public.require_tutor_or_service();
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
SECURITY INVOKER
SET search_path = public, auth, pg_catalog
AS $$
DECLARE
  v_open_session_id bigint;
  v_new_id bigint;
  v_now timestamptz := now();
BEGIN
  PERFORM public.require_tutor_or_service();
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

CREATE OR REPLACE FUNCTION public.tutor_remove_member(
    p_profile_id uuid,
    p_purge_data boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, auth, pg_catalog
AS $$
DECLARE
  v_name text;
  v_now timestamptz := now();
BEGIN
  PERFORM public.require_tutor_or_service();
  SELECT name INTO v_name FROM public.profiles WHERE id = p_profile_id;
  IF v_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Integrante não encontrado.');
  END IF;
  UPDATE public.sessions SET check_out = v_now, voided_at = v_now, auto_closed = true
  WHERE profile_id = p_profile_id AND check_out IS NULL;
  DELETE FROM public.face_embeddings WHERE profile_id = p_profile_id;
  IF p_purge_data THEN
    DELETE FROM public.sessions WHERE profile_id = p_profile_id;
    DELETE FROM public.face_logs WHERE profile_id = p_profile_id;
    DELETE FROM public.profiles WHERE id = p_profile_id;
  ELSE
    UPDATE public.profiles SET active = false, consent_revoked_at = v_now WHERE id = p_profile_id;
  END IF;
  RETURN jsonb_build_object('success', true, 'profile_id', p_profile_id,
    'name', v_name, 'purged', p_purge_data);
END;
$$;

CREATE OR REPLACE FUNCTION public.tutor_void_session(
    p_session_id bigint,
    p_reason text DEFAULT 'anomalous_or_over_10h'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, auth, pg_catalog
AS $$
DECLARE
  v_now timestamptz := now();
  v_profile_id uuid;
  v_check_out timestamptz;
BEGIN
  PERFORM public.require_tutor_or_service();
  SELECT profile_id, check_out INTO v_profile_id, v_check_out
  FROM public.sessions WHERE id = p_session_id;
  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Sessão não encontrada.');
  END IF;
  IF v_check_out IS NULL THEN
    UPDATE public.sessions SET check_out = v_now, voided_at = v_now, auto_closed = true WHERE id = p_session_id;
  ELSE
    UPDATE public.sessions SET voided_at = v_now, auto_closed = true WHERE id = p_session_id;
  END IF;
  RETURN jsonb_build_object('success', true, 'session_id', p_session_id,
    'profile_id', v_profile_id, 'reason', p_reason, 'voided_at', v_now);
END;
$$;

CREATE OR REPLACE FUNCTION public.tutor_unvoid_session(p_session_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, auth, pg_catalog
AS $$
DECLARE
  v_profile_id uuid;
BEGIN
  PERFORM public.require_tutor_or_service();
  SELECT profile_id INTO v_profile_id FROM public.sessions WHERE id = p_session_id;
  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Sessão não encontrada.');
  END IF;
  UPDATE public.sessions SET voided_at = NULL WHERE id = p_session_id;
  RETURN jsonb_build_object('success', true, 'session_id', p_session_id, 'profile_id', v_profile_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.tutor_delete_session(p_session_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, auth, pg_catalog
AS $$
DECLARE
  v_profile_id uuid;
  v_deleted_count int := 0;
BEGIN
  PERFORM public.require_tutor_or_service();
  SELECT profile_id INTO v_profile_id FROM public.sessions WHERE id = p_session_id;
  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Sessão não encontrada.');
  END IF;
  DELETE FROM public.sessions WHERE id = p_session_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'session_id', p_session_id,
    'profile_id', v_profile_id, 'deleted_count', v_deleted_count);
END;
$$;

-- ─── 5. verify_tutor_login: Restringir exclusivamente ao service_role ────────
-- O cliente web e mobile já utilizam supabase.auth.signInWithPassword diretamente.
-- Restringir ao service_role elimina os alertas 0028 e 0029 do linter.
REVOKE ALL ON FUNCTION public.verify_tutor_login(text, text) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_tutor_login(text, text) TO service_role;

-- ─── 6. Permissões de Execução para as funções INVOKER ───────────────────────
GRANT EXECUTE ON FUNCTION public.tutor_close_session(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tutor_register_entry(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tutor_remove_member(uuid, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tutor_void_session(bigint, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tutor_unvoid_session(bigint) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tutor_delete_session(bigint) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
