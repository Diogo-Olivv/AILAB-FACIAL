-- Migration 06: Recalibrate Biometric Thresholds & HNSW Index
-- Updates the match_face RPC threshold to align with the new production values
-- calibrated for ArcFace/buffalo_s at EER = 0.1% FAR.
-- Execute manually in Supabase SQL Editor AFTER migration 05.
--
-- New thresholds:
--   face_threshold      (Euclidean)  : 0.80  (was 1.00)
--   face_min_cosine     (accept)     : 0.68  (was 0.50)
--   face_uncertain_cosine (uncertain): 0.62  (new)
--   pgvector RPC        (1-cos dist) : <=0.32 → similarity >= 0.68

-- ─── 1. Drop previous match_face RPC and recreate with calibrated threshold ──

DROP FUNCTION IF EXISTS public.match_face(vector(512), float8, int);
DROP FUNCTION IF EXISTS public.match_face(vector, float8, int);

CREATE OR REPLACE FUNCTION public.match_face(
    query_embedding  vector(512),
    match_threshold  float8 DEFAULT 0.32,   -- 1 - cos_theta; 0.32 <=> cos >= 0.68
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

-- ─── 2. Tune HNSW index for production scale (up to 10 k members) ────────────
-- Drops and recreates with higher ef_construction and m for better recall.
-- This is a heavy operation on large tables — execute during off-peak hours.

DROP INDEX IF EXISTS public.face_embeddings_vec_idx;

CREATE INDEX face_embeddings_vec_idx
    ON public.face_embeddings
    USING hnsw (vec vector_cosine_ops)
    WITH (m = 24, ef_construction = 128);

-- ─── 3. Set search ef for the current session (tune per-query if needed) ─────
-- Workers should run: SET hnsw.ef_search = 64; before executing match_face.
-- For now, set the database-level default:
ALTER DATABASE postgres SET hnsw.ef_search = 64;

-- ─── 4. Verification ──────────────────────────────────────────────────────────
-- Run after applying:
-- SELECT proname, pronargs FROM pg_proc WHERE proname = 'match_face';
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'face_embeddings';
