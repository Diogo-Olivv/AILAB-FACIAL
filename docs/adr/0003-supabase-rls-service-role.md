# 0003 — Acesso por RLS; `service_role` só no backend

- **Status:** aceito
- **Data:** 2026-06 (registrada retroativamente em 2026-11-11)
- **Decisores:** mantenedor do projeto

## Contexto e problema

Clientes (painel e totem) leem dados diretamente pelo Supabase. Sem regra no banco, qualquer cliente com a chave pública leria tudo.

## Opções consideradas

1. **Toda leitura pela API.** Controle total, mas a API vira gargalo e duplica regras.
2. **RLS por papel**, com a API só para operações sensíveis e `service_role` restrita ao backend.

## Decisão

RLS forçada nas tabelas principais; `service_role` apenas no backend; papéis `tutor` e `kiosk` por `app_metadata` (não `user_metadata`, que o cliente edita).

## Consequências

- Positivas: o banco recusa o que a regra não permite, mesmo que a interface falhe.
- Negativas: RLS é difícil de testar (ver `audit/TEST_STRATEGY_AUDIT.md`); políticas antigas com `user_metadata` existiram (migrações 13, 15 e 16) e precisaram de correção.
- Falha observada: grants amplos para `anon` existiam em produção até 2026-11-10 (AF-24, corrigido manualmente).

## Como verificar

Testes de banco (`backend/tests/test_db_migrations.py`) com papéis e claims simulados. Limite: o shim não é o GoTrue real (ver `docs/how-to/run-db-tests.md`).
