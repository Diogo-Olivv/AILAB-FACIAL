# 0001 — Reconhecimento no servidor, não no tablet

- **Status:** aceito
- **Data:** 2026-06 (registrada retroativamente em 2026-11-11)
- **Decisores:** mantenedor do projeto

## Contexto e problema

O tablet fica na entrada, pode ser roubado e fica fisicamente acessível. Um modelo no tablet exporia o modelo, os limiares e os templates a quem tivesse o aparelho.

## Opções consideradas

1. **Reconhecimento no tablet.** Latência baixa, funciona sem rede. Expõe modelo, limiares e templates; atualizar exige OTA; auditoria fica local.
2. **Reconhecimento no servidor.** Depende de rede e da latência do Cloud Run. Templates e limiares ficam no servidor; auditoria centralizada.

## Decisão

Reconhecimento no servidor. O tablet captura e envia; o servidor decide. Isso mantém os templates fora do dispositivo.

## Consequências

- Positivas: templates nunca saem do servidor; limiares mudam sem OTA; registro centralizado.
- Negativas: depende de rede; cold start do Cloud Run (cerca de 17 s); o tablet não funciona offline.
- Impacto na operação: falha de rede gera "Registro não confirmado" e não há fila hoje (oportunidade em `audit/PRODUCT_OPPORTUNITIES.md`, item 4).

## Como verificar

`POST /api/v1/recognize` é o único caminho de decisão. O app não contém modelo nem templates (F: não há pesos de modelo em `mobile/`).
