# Status de remediação (AF-xx)

> Revisado em 2026-11-11 · base `master@5f1d99c`
> Esta tabela é a fonte de status. Cada linha exige PR ou commit e evidência. "Fechado" significa verificado, não apenas "tem recomendação".

## Legenda de status

- **Fechado**: correção no `master` e teste verde que a comprova.
- **Parcial**: correção parcial no `master`, ou só o teste de regressão. A vulnerabilidade ou o risco continua.
- **Aberto**: nenhuma correção no `master`.
- **Bloqueado (dono)**: depende de ação do mantenedor fora do repositório. Ver coluna "Pendência do dono".

## Tabela

| ID | Achado | Status | PR / commit | Evidência | Pendência do dono |
|---|---|---|---|---|---|
| AF-01 | Credenciais compartilhadas aceitas por `deps.py` | **Parcial** | #76 (teste em xfail estrito, `backend/tests/test_master_token_rejection.py`) | Teste falha hoje por `DID NOT RAISE` | Provisionar o tablet (kiosk), depois remover o conjunto e o teste xfail |
| AF-02 | Segredos em `eas.json` (raiz e mobile) | **Aberto** | — | `eas.json`, `mobile/eas.json` no histórico público | Rotacionar o valor; decidir sobre reescrita de histórico (não recomendada: o valor já é público) |
| AF-03 | Senhas mestras e sessão forjada no web/mobile | **Aberto** | — | `web/src/auth/AuthProvider.tsx` | Substituir por contas individuais de tutor (T0.2) |
| AF-04 | Fallback de chave no mobile | **Aberto** | — | `mobile/lib/api.ts`, `kioskIdentity.ts` | Ativar o tablet (depende do app no tablet) |
| AF-05 | Migration 15 sintaticamente inválida | **Fechado** | #76 (commit `4c8c820`) | `test_migration_syntax.py` (32 casos verdes no CI) | — |
| AF-06 | Testes de banco pulados no CI | **Fechado** | #76 (`46006af`) | CI com Postgres 17 e `REQUIRE_DB_TESTS=1`: 254 passed, 23 xfailed, 0 skipped | Configurar branch protection para exigir o job (ver `CI_CD_AUDIT.md`) |
| AF-07 | Baseline derivado de produção, não histórico | **Aberto** | — | `backend/db/test/01_baseline_schema.sql` | Decisão sobre baseline histórico (`CODE_DB_DRIFT.md` seção 4) |
| AF-08 | CI e Docker com dependências diferentes | **Aberto** | — | `Dockerfile`, `requirements.lock` sem hashes | Nenhuma (trabalho de repositório) |
| AF-09 | Deploy não depende do CI | **Aberto** | — | `.github/workflows/deploy-backend.yml` | Branch protection e environment com aprovação |
| AF-10 | Caminhos de produção sem teste Python | **Parcial** | #76 (migration 29 e testes de privilégio) | Testes de banco cobrem RLS/privilégios; replay/presença em produção-config ainda sem teste dedicado | — |
| AF-11 | `flash_unable_policy="allow"` | **Aberto** | — | `backend/app/config.py:78` | Decisão de produto: manter `allow` ou usar `reject` |
| AF-12 | Limiares de teste diferentes da produção | **Aberto** | — | `test_biometrics.py:391-392,439-440` | — |
| AF-13 | `hnsw_ef_search` sem efeito | **Aberto** | — | `config.py:56` sem uso | Confirmar `hnsw.ef_search` com `EXPLAIN` |
| AF-14 | Login legado com literal ainda existe em produção | **Aberto** | — | Snapshot seção 2 | Migration 22 em produção, depois de verificação; desativar a conta semeada |
| AF-15 | Challenge não prova origem física | **Aceito (risco)** | — | `challenge_service.py:3-5` | Aceite formal do mantenedor |
| AF-16 | Rate limit por processo | **Aceito (risco)** | — | `recognize.py:57-59` | Verificar `max-instances` no Cloud Run |
| AF-17 | Fallback offline do service worker | **Fechado** | #77 (`0806d3d`) | `web/src/lib/sw_offline.test.ts`: 2 falhas no original, 3 passam no corrigido | — |
| AF-18 | Código morto de sandbox | **Aberto** | — | `web/src/components/AnalysisWorkflow.tsx` sem importadores | — |
| AF-19 | Mobile sem testes | **Aberto** | — | `mobile/package.json` sem runner | — |
| AF-20 | Contrato API sem fixture compartilhada | **Aberto** | — | `API_CONTRACT_AUDIT.md` | — |
| AF-21 | `schema.sql` reintroduz exposição | **Aberto** | — | `backend/schema.sql` | Marcar como histórico |
| AF-22 | Teste de banco pode apagar banco real | **Fechado** | #76 (`46006af`) | Fixture recusa host não local (`test_db_migrations.py`) | — |
| AF-23 | `link_tutor_profile` executável por `anon` | **Fechado em produção; Parcial no repo** | Produção: revogado manualmente em 2026-11-10. Repo: migration 29 em #76 | `test_anon_cannot_execute_link_tutor_profile` | Confirmar na próxima captura do snapshot |
| AF-24 | `anon` com escrita e TRUNCATE nas tabelas biométricas | **Fechado em produção; Parcial no repo** | Produção: revogado em 2026-11-10. Repo: migration 29 em #76 | `test_anon_lacks_write_privileges_on_data_tables` (30 casos) | — |
| AF-25 | `anon` ainda com SELECT em tabelas de perfis e sessões | **Aberto** | — | Snapshot seção 4 | Migration 28 depois de confirmar a tela pública |
| AF-26 | Proteção contra senhas vazadas desativada | **Aberto** | — | Advisor `auth_leaked_password_protection` | Ativar no painel do Supabase (decisão do dono) |
| AF-27 | Auto-Scan do tablet captura sem detectar rosto | **Aberto** | — | `mobile/components/RecognitionPanel.tsx:318-331` | Decisão de produto e implementação (ver `PRODUCT_OPPORTUNITIES.md`) |
| AF-28 | Cliente grava escrita direta quando RPC falha | **Aberto** | — | `web/src/lib/reports.ts` (fallbacks), `compliance.ts:238` | Remover fallbacks e tornar erro visível |
| AF-29 | Avisos disciplinares só em `localStorage` | **Aberto** | — | `web/src/components/TutorWarningModal.tsx:121-414` | Persistir no servidor com auditoria |
| AF-30 | Código de conduta sem canal de denúncia | **Parcial** | #78 (texto); canal pendente | `CODE_OF_CONDUCT.md` | Definir canal de denúncia |

## Pendências do dono (consolidado)

1. **Tablet**: ativar o totem pelo app (precisa de um build com a tela de ativação). Pré-requisito de AF-01 e AF-04.
2. **Contas de tutor individuais** (T0.2): criar uma conta por tutor, com senha única. Pré-requisito de AF-03.
3. **Rotação** da senha colada no chat e do valor de `eas.json` (AF-02).
4. **Decidir a migration 22 e a 28** em produção, depois de teste local.
5. **Branch protection, secret scanning, push protection, Dependabot alerts, relato privado de vulnerabilidade**: diff a ser apresentado antes de aplicar.
6. **Canal de conduta e encarregado (LGPD)**: definir nomes e canais.
7. **Proteção contra senhas vazadas** no Supabase (AF-26).
8. **Decisão sobre `flash_unable_policy`** (AF-11).
