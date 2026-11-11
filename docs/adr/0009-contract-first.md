# 0009 — Contrato de API primeiro

- **Status:** proposto
- **Data:** 2026-11-11
- **Decisores:** a definir

## Contexto e problema

Os tipos do web e do mobile são escritos à mão e já divergem do backend (AF-20, API-04, API-05). Mudanças de contrato não aparecem em revisão de PR, porque o OpenAPI não é versionado.

## Opções consideradas

1. **Status quo**: OpenAPI gerado pelo FastAPI, não versionado, tipos copiados.
2. **Snapshot versionado do OpenAPI** com teste de diferença no CI e tipos gerados para os clientes.
3. **Contrato escrito à mão** como fonte, com o código validado contra ele.

## Decisão proposta

Opção 2: gerar `backend/openapi.json` no repositório, falhar o CI em diferença não revisada, gerar tipos para web e mobile, e manter fixtures de erro compartilhadas.

## Consequências

- Positivas: mudança de contrato vira diff revisável; tipos não divergem.
- Negativas: exige regerar o snapshot a cada mudança; mais um passo no CI.

## Como verificar

O diff do `openapi.json` aparece no PR. O teste de diferença falha se o snapshot não for atualizado.
