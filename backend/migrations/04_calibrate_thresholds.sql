-- Migração 04: Calibração de limiar do RPC match_face para 0.45
-- Adapta a busca vetorial HNSW para a distribuição empírica do modelo buffalo_s

CREATE OR REPLACE FUNCTION public.match_face(
  query_embedding vector(512),
  match_threshold float DEFAULT 0.45,
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

REVOKE ALL ON FUNCTION public.match_face(vector(512), float, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_face(vector(512), float, int) TO service_role;
