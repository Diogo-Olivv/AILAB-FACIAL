# Rodar os testes de banco

Os testes de banco (`backend/tests/test_db_migrations.py`) exigem um Postgres 17 com pgvector. Eles são pulados quando o banco não está disponível, a menos que `REQUIRE_DB_TESTS=1`, que transforma a ausência em falha.

## Pré-requisitos

- Docker, ou um Postgres 17 instalado com a extensão `vector`.
- Python com `requirements-dev.txt` instalado.

## Passo 1 — Subir o banco de teste

```bash
docker run -d --name ailab-pg-test \
  -e POSTGRES_PASSWORD=test \
  -p 5432:5432 \
  pgvector/pgvector:pg17
```

**Resultado esperado:** `docker ps` mostra o contêiner `ailab-pg-test` em execução.

## Passo 2 — Apontar os testes para o banco

```bash
export TEST_DATABASE_URL=postgresql://postgres:test@localhost:5432/postgres
export REQUIRE_DB_TESTS=1
```

A fixture recusa qualquer host que não seja `localhost`, `127.0.0.1` ou `::1`, porque ela faz `DROP SCHEMA` (**AF-22**). Não aponte para um banco real.

## Passo 3 — Rodar

```bash
cd backend
python -m pytest tests/test_db_migrations.py tests/test_migration_syntax.py -q
```

**Resultado esperado:** todos os testes passam ou estão em `xfail`. Nenhum `skipped`.

## Se algo falhar

- `Postgres de teste indisponível com REQUIRE_DB_TESTS=1`: o contêiner não está rodando ou a porta está ocupada.
- `TEST_DATABASE_URL aponta para host não local`: a URL aponta para um host remoto. Corrija a variável.
- `extension "vector" does not exist`: a imagem não é `pgvector/pgvector`. Use a imagem certa.

## Limitações

O banco de teste é um shim do Supabase (`backend/db/test/00_supabase_shim.sql`): tem os mesmos papéis e as mesmas claims, mas não tem GoTrue nem PostgREST. Testes de JWT real precisam de Supabase local (PR de banco, a criar).
