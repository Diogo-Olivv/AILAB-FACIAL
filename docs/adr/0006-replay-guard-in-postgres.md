# 0006 — Anti-replay no Postgres

- **Status:** aceito; **não implantado** (tabela `recognition_requests` ausente em produção, F)
- **Data:** 2026-11 (registrada em 2026-11-11)
- **Decisores:** mantenedor do projeto

## Contexto e problema

Um desafio de captura pode ser reutilizado. Uma guarda só em memória se perde em cada reinício e não vale entre instâncias do Cloud Run.

## Opções consideradas

1. **Guarda em memória por processo**: simples, mas não vale entre instâncias nem sobrevive a reinício.
2. **Guarda no Postgres**, com claim, lease, tentativas e fencing de worker, em transação junto com a gravação da presença.

## Decisão

Guarda no Postgres (migração 25). Em produção, o código força a guarda ligada.

## Consequências

- Positivas: resposta idempotente; sem gravação dupla; funciona entre instâncias.
- Negativas: depende do banco; se a guarda estiver indisponível, o reconhecimento falha com 503 (esperado: falha fechada).
- Pendência: a migração 25 não está aplicada em produção; a purga não tem chamador (**N-18**).

## Como verificar

Testes de banco de claim e replay em `test_db_migrations.py`. Teste de configuração de produção ainda não existe (AF-10).
