# 0005 — Conta de kiosk por dispositivo

- **Status:** aceito; **não implantado** (produção tem 0 contas de kiosk, F)
- **Data:** 2026-11 (registrada em 2026-11-11)
- **Decisores:** mantenedor do projeto

## Contexto e problema

Uma credencial compartilhada entre totens não pode ser revogada por dispositivo. Se um tablet for roubado, a única forma de bloquear o acesso dele é trocar a credencial de todos.

## Opções consideradas

1. **Chave compartilhada** (estado atual, AF-04): simples, não revogável por dispositivo, já pública no histórico.
2. **Conta por dispositivo** com JWT de role `kiosk`, criada pelo tutor na ativação: revogável individualmente, com auditoria.

## Decisão

Conta por dispositivo. A ativação é feita pelo tutor, no próprio tablet. A chave compartilhada será removida depois que todos os totens estiverem ativados.

## Consequências

- Positivas: revogação por dispositivo; auditoria de provisionamento.
- Negativas: cada tablet precisa de ativação manual; a revogação tem atraso de cache de até 60 s por processo (**N-22**); a listagem tem teto de 2000 contas.
- Pendência: o tablet do laboratório ainda não recebeu o app com a tela de ativação (pendência do dono).

## Como verificar

`GET /api/v1/kiosks` com token de tutor lista os totens ativos. Hoje a produção retorna zero (F).
