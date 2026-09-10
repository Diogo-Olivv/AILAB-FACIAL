-- =============================================================================
-- MIGRAÇÃO DE SEGURANÇA E LGPD (FASE 2) — AILAB-FACIAL
-- Pode ser executado diretamente no SQL Editor do painel Supabase.
-- Idempotente e transacional.
-- =============================================================================

BEGIN;

-- 1. Reconciliação de Colunas LGPD em profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS terms_version text DEFAULT 'v1.0',
  ADD COLUMN IF NOT EXISTS consent_revoked_at timestamptz DEFAULT NULL;

-- 2. Habilitação Obrigatória de Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

ALTER TABLE public.face_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.face_embeddings FORCE ROW LEVEL SECURITY;

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.face_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.face_logs FORCE ROW LEVEL SECURITY;

-- 3. Limpeza Idempotente de Políticas Prévias
DROP POLICY IF EXISTS "service_role_all_profiles" ON public.profiles;
DROP POLICY IF EXISTS "service_role_all_embeddings" ON public.face_embeddings;
DROP POLICY IF EXISTS "service_role_all_sessions" ON public.sessions;
DROP POLICY IF EXISTS "service_role_all_logs" ON public.face_logs;

DROP POLICY IF EXISTS "anon_select_active_profiles" ON public.profiles;
DROP POLICY IF EXISTS "anon_select_open_sessions" ON public.sessions;

DROP POLICY IF EXISTS "authenticated_select_profiles" ON public.profiles;
DROP POLICY IF EXISTS "authenticated_update_profiles" ON public.profiles;
DROP POLICY IF EXISTS "authenticated_select_sessions" ON public.sessions;
DROP POLICY IF EXISTS "authenticated_manage_sessions" ON public.sessions;
DROP POLICY IF EXISTS "authenticated_select_logs" ON public.face_logs;

-- 4. Criação de Políticas por Role
-- A. service_role (Acesso irrestrito exclusivo para o backend FastAPI)
CREATE POLICY "service_role_all_profiles"
  ON public.profiles FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_embeddings"
  ON public.face_embeddings FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_sessions"
  ON public.sessions FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_logs"
  ON public.face_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- B. anon (Kiosk Tablet físico / Mobile público)
-- Permite leitura de perfis ativos não revogados para exibição da lista de presentes
CREATE POLICY "anon_select_active_profiles"
  ON public.profiles FOR SELECT TO anon
  USING (active = true AND consent_revoked_at IS NULL);

-- Permite leitura de presenças em aberto
CREATE POLICY "anon_select_open_sessions"
  ON public.sessions FOR SELECT TO anon
  USING (check_out IS NULL AND voided_at IS NULL);

-- ATENÇÃO: Nenhuma policy é criada para anon em face_embeddings nem face_logs.
-- Isso garante o BLOQUEIO TOTAL contra dumps de biometria via anon key.

-- C. authenticated (Tutores no Dashboard Web)
CREATE POLICY "authenticated_select_profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "authenticated_update_profiles"
  ON public.profiles FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_select_sessions"
  ON public.sessions FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "authenticated_manage_sessions"
  ON public.sessions FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_select_logs"
  ON public.face_logs FOR SELECT TO authenticated
  USING (true);

-- 5. Atualização de Schema do PostgREST
NOTIFY pgrst, 'reload schema';

COMMIT;
