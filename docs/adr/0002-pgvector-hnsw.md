# 0002 — Busca vetorial com pgvector e HNSW

- **Status:** aceito
- **Data:** 2026-06 (registrada retroativamente em 2026-11-11)
- **Decisores:** mantenedor do projeto

## Contexto e problema

Comparar um embedding com todos os templates cadastrados. O número de integrantes de um laboratório é pequeno, mas o sistema pode crescer.

## Opções consideradas

1. **Comparação em memória** no backend: simples, mas exige carregar todos os templates e cresce mal.
2. **pgvector com índice HNSW** no banco: busca aproximada, integrada à RLS e às transações.
3. **Serviço vetorial externo**: mais um operador de dados biométricos.

## Decisão

pgvector com índice HNSW (cosseno), no mesmo banco. Não há serviço vetorial externo, para não multiplicar operadores de dado biométrico.

## Consequências

- Positivas: um operador a menos; consistência transacional com a presença.
- Negativas: a busca aproximada pode perder o vizinho certo (falso negativo), e o parâmetro `hnsw.ef_search` não é aplicado pela aplicação (**N-15**).
- Pendência: o advisor do Supabase marca o índice como não usado (F, `audit/PROD_STATE_SNAPSHOT.md`); confirmar com `EXPLAIN`.

## Como verificar

`EXPLAIN` de `match_face` com dados reais deve mostrar uso do índice. Não feito (NV).
