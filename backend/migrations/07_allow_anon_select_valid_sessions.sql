-- Migration 07: Allow Anon Select on Valid Sessions
-- Permite leitura anônima de sessões válidas (em aberto ou fechadas) para o Dashboard público de Permanência.
-- Sessões anuladas (voided_at IS NOT NULL) continuam ocultas da consulta pública.

BEGIN;

-- 1. Remove a política restrita antiga que só permitia sessões em aberto (check_out IS NULL)
DROP POLICY IF EXISTS "anon_select_open_sessions" ON public.sessions;
DROP POLICY IF EXISTS "anon_select_sessions" ON public.sessions;

-- 2. Cria política que permite leitura de todas as presenças válidas (check_in e check_out concluídos ou abertos)
CREATE POLICY "anon_select_sessions"
  ON public.sessions FOR SELECT TO anon
  USING (voided_at IS NULL);

-- 3. Notifica o PostgREST para recarregar o cache de schema
NOTIFY pgrst, 'reload schema';

COMMIT;
