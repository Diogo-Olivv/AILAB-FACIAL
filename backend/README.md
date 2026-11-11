# Backend (FastAPI)

API de reconhecimento facial e de controle de presença. Roda no Cloud Run e usa o Supabase (Postgres 17 com pgvector).

Documentação completa em [../docs/README.md](../docs/README.md). Referências úteis:

- Variáveis de ambiente: [../docs/reference/env-vars.md](../docs/reference/env-vars.md)
- Como rodar os testes de banco: [../docs/how-to/run-db-tests.md](../docs/how-to/run-db-tests.md)
- Como aplicar uma migration: [../docs/how-to/apply-migration.md](../docs/how-to/apply-migration.md)
- Fluxos e caminhos de falha: [../audit/FLOWS.md](../audit/FLOWS.md)

## Comandos

```bash
pip install -r requirements-dev.txt
python -m pytest -q                                  # testes sem banco
REQUIRE_DB_TESTS=1 TEST_DATABASE_URL=postgresql://postgres:test@localhost:5432/postgres \
  python -m pytest tests/test_db_migrations.py -q    # testes de banco
ruff check app/ --select E,F,W,B,S --ignore E501,B008
uvicorn app.main:app --reload --port 8000
```

## Rotas

Lista publicada pelo próprio serviço em `/openapi.json` (17 caminhos em produção, em 2026-11-11). A autenticação por rota está em [../audit/API_CONTRACT_AUDIT.md](../audit/API_CONTRACT_AUDIT.md), seção 3.

## Diretórios

| Pasta | Conteúdo |
|---|---|
| `app/routers/` | Rotas HTTP |
| `app/services/` | Regras: reconhecimento, cadastro, sessões, desafio, replay, PAD |
| `app/deps.py` | Autenticação e autorização por dependência |
| `migrations/` | Migrations SQL, numeradas (01 a 29) |
| `db/test/` | Shim do Supabase e baseline para testes de banco |
| `tests/` | Testes |
| `scripts/` | Obtenção de modelos e auditorias pontuais |

## Dependências travadas

A imagem de produção e o CI instalam de `requirements.lock` e `requirements-dev.lock`, com hash de cada arquivo (`pip install --require-hashes`). As faixas de versão ficam em `requirements.txt` e `requirements-dev.txt`. Depois de mudar uma faixa (ou quando o Dependabot abrir um PR), regere os locks, a partir de `backend/`:

```bash
uv pip compile requirements.txt --python-version 3.12 --python-platform linux --generate-hashes --upgrade -o requirements.lock
uv pip compile requirements-dev.txt --python-version 3.12 --python-platform linux --generate-hashes --upgrade -o requirements-dev.lock
```

A versão do Python do lock é a da imagem (`python:3.12-slim`, fixada por digest no `Dockerfile`).
