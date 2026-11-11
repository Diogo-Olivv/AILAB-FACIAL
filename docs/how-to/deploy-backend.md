# Implantar o backend

> **Atenção:** o deploy atual não exige CI verde (**CI-01**). Até o PR 5 ser mergeado, a implantação é um risco. Leia [audit/CI_CD_AUDIT.md](../../audit/CI_CD_AUDIT.md) antes.

## Como funciona hoje

O workflow `.github/workflows/deploy-backend.yml` roda a cada push em `master` que altere `backend/**`. Ele:

1. roda `pytest` com `backend/requirements.txt` em Python 3.12, sem banco (os testes de banco são pulados);
2. se os testes passarem, envia `backend/` ao Cloud Run (serviço `ailab-facial-api`, região `southamerica-east1`) com a chave `GCP_SA_KEY`.

## Antes de mergear uma mudança no backend

1. CI verde no PR, incluindo `backend-tests` com Postgres 17.
2. Se a mudança tiver migration: aplicada e testada localmente primeiro (ver [apply-migration](apply-migration.md), a criar). **Migrations não são aplicadas pelo deploy.**
3. Se a mudança tiver variável nova: definida no Cloud Run antes do deploy.
4. Descrição de rollback no PR.

## Checagem depois do deploy

```bash
curl -s https://<URL-DO-SERVICO>/health
curl -s https://<URL-DO-SERVICO>/health/ready
```

**Resultado esperado:** `{"status":"ok"}` e `{"status":"ready","models_loaded":true}`.

Atenção: `/health/ready` hoje não verifica as RPCs de presença nem a versão de migration (**N-10**). Um `ready` não prova que o banco está completo.

## Se algo der errado

Ver [rollback.md](rollback.md).
