-- =============================================================================
-- MIGRAÇÃO DE CONCORRÊNCIA E CÁLCULO DE DURAÇÃO (FASE 3) — AILAB-FACIAL
-- Pode ser executado diretamente no SQL Editor do Supabase.
-- Idempotente e transacional.
-- =============================================================================

BEGIN;

-- 1. Eliminação de Race Conditions: Substituição do índice por ÚNICO parcial
-- Garante que o banco de dados rejeite (erro 23505) qualquer tentativa concorrente
-- de criar múltiplas sessões com check_out IS NULL para o mesmo perfil.
DROP INDEX IF EXISTS public.idx_sessions_profile_open;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_profile_single_open
  ON public.sessions (profile_id)
  WHERE check_out IS NULL;

-- 2. Inconsistência de Schema: Coluna duration_s Gerada Armazenada
-- Calcula a duração em segundos com precisão matemática diretamente no PostgreSQL.
ALTER TABLE public.sessions
  DROP COLUMN IF EXISTS duration_s;

ALTER TABLE public.sessions
  ADD COLUMN duration_s integer GENERATED ALWAYS AS (
    CASE
      WHEN check_out IS NOT NULL AND voided_at IS NULL THEN
        GREATEST(0, EXTRACT(EPOCH FROM (check_out - check_in))::integer)
      ELSE NULL
    END
  ) STORED;

-- 3. Rastreabilidade de Encerramento Automático (Sweep Justo)
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS auto_closed boolean NOT NULL DEFAULT false;

-- 4. Notifica o PostgREST para recarregar o schema imediatamente
NOTIFY pgrst, 'reload schema';

COMMIT;
