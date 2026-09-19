-- Migration 17: Allow Anon Select on Valid Sessions (Students Panel)
-- Permite leitura anônima de sessões válidas (abertas ou fechadas) para o Painel do Aluno.
-- Sessões anuladas (voided_at IS NOT NULL) continuam ocultas da consulta anônima.
-- Operações de escrita (INSERT, UPDATE, DELETE) continuam estritamente restritas a Tutores.

BEGIN;

-- 1. Remove a política antiga restritiva que permitia apenas sessões em aberto (check_out IS NULL)
DROP POLICY IF EXISTS anon_select_open_sessions ON public.sessions;
DROP POLICY IF EXISTS anon_select_sessions ON public.sessions;

-- 2. Cria política que permite leitura de todas as presenças válidas (fechadas ou abertas) para anon
CREATE POLICY anon_select_sessions
  ON public.sessions FOR SELECT TO anon
  USING (voided_at IS NULL);

-- 3. Notifica o PostgREST para recarregar o cache de schema
NOTIFY pgrst, 'reload schema';

COMMIT;
