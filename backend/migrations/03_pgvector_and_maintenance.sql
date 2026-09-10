-- Migração 03: Ativação de pgvector, índice HNSW e RPC match_face
-- Pode ser executada com segurança no Supabase SQL Editor.

-- 1. Ativação da extensão pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Adiciona coluna vec vector(512) na tabela face_embeddings se ainda não existir
ALTER TABLE public.face_embeddings
  ADD COLUMN IF NOT EXISTS vec vector(512);

-- 3. Backfill idempotente: converte embeddings legados float8[] para vector(512)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'face_embeddings'
      AND column_name = 'embedding'
  ) THEN
    UPDATE public.face_embeddings
    SET vec = embedding::text::vector(512)
    WHERE vec IS NULL AND embedding IS NOT NULL;
  END IF;
END $$;

-- 4. Índice HNSW com operador de distância cosseno (<=>)
-- Parâmetros recomendados para biometria: m=16 (conexões por nó), ef_construction=64
CREATE INDEX IF NOT EXISTS idx_face_embeddings_hnsw
  ON public.face_embeddings
  USING hnsw (vec vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 5. RPC match_face para consulta de similaridade cosseno no banco
-- Evita transferir toda a tabela de embeddings para a RAM do Cloud Run
CREATE OR REPLACE FUNCTION public.match_face(
  query_embedding vector(512),
  match_threshold float DEFAULT 0.68,
  match_count int DEFAULT 1
)
RETURNS TABLE (
  profile_id uuid,
  name text,
  avatar_url text,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id AS profile_id,
    p.name,
    p.avatar_url,
    (1 - (fe.vec <=> query_embedding))::float AS similarity
  FROM public.face_embeddings fe
  JOIN public.profiles p ON p.id = fe.profile_id
  WHERE p.active = true
    AND (fe.vec IS NOT NULL)
    AND (1 - (fe.vec <=> query_embedding)) >= match_threshold
  ORDER BY fe.vec <=> query_embedding ASC
  LIMIT match_count;
END;
$$;

-- Permissões: apenas o backend autenticado com service_role deve executar a busca
REVOKE ALL ON FUNCTION public.match_face(vector(512), float, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_face(vector(512), float, int) TO service_role;
