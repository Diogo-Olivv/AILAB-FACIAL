-- Migration 29: fecha escrita do role anon e a RPC link_tutor_profile para anon.
--
-- Motivo (AF-01/AF-02 contenção, auditoria 2026-11-10):
--   * link_tutor_profile é SECURITY DEFINER e não verifica identidade: qualquer
--     chamador anônimo promovia um perfil a tutor pela matrícula.
--   * anon tinha INSERT/UPDATE/DELETE/TRUNCATE nas tabelas de dados biométricos.
--     TRUNCATE ignora RLS.
--
-- Espelha a revogação aplicada manualmente em produção (projeto ailab-facial)
-- e é idempotente: REVOKE de privilégio inexistente não falha.
-- Não altera SELECT de anon (tratado na migration 28).

BEGIN;

REVOKE EXECUTE ON FUNCTION public.link_tutor_profile(text, text) FROM anon, PUBLIC;

REVOKE TRUNCATE, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER
  ON public.profiles, public.sessions, public.face_logs, public.face_embeddings, public.sync_cursor
  FROM anon;

-- TRUNCATE nunca é usado pelo app; REFERENCES/TRIGGER também não. INSERT/UPDATE/DELETE
-- de authenticated permanecem: são exercidos pelo painel do tutor sob RLS.
REVOKE TRUNCATE, REFERENCES, TRIGGER
  ON public.profiles, public.sessions, public.face_logs, public.face_embeddings, public.sync_cursor
  FROM authenticated;

COMMIT;
