# Auditoria do AILAB-FACIAL

Esta pasta guarda a auditoria do sistema de presença por reconhecimento facial: segurança, privacidade, confiabilidade, testes, governança e experiência de uso.

> **Estado desta pasta (2026-11-11, base `master@5f1d99c`).** Os documentos originais são de 2026-09-13 e descrevem um sistema anterior (sem migrations 22–29, sem autenticação por JWT de kiosk, sem replay em banco, sem `upload_guard`). Eles estão marcados como desatualizados. A fonte atual é a lista de "Documentos atuais" abaixo.

## Como ler

1. Comece por `REMEDIATION_STATUS.md`: o que está aberto, o que foi fechado e o que depende do mantenedor.
2. Para entender o sistema, leia `FLOWS.md` e `PROD_STATE_SNAPSHOT.md`.
3. Para achados detalhados, use `FINDINGS.md` (`AF-xx` e `N-xx`).
4. Para áreas específicas, use os documentos temáticos da próxima seção.

## Legenda de evidência

| Marca | Significado |
|---|---|
| **F** | Fato: lido no código, no banco, na API ou em um log, nesta revisão |
| **F\*** | Fato relatado por leitura de agente, **não reconfirmado** |
| **I** | Inferência a partir de fatos |
| **H** | Hipótese: precisa de teste ou medição |
| **NV** | Não verificado |

Afirmações sem marca devem ser tratadas como **F\*** até reconfirmação.

## Documentos atuais (revisados em 2026-11-11)

| Documento | Conteúdo |
|---|---|
| `REMEDIATION_STATUS.md` | Status de cada achado `AF-xx`, com PR, evidência e pendência do dono |
| `FINDINGS.md` | Registro único de achados `AF-xx` e `N-xx`, com severidade e classificação |
| `FLOWS.md` | Catálogo de fluxos com diagramas e caminhos de falha |
| `PROD_STATE_SNAPSHOT.md` | Estado de produção por leitura, com data e hora |
| `CODE_DB_DRIFT.md` | Diferença entre código, banco e registro de migrations, e plano de convergência |
| `TEST_STRATEGY_AUDIT.md` | Inventário de testes, falsos seguros e lacunas priorizadas |
| `CI_CD_AUDIT.md` | Gates de CI e deploy, pinagem, permissões e configurações do GitHub |
| `API_CONTRACT_AUDIT.md` | Contrato publicado, autenticação por rota e proposta contract-first |
| `UX_ACCESSIBILITY_AUDIT.md` | Jornadas, achados de UX e acessibilidade, mapa WCAG 2.2 AA |
| `PRODUCT_OPPORTUNITIES.md` | Oportunidades ranqueadas por valor, confiança e esforço |
| `LGPD_GAP_ANALYSIS.md` | Lacunas frente à LGPD, decisões pendentes do controlador (DP-1 a DP-9) |
| `OSS_GOVERNANCE_AUDIT.md` | Governança de repositório contra boas práticas OSS e Scorecard |
| `DOCUMENTATION_AUDIT.md` | Contradições entre documentação e código |

## Documentos originais (2026-09-13)

Estado de cada um após esta revisão. "Desatualizado" significa que contém afirmações contraditas pelo código atual e não deve ser citado sem reconfirmação.

| Documento | Estado | Substituído por |
|---|---|---|
| `AUDIT_REPORT.md` | Desatualizado | `FINDINGS.md`, `REMEDIATION_STATUS.md` |
| `EXECUTIVE_SUMMARY.md` | Desatualizado | Este README e `REMEDIATION_STATUS.md` |
| `FINDINGS.md` | **Reescrito** | — |
| `TRACEABILITY.md` | Desatualizado | `TEST_STRATEGY_AUDIT.md` |
| `EVIDENCE_MATRIX.md` | Desatualizado | `FINDINGS.md` |
| `DATABASE_RLS_AUDIT.md` | Desatualizado (cita só migrations 05 e 06) | `PROD_STATE_SNAPSHOT.md`, `CODE_DB_DRIFT.md` |
| `STATE_MACHINE.md` | Parcialmente correto | `FLOWS.md`, seção 6 |
| `THREAT_MODEL.md` | Desatualizado | Pendente de reescrita |
| `ATTACK_SURFACE.md` | Desatualizado | `API_CONTRACT_AUDIT.md`, seção 3 |
| `ENDPOINT_AUDIT.md` | Desatualizado (6 endpoints; há 17) | `API_CONTRACT_AUDIT.md`, seção 3 |
| `SECURITY_INVARIANTS.md` | Desatualizado | `FINDINGS.md` |
| `DATA_FLOW.md` | Desatualizado | `FLOWS.md` |
| `SYSTEM_INVENTORY.md` | Desatualizado | `PROD_STATE_SNAPSHOT.md`, `DOCUMENTATION_AUDIT.md` |
| `ASSET_INVENTORY.md` | Desatualizado | Pendente de reescrita |
| `TEVV.md` | Desatualizado (afirma que nenhum teste toca banco real) | `TEST_STRATEGY_AUDIT.md` |
| `RELIABILITY_FMEA.md` | Desatualizado (afirma fallback de RAM, que não existe) | `FINDINGS.md`, `FLOWS.md` seção 13 |
| `SUPPLY_CHAIN.md` | Desatualizado | `CI_CD_AUDIT.md`, `OSS_GOVERNANCE_AUDIT.md` |
| `PRIVACY_DATA_LIFECYCLE.md` | Desatualizado | `LGPD_GAP_ANALYSIS.md` |
| `BIOMETRIC_ASSURANCE.md` | Desatualizado (limiares antigos) | `FLOWS.md` seção 2 e `FINDINGS.md` (N-15) |
| `REMEDIATION_ROADMAP.md` | Superado | `REMEDIATION_STATUS.md` |
| `GITHUB_BACKLOG.md` | Superado | Issues do GitHub |
| `AI_GOVERNANCE.md` | Base válida; revisar | Pendente de revisão |
| `ASSUMPTIONS.md` | Revisar | Pendente de revisão |
| `RISK_ACCEPTANCE.md` | Revisar | `REMEDIATION_STATUS.md` (riscos aceitos: AF-15, AF-16) |
| `UNKNOWN_REGISTER.md` | Revisar | `REMEDIATION_STATUS.md`, seção de pendências |

**Limite honesto:** os 19 documentos marcados como "desatualizado" ou "superado" não foram reescritos nesta revisão. Foram sinalizados com cabeçalho de aviso para que não sejam citados como verdade atual. Reescrevê-los é trabalho do próximo ciclo.

## Política de revisão

- Cada documento tem data de revisão e base (`master@<SHA>`) no cabeçalho.
- Um achado só muda para "Fechado" com PR mergeado e teste verde citado em `REMEDIATION_STATUS.md`.
- Documentos com mais de 90 dias sem revisão são sinalizados no CI (a implementar, `docs.yml`).
- Nenhum documento contém segredo, senha, token, ID de usuário, e-mail de tutor ou dado pessoal de integrante.

## Como reproduzir

Os números e as contagens citados vêm de comandos. Cada documento indica o comando ou a consulta usada. O snapshot de produção é somente leitura e deve ser refeito antes de qualquer decisão de remediação.
