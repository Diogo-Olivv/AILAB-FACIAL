# Primeira execução local

Este tutorial sobe o backend, roda os testes e abre o painel web no seu computador. Leva cerca de 30 minutos na primeira vez.

## Antes de começar

Você precisa de:

- Python 3.11 ou 3.12;
- Node.js 22;
- Git;
- Docker (para o Postgres de teste) — opcional nesta etapa, obrigatório para os testes de banco.

Você **não** precisa de acesso à produção. Este tutorial usa apenas dados locais.

## Passo 1 — Clonar e entrar no repositório

```bash
git clone https://github.com/Diogo-Olivv/AILAB-FACIAL.git
cd AILAB-FACIAL
```

**Resultado esperado:** a pasta contém `backend/`, `web/`, `mobile/`, `audit/` e `docs/`.

## Passo 2 — Preparar o backend

```bash
cd backend
python -m venv .venv
. .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
```

**Resultado esperado:** a instalação termina sem erro. Se `insightface` ou `onnxruntime` falhar, verifique a versão do Python.

## Passo 3 — Rodar os testes que não precisam de banco

```bash
python -m pytest -q
```

**Resultado esperado:** algo como `181 passed, 73 skipped, 23 xfailed`. Os testes pulados são os de banco. Os `xfailed` são falhas conhecidas que provam vulnerabilidades ainda abertas (**AF-01**).

Se aparecer `failed`, pare e registre a saída antes de continuar.

## Passo 4 — Preparar o painel web

```bash
cd ../web
npm ci --legacy-peer-deps
npm run test
```

**Resultado esperado:** `61` testes passando, `fail 0`.

Para rodar o painel no navegador, crie `web/.env.local` com as variáveis do `.env.example` que você tiver. Sem um projeto Supabase de teste, o login não funciona: isso é esperado neste tutorial.

## Passo 5 — Conferir o que você acabou de rodar

Você rodou testes unitários e de regras de negócio. Você **não** validou:

- o reconhecimento facial com imagens reais (não há dataset no repositório);
- os testes de banco (precisam de Postgres — ver [how-to/run-db-tests.md](../how-to/run-db-tests.md));
- o app do tablet (não há testes do mobile, **AF-19**).

## Próximos passos

- Para entender o sistema: [explanation/architecture.md](../explanation/architecture.md).
- Para rodar os testes de banco: [how-to/run-db-tests.md](../how-to/run-db-tests.md).
- Para entender a segurança e a privacidade antes de cadastrar qualquer pessoa: [explanation/security-model.md](../explanation/security-model.md) e [privacy/RIPD-template.md](../privacy/RIPD-template.md).
