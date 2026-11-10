-- Baseline para banco NOVO (CI / efêmero), reconstruído do catálogo real em 2026-11-10.
-- NÃO aplicar em produção e NÃO registrar no histórico remoto: produção já está neste estado.
-- Fonte: information_schema, pg_policies, pg_indexes, pg_constraint, pg_get_functiondef.
SET search_path TO "$user", public, extensions;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  matricula text UNIQUE,
  avatar_url text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  consent_given boolean NOT NULL DEFAULT false,
  consent_at timestamptz,
  terms_version text DEFAULT 'v1.0',
  consent_revoked_at timestamptz,
  is_tutor boolean NOT NULL DEFAULT false,
  tutor_email text
);
CREATE INDEX idx_profiles_is_tutor ON public.profiles (is_tutor) WHERE is_tutor = true;

CREATE TABLE public.face_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  embedding double precision[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  vec extensions.vector(512)
);
CREATE INDEX idx_face_embeddings_profile ON public.face_embeddings (profile_id);
CREATE INDEX idx_face_embeddings_hnsw ON public.face_embeddings
  USING hnsw (vec extensions.vector_cosine_ops) WITH (m = 24, ef_construction = 128);

CREATE TABLE public.face_logs (
  id bigserial PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES public.profiles(id),
  confidence real NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_face_logs_profile ON public.face_logs (profile_id, captured_at DESC);

CREATE TABLE public.sessions (
  id bigserial PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES public.profiles(id),
  check_in timestamptz NOT NULL,
  check_out timestamptz,
  duration_s integer GENERATED ALWAYS AS ((EXTRACT(epoch FROM (check_out - check_in)))::integer) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  voided_at timestamptz,
  auto_closed boolean NOT NULL DEFAULT false
);
CREATE INDEX idx_sessions_profile ON public.sessions (profile_id, check_in DESC);
CREATE INDEX idx_sessions_open ON public.sessions (check_out) WHERE check_out IS NULL;
CREATE UNIQUE INDEX idx_sessions_profile_single_open ON public.sessions (profile_id) WHERE check_out IS NULL;

CREATE TABLE public.sync_cursor (key text PRIMARY KEY, value text NOT NULL);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.face_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.face_embeddings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.face_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.face_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sync_cursor ENABLE ROW LEVEL SECURITY;

-- Policies (estado real)
CREATE POLICY service_role_all_profiles ON public.profiles FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_embeddings ON public.face_embeddings FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_logs ON public.face_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_sessions ON public.sessions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_sync_cursor ON public.sync_cursor FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY anon_select_active_profiles ON public.profiles FOR SELECT TO anon
  USING (active = true AND consent_revoked_at IS NULL);
CREATE POLICY anon_select_sessions ON public.sessions FOR SELECT TO anon USING (voided_at IS NULL);

CREATE POLICY tutor_select_profiles ON public.profiles FOR SELECT TO authenticated
  USING (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') = 'tutor');
CREATE POLICY tutor_update_profiles ON public.profiles FOR UPDATE TO authenticated
  USING (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') = 'tutor')
  WITH CHECK (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') = 'tutor');
CREATE POLICY tutor_delete_profiles ON public.profiles FOR DELETE TO authenticated
  USING (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') = 'tutor');
CREATE POLICY tutor_write_profiles ON public.profiles FOR ALL TO authenticated
  USING (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') = 'tutor')
  WITH CHECK (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') = 'tutor');

CREATE POLICY tutor_select_sessions ON public.sessions FOR SELECT TO authenticated
  USING (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') = 'tutor');
CREATE POLICY tutor_update_sessions ON public.sessions FOR UPDATE TO authenticated
  USING (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') = 'tutor')
  WITH CHECK (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') = 'tutor');
CREATE POLICY tutor_delete_sessions ON public.sessions FOR DELETE TO authenticated
  USING (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') = 'tutor');
CREATE POLICY tutor_write_sessions ON public.sessions FOR ALL TO authenticated
  USING (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') = 'tutor')
  WITH CHECK (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') = 'tutor');

CREATE POLICY tutor_select_logs ON public.face_logs FOR SELECT TO authenticated
  USING (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') = 'tutor');
CREATE POLICY tutor_delete_face_logs ON public.face_logs FOR DELETE TO authenticated
  USING (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') = 'tutor');
CREATE POLICY tutor_delete_face_embeddings ON public.face_embeddings FOR DELETE TO authenticated
  USING (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') = 'tutor');

-- Funções (estado real)
CREATE OR REPLACE FUNCTION public.last_event_time(p_profile_id uuid) RETURNS timestamptz
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT MAX(COALESCE(check_out, check_in)) FROM sessions WHERE profile_id = p_profile_id; $$;
REVOKE ALL ON FUNCTION public.last_event_time(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.last_event_time(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.match_face(query_embedding extensions.vector, match_threshold double precision DEFAULT 0.32, match_count integer DEFAULT 1)
 RETURNS TABLE(profile_id uuid, name text, avatar_url text, similarity double precision)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions', 'pg_catalog'
AS $$
BEGIN
    RETURN QUERY
    SELECT p.id AS profile_id, p.name, p.avatar_url, 1.0 - (fe.vec <=> query_embedding) AS similarity
    FROM public.face_embeddings fe
    JOIN public.profiles p ON p.id = fe.profile_id
    WHERE p.active = TRUE AND (fe.vec <=> query_embedding) <= match_threshold
    ORDER BY fe.vec <=> query_embedding
    LIMIT match_count;
END;
$$;
REVOKE ALL ON FUNCTION public.match_face(extensions.vector, double precision, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_face(extensions.vector, double precision, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.require_tutor_or_service() RETURNS void
 LANGUAGE plpgsql STABLE SET search_path TO 'public', 'auth', 'pg_catalog'
AS $$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin') OR coalesce(auth.role(), '') = 'service_role' THEN
    RETURN;
  END IF;
  IF coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'tutor' THEN
    RAISE EXCEPTION 'Acesso restrito a tutores autorizados.' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.require_tutor_or_service() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.require_tutor_or_service() TO service_role;

CREATE OR REPLACE FUNCTION public.sweep_stale_sessions() RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'auth', 'pg_catalog'
AS $$
DECLARE v_now timestamptz := now(); v_updated_count int := 0;
BEGIN
  IF current_user NOT IN ('postgres', 'supabase_admin') AND coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Rotina de manutenção restrita ao service_role.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.sessions SET check_out = v_now, voided_at = v_now, auto_closed = true
  WHERE check_out IS NULL AND ((v_now - check_in) >= interval '10 hours'
    OR (check_in AT TIME ZONE 'America/Sao_Paulo')::date < (v_now AT TIME ZONE 'America/Sao_Paulo')::date);
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'auto_closed', v_updated_count, 'timestamp', v_now);
END;
$$;
REVOKE ALL ON FUNCTION public.sweep_stale_sessions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sweep_stale_sessions() TO service_role;

CREATE OR REPLACE FUNCTION public.tutor_close_session(p_profile_id uuid, p_action text) RETURNS jsonb
 LANGUAGE plpgsql SET search_path TO 'public', 'auth', 'pg_catalog'
AS $$
DECLARE v_now timestamptz := now(); v_updated_count int := 0;
BEGIN
  PERFORM public.require_tutor_or_service();
  IF p_action = 'checkout' THEN
    UPDATE public.sessions SET check_out = v_now WHERE profile_id = p_profile_id AND check_out IS NULL;
  ELSIF p_action = 'void' THEN
    UPDATE public.sessions SET check_out = v_now, voided_at = v_now, auto_closed = true
    WHERE profile_id = p_profile_id AND check_out IS NULL;
  ELSE
    RAISE EXCEPTION 'Ação inválida: %', p_action USING ERRCODE = '22023';
  END IF;
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'profile_id', p_profile_id,
    'action', p_action, 'updated_count', v_updated_count, 'timestamp', v_now);
END;
$$;

CREATE OR REPLACE FUNCTION public.tutor_register_entry(p_profile_id uuid) RETURNS jsonb
 LANGUAGE plpgsql SET search_path TO 'public', 'auth', 'pg_catalog'
AS $$
DECLARE v_open_session_id bigint; v_new_id bigint; v_now timestamptz := now();
BEGIN
  PERFORM public.require_tutor_or_service();
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_profile_id AND active = true) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Integrante inativo ou não encontrado no sistema.');
  END IF;
  SELECT id INTO v_open_session_id FROM public.sessions WHERE profile_id = p_profile_id AND check_out IS NULL LIMIT 1;
  IF v_open_session_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Integrante já possui uma presença em andamento no laboratório.');
  END IF;
  INSERT INTO public.sessions (profile_id, check_in) VALUES (p_profile_id, v_now) RETURNING id INTO v_new_id;
  RETURN jsonb_build_object('success', true, 'session_id', v_new_id, 'check_in', v_now);
END;
$$;

CREATE OR REPLACE FUNCTION public.tutor_remove_member(p_profile_id uuid, p_purge_data boolean DEFAULT false) RETURNS jsonb
 LANGUAGE plpgsql SET search_path TO 'public', 'auth', 'pg_catalog'
AS $$
DECLARE v_name text; v_now timestamptz := now();
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
  RETURN jsonb_build_object('success', true, 'profile_id', p_profile_id, 'name', v_name, 'purged', p_purge_data);
END;
$$;

CREATE OR REPLACE FUNCTION public.tutor_void_session(p_session_id bigint, p_reason text DEFAULT 'anomalous_or_over_10h') RETURNS jsonb
 LANGUAGE plpgsql SET search_path TO 'public', 'auth', 'pg_catalog'
AS $$
DECLARE v_now timestamptz := now(); v_profile_id uuid; v_check_out timestamptz;
BEGIN
  PERFORM public.require_tutor_or_service();
  SELECT profile_id, check_out INTO v_profile_id, v_check_out FROM public.sessions WHERE id = p_session_id;
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

CREATE OR REPLACE FUNCTION public.tutor_unvoid_session(p_session_id bigint) RETURNS jsonb
 LANGUAGE plpgsql SET search_path TO 'public', 'auth', 'pg_catalog'
AS $$
DECLARE v_profile_id uuid;
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

CREATE OR REPLACE FUNCTION public.tutor_delete_session(p_session_id bigint) RETURNS jsonb
 LANGUAGE plpgsql SET search_path TO 'public', 'auth', 'pg_catalog'
AS $$
DECLARE v_profile_id uuid; v_deleted_count int := 0;
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

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'tutor_close_session(uuid, text)', 'tutor_register_entry(uuid)', 'tutor_remove_member(uuid, boolean)',
    'tutor_void_session(bigint, text)', 'tutor_unvoid_session(bigint)', 'tutor_delete_session(bigint)']
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', f);
  END LOOP;
END $$;

-- Estado real vulnerável (S-04), reproduzido para que a migração 22 seja testada contra ele.
CREATE OR REPLACE FUNCTION public.link_tutor_profile(p_matricula text, p_tutor_email text) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'auth', 'extensions', 'pg_catalog'
AS $$
DECLARE v_clean_mat text := trim(p_matricula); v_clean_email text := lower(trim(p_tutor_email));
        v_profile_id uuid; v_profile_name text;
BEGIN
  SELECT id, name INTO v_profile_id, v_profile_name FROM public.profiles WHERE matricula = v_clean_mat LIMIT 1;
  IF v_profile_id IS NOT NULL THEN
    UPDATE public.profiles SET is_tutor = true, tutor_email = v_clean_email WHERE id = v_profile_id;
    RETURN jsonb_build_object('success', true, 'linked', true, 'profile_id', v_profile_id, 'name', v_profile_name);
  END IF;
  RETURN jsonb_build_object('success', true, 'linked', false);
END;
$$;
GRANT EXECUTE ON FUNCTION public.link_tutor_profile(text, text) TO anon, authenticated, service_role;

-- Presentes no estado real e removidas pela migração 22.
-- Os corpos reais NÃO são reproduzidos aqui: contêm credencial.
CREATE OR REPLACE FUNCTION public.verify_tutor_login(p_email text, p_password text) RETURNS jsonb
 LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$ SELECT '{"valid": false}'::jsonb; $$;
CREATE OR REPLACE FUNCTION public.sync_tutor_credentials(p_current_email text, p_new_email text, p_new_password text) RETURNS jsonb
 LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$ SELECT '{"success": false}'::jsonb; $$;
REVOKE ALL ON FUNCTION public.verify_tutor_login(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_tutor_credentials(text, text, text) FROM PUBLIC, anon, authenticated;
