-- ============================================================
-- Migração: Substituição de índice IVFFlat/BTREE por HNSW cosine
-- Objetivo: busca ANN sub-15ms em tabelas com até 10k vetores de 512 dims
-- Parâmetros HNSW: m=16, ef_construction=64 (padrão pgvector recomendado)
-- Executar via: Supabase Dashboard → SQL Editor (ou psql diretamente)
-- ============================================================

-- Garante que a extensão pgvector está disponível
CREATE EXTENSION IF NOT EXISTS vector;

-- Remove índice antigo se existir (IVFFlat ou qualquer outro no campo vec)
DROP INDEX IF EXISTS face_embeddings_vec_idx;
DROP INDEX IF EXISTS face_embeddings_embedding_idx;

-- Cria índice HNSW com distância cosseno
-- CONCURRENTLY: não bloqueia leituras/escritas durante a construção
-- vector_cosine_ops: operador cosine distance (compatível com os embeddings ArcFace normalizados)
CREATE INDEX CONCURRENTLY IF NOT EXISTS face_embeddings_hnsw_idx
  ON face_embeddings
  USING hnsw (vec vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

COMMENT ON INDEX face_embeddings_hnsw_idx IS
  'HNSW index for cosine ANN search. m=16 ef_construction=64. '
  'Target: <15ms p99 at 10k vectors (ISO/IEC 24745 biometric template). '
  'Created: 2026-09-18.';

-- Ajusta ef_search por sessão para equilibrar qualidade x velocidade
-- (pode ser parametrizado via hnsw_ef_search no config.py)
-- SET hnsw.ef_search = 40;

-- Verifica criação do índice
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'face_embeddings'
  AND indexname = 'face_embeddings_hnsw_idx';
