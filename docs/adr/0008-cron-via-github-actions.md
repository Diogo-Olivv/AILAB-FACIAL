# 0008 — Limpeza noturna por GitHub Actions

- **Status:** aceito, com ressalvas
- **Data:** 2026-09 (registrada retroativamente em 2026-11-11)
- **Decisores:** mantenedor do projeto

## Contexto e problema

Sessões esquecidas precisam ser anuladas e logs antigos purgados, todos os dias.

## Opções consideradas

1. **cron-job.org** (uso anterior, documentado no README antigo): serviço externo, sem registro no repositório.
2. **GitHub Actions** (`nightly-cleanup.yml`): versionado, com segredo do GitHub.
3. **pg_cron no banco**: próximo do dado, mas depende de extensão.
4. **Cloud Scheduler**: já previsto no código (OIDC em `deps.py`), não usado pelo workflow.

## Decisão

GitHub Actions, por ser versionado. Ressalvas: é best-effort e pode atrasar; repositórios públicos sem atividade por 60 dias têm o agendamento pausado (F\*).

## Consequências

- Positivas: versionado e auditável.
- Negativas: atraso e pausa; a anulação de sessões que atravessam a meia-noite pode não acontecer no horário certo (**N-19**).
- Pendência: avaliar Cloud Scheduler com OIDC (já previsto em `deps.py`) ou confirmar pg_cron.

## Como verificar

Histórico de execuções do workflow `nightly-cleanup.yml`.
