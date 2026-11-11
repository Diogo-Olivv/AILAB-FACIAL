# Roadmap

> Revisado em 2026-11-11. Ordem por dependência e risco, não por data. Itens sem data estão sem prazo.
> Detalhamento e justificativa: [audit/PRODUCT_OPPORTUNITIES.md](../audit/PRODUCT_OPPORTUNITIES.md) e [audit/REMEDIATION_STATUS.md](../audit/REMEDIATION_STATUS.md).

## Fase 1 — Segurança e integridade (bloqueia uso em produção)

- Remover a credencial compartilhada do backend e do app, depois de ativar todos os totens (AF-01, AF-04).
- Remover senhas mestras e sessão forjada do painel (AF-03).
- Revogar e substituir a credencial exposta no histórico (AF-02).
- Fechar o fail-open na checagem de duplicidade (N-13).
- Aplicar, em produção e com teste prévio, as migrations que faltam (17 a 29), começando pela 22 (AF-14).
- Gate de CI obrigatório no deploy (CI-01, CI-02).

## Fase 2 — Privacidade operável

- RIPD aprovado pelo controlador (DP-1 a DP-9).
- Canal do titular e encarregado designado (DP-7).
- Revogação e exclusão completas (N-08, N-21).
- Remover nomes e IDs dos logs (N-16).
- Termo de consentimento versionado (LGPD_GAP_ANALYSIS).

## Fase 3 — Qualidade e medição

- Conjunto de dados rotulado, com consentimento, para medir FAR, FRR, APCER e BPCER.
- Testes de configuração de produção para replay e presença (AF-10).
- Testes do mobile (AF-19).
- Remoção do Auto-Scan cego (UX-02, AF-27): detecção facial no dispositivo.

## Fase 4 — Operação e produto

- Gestão de frota de totens (UX-16).
- Fila offline de registro.
- Autoatendimento do integrante.
- Relatórios exportáveis e verificáveis.
- Papéis de acesso (tutor, coordenador, auditor).
- Contrato de API versionado (ADR 0009).

## Fora do roadmap por enquanto

- Reconhecimento no tablet (ADR 0001).
- Múltiplos laboratórios antes da Fase 1 e da Fase 2.
- Controle de catraca ou acesso físico.
