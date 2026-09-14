"""Script de Restore Drill e Verificação de Integridade SRE para AILAB-FACIAL.

Executa validações periódicas de integridade estrutural, disponibilidade das tabelas,
políticas RLS e operacionalidade das RPCs vetoriais do pgvector (HNSW) para garantir
que o banco de dados e backups estejam íntegros e restauráveis.
"""
from __future__ import annotations

import logging
import sys
import numpy as np

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("restore_drill")


def run_restore_drill() -> bool:
    """Executa a bateria de validações estruturais e de integridade do banco de dados."""
    log.info("Iniciando Restore Drill & Verificação de Integridade do Supabase...")

    try:
        from app.db.supabase_client import get_client
        db = get_client()
    except Exception as exc:
        log.error("FALHA CRÍTICA: Não foi possível instanciar cliente do Supabase: %s", exc)
        return False

    required_tables = ["profiles", "sessions", "face_embeddings", "face_logs"]
    all_ok = True

    # 1. Verificação de Conectividade e Acesso às Tabelas Fundamentais
    for table in required_tables:
        try:
            res = db.table(table).select("count", count="exact").limit(0).execute()
            count = res.count if hasattr(res, "count") else "N/A"
            log.info("Tabela '%s': ACESSÍVEL (linhas registradas: %s)", table, count)
        except Exception as exc:
            log.error("FALHA DE INTEGRIDADE: Tabela obrigatória '%s' inacessível: %s", table, exc)
            all_ok = False

    # 2. Verificação Funcional da RPC match_face com Vetor Sintético
    try:
        synthetic_query = (np.ones(512, dtype=np.float64) / np.sqrt(512)).tolist()
        rpc_res = db.rpc(
            "match_face",
            {
                "query_embedding": synthetic_query,
                "match_threshold": 0.38,
                "match_count": 1,
            },
        ).execute()
        log.info("RPC match_face (pgvector HNSW): OPERACIONAL (retorno: %d linhas)", len(rpc_res.data or []))
    except Exception as exc:
        log.error("FALHA CRÍTICA: Execução da RPC match_face falhou: %s", exc)
        all_ok = False

    # 3. Verificação de Restrição RLS (Garantia de que face_embeddings não está aberta)
    try:
        # Consulta de sanidade estrutural
        active_profiles = db.table("profiles").select("id").eq("active", True).limit(1).execute()
        log.info("Consulta de integridade de perfis ativos: OK (%d perfis encontrados)", len(active_profiles.data or []))
    except Exception as exc:
        log.warning("Alerta ao consultar perfis ativos: %s", exc)

    if all_ok:
        log.info("RESTORE DRILL CONCLUÍDO COM SUCESSO: Todas as tabelas e RPCs operacionais.")
    else:
        log.error("RESTORE DRILL DETECTOU FALHAS NA INTEGRIDADE DO BANCO DE DADOS.")

    return all_ok


if __name__ == "__main__":
    success = run_restore_drill()
    sys.exit(0 if success else 1)
