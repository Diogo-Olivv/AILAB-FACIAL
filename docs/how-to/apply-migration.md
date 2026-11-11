# Aplicar uma migration

Migrations ficam em `backend/migrations/` com número sequencial. **Nenhuma migration é aplicada pelo deploy.** Aplicação em produção é uma decisão do mantenedor, feita manualmente.

## Antes de criar uma migration

- Verifique o último número em `backend/migrations/`.
- Nomeie no formato `NN_descricao_curta.sql`.
- Escreva idempotente: `IF NOT EXISTS`, `CREATE OR REPLACE`, `REVOKE` seguro de repetir.
- Não reutilize o número de outra migration. Hoje há duas migrations com título parecido (07 e 17, ver `audit/DATABASE_RLS_AUDIT.md`), o que é confuso.

## Validar localmente

```bash
cd backend
python -m pytest tests/test_migration_syntax.py -q        # sintaxe, com o parser do Postgres
REQUIRE_DB_TESTS=1 TEST_DATABASE_URL=postgresql://postgres:test@localhost:5432/postgres \
  python -m pytest tests/test_db_migrations.py -q          # efeito, em Postgres 17
```

**Resultado esperado:** ambos passam, sem `skipped`.

## Aplicar em produção

1. Capture o snapshot antes (ver `audit/PROD_STATE_SNAPSHOT.md`, seção 7). Guarde a saída.
2. Confirme que a migration não depende de nada que ainda não está em produção.
3. Aplique uma migration por vez, pelo SQL Editor do Supabase ou pelo CLI, com aprovação do mantenedor.
4. Capture o snapshot depois e compare.
5. Atualize o registro de migrations apenas para o que foi aplicado de fato.

## O que não fazer

- Não aplique a migration 22 nem a 28 sem antes ler `audit/CODE_DB_DRIFT.md`: elas removem funções e acessos que o estado atual pode estar usando.
- Não edite uma migration já aplicada em produção. Crie uma nova.
