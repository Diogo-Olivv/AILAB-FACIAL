-- Migration 28 (CONTRACT): fecha a leitura anônima das tabelas (finding D-01, DP-1)
--
-- APLICAR SOMENTE DEPOIS de:
--   * migração 23 aplicada;
--   * dashboard web publicado usando public_lab_stats() para quem não está logado;
--   * todos os totens atualizados e provisionados com identidade própria
--     (kiosk_presence / kiosk_directory).
-- Um totem ou painel antigo deixa de ler perfis e sessões após esta migração.
--
-- Efeito: remove policies e grants de anon. Nenhum dado é alterado.
-- Recuperação: recriar as duas policies e os GRANT SELECT (ver migrações 01 e 17).

BEGIN;

DROP POLICY IF EXISTS anon_select_active_profiles ON public.profiles;
DROP POLICY IF EXISTS anon_select_sessions ON public.sessions;

REVOKE ALL ON TABLE public.profiles FROM anon;
REVOKE ALL ON TABLE public.sessions FROM anon;
REVOKE ALL ON TABLE public.face_embeddings FROM anon;
REVOKE ALL ON TABLE public.face_logs FROM anon;
REVOKE ALL ON TABLE public.sync_cursor FROM anon, authenticated;

-- Nenhum papel de cliente precisa de TRUNCATE/REFERENCES/TRIGGER.
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.profiles FROM authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.sessions FROM authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.face_embeddings FROM authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.face_logs FROM authenticated;
-- Embeddings nunca são lidos nem escritos por clientes; tutor só exclui (RPC tutor_remove_member).
REVOKE SELECT, INSERT, UPDATE ON TABLE public.face_embeddings FROM authenticated;

-- Realtime: perfis deixam de ser publicados (nomes vêm das RPCs mínimas).
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication_tables
               WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'profiles') THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE public.profiles;
    END IF;
END $$;

COMMIT;
