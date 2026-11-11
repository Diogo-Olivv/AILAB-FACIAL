# 0004 — Cloud Run em vez de Render

- **Status:** aceito
- **Data:** 2026-09 (registrada retroativamente em 2026-11-11)
- **Decisores:** mantenedor do projeto

## Contexto e problema

O backend precisa de memória suficiente para InsightFace e ONNX. A primeira hospedagem (Render, plano gratuito) teve falta de memória, segundo `ARQUITETURA.md` (F\*, não reconfirmado).

## Opções consideradas

1. **Render** (plano gratuito): simples, mas com memória limitada e com a instância dormindo.
2. **Cloud Run** em `southamerica-east1`: mais memória, cobrança por uso, cold start.

## Decisão

Cloud Run. `render.yaml` permanece no repositório como legado.

## Consequências

- Positivas: memória suficiente; região no Brasil.
- Negativas: cold start de cerca de 17 s; custo variável; mais configuração (secrets, IAM).
- Pendência: `render.yaml` ainda lista variáveis obsoletas e não define `ENVIRONMENT` (**N-11**). Marcar como descontinuado.

## Como verificar

`deploy-backend.yml` aponta para o Cloud Run. `curl` em `/health/ready` no serviço.
