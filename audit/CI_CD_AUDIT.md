# Auditoria de CI/CD e gates de implantação

> Revisado em 2026-11-11 · base `master@5f1d99c` · fonte: `.github/workflows/*.yml`, `.github/dependabot.yml`, `backend/Dockerfile`, `render.yaml`.
> Legenda: **F** lido no arquivo · **F\*** relatado por leitura de agente · **NV** depende de branch protection ou de configuração do GitHub, não verificável pelo repositório.

## 1. Inventário de workflows

| Arquivo | Gatilho | Jobs | Gate de merge | Gate de deploy | Permissões |
|---|---|---|---|---|---|
| `ci.yml` | push e PR em `master`/`main`; manual | `web-tests`, `mobile-tests`, `backend-tests` (com Postgres 17) | NV (depende de branch protection) | Não é pré-requisito de deploy | Sem bloco `permissions` (F) |
| `deploy-backend.yml` | push em `master` com `paths: backend/**`; manual | `test` (pytest com `requirements.txt`), `deploy` (`needs: [test]`) | — | Só `test` do próprio workflow | `contents: read` por job (F) |
| `deploy-pages.yml` | push em `master`; manual | build e deploy do web | — | Sem gate de CI | Bloco no topo com `pages: write`, `id-token: write` (F) |
| `nightly-cleanup.yml` | cron horário e diário; manual | `cleanup` (curl com `X-Admin-Key`) | — | — | `permissions: {}` (F) |

## 2. Achados

| ID | Sev. | Evidência | Impacto | Correção |
|---|---|---|---|---|
| CI-01 | Alta | `deploy-backend.yml` não depende de `ci.yml`; push em `master` com mudança em `backend/**` dispara deploy mesmo com CI vermelho (F) | Código sem checagem de SAST, sem Postgres e sem contrato vai para produção | `ci.yml` vira `workflow_call`; `deploy` depende dele no mesmo SHA (AF-09) |
| CI-02 | Alta | `deploy-backend.yml` roda `pytest` com `backend/requirements.txt` em Python 3.12, sem Postgres (F); imagem usa `requirements.lock` em Python 3.11 (`Dockerfile:2,18-23`) | Testes validam conjunto diferente do que vai para produção (AF-08) | Testar com o lock e a versão de Python da imagem |
| CI-03 | Alta | Ações por tag móvel: `actions/checkout@v7`, `setup-node@v7`, `setup-python@v7`, `google-github-actions/auth@v3`, `deploy-cloudrun@v3` (F) | Uma tag movida muda o código que roda com o token de GCP | Pinar por SHA com comentário da tag |
| CI-04 | Alta | `google-github-actions/auth` usa `GCP_SA_KEY`, chave JSON de longa duração (F) | Vazamento da chave dá acesso de deploy | Workload Identity Federation (decisão do dono) |
| CI-05 | Média | `ci.yml` sem bloco `permissions` (F) | Token com escopo padrão do repositório | `permissions: contents: read` no topo, com escalonamento por job |
| CI-06 | Média | `deploy-backend.yml` sem `environment` (F) | Deploy sem aprovação humana | Environment `production` com revisor |
| CI-07 | Média | `concurrency` com `cancel-in-progress: true` em deploy (F\*) | Cancelar um deploy no meio pode deixar revisão do Cloud Run inconsistente | Não cancelar deploy em andamento |
| CI-08 | Média | `npm ci --legacy-peer-deps` em `ci.yml`; `npm ci` sem a flag em `deploy-pages.yml` (F\*) | Um build passa e o outro falha com o mesmo código | Padronizar a flag e documentar a razão |
| CI-09 | Média | `ruff` e `bandit` só em `app/` (F); sem `scripts/` nem `tests/` | Código de scripts de produção sem SAST | Ampliar o escopo |
| CI-10 | Média | Ausentes: CodeQL, gitleaks, `pip-audit`, `npm audit`, Trivy na imagem, SBOM, atestação, `actionlint`, Scorecard (F\*, pela ausência de arquivos) | Riscos de cadeia de suprimentos não cobertos | Adicionar em PR 4 |
| CI-11 | Média | Dependabot sem entrada `docker`; mobile ignora React, react-native e TypeScript (F) | Atualizações de segurança da imagem base e de dependências nativas não chegam | Adicionar `docker`; avaliar o ignore |
| CI-12 | Baixa | `render.yaml` com `API_KEY` obsoleta e sem `ENVIRONMENT`, `CHALLENGE_SECRET`, `BIOHASHING_SEED` (F) | Configuração de produção incompleta se o serviço for recriado | Atualizar ou marcar como descontinuado |
| CI-13 | Baixa | Sem `HEALTHCHECK` no Dockerfile e sem `.dockerignore` (F\*) | Imagem maior e sem sonda própria | Adicionar |
| CI-14 | Baixa | `pytest` está em `requirements.txt`, que vai para a imagem (F) | Dependência de teste em produção | Mover para `requirements-dev.txt` (já existe para testes) |
| CI-15 | Baixa | `nightly-cleanup.yml` sem `concurrency` (F) | Execuções sobrepostas | Adicionar grupo de concorrência |

## 3. Branch protection e ambiente (NV)

Não verificável com o token disponível (F\*: `gh api branches/master/protection` → 404; `rulesets` → vazio; environment `master` sem regras). Confirmar com token de administrador.

Estado-alvo: ruleset em `master` exigindo os checks `web-tests`, `mobile-tests`, `backend-tests`, PR com aprovação, sem force-push, e environment `production` com revisor para o deploy.

## 4. Evidência do CI atual

- Run verde do commit `4c8c820` (PR #76): **221 passed, 23 xfailed, 0 skipped** no backend (F, log do GitHub Actions).
- Run mais recente verificado nesta revisão, do branch do PR #76: **254 passed, 23 xfailed, 0 skipped** (F, log do GitHub Actions). O SHA exato desse run não foi anotado; confirmar antes de citar em PR.
- Os 41 testes de banco rodam no CI desde o PR #76, com Postgres 17 e pgvector (F).

## 5. Sequência para endurecer (PRs 4 e 5)

1. **PR 4 (novo, não mexe no deploy):** `codeql.yml`, `secret-scan.yml` (gitleaks), `dependency-review.yml`, `container-scan.yml` (Trivy), `sbom-provenance.yml`, `actionlint.yml`, `scorecard.yml`.
2. **PR 5 (mexe no deploy, revisão cuidadosa):** pinagem por SHA; `permissions` no topo de `ci.yml`; `ci.yml` vira `workflow_call`; deploy com `needs` no mesmo SHA; environment com revisor; imagem construída a partir do lock; Dependabot com `docker`.
3. **Após o PR 5:** Workload Identity Federation (decisão do dono, CI-04).

Cada passo com rollback: reverter o commit restaura o gatilho anterior. Antes de mergear PR 5, testar o deploy em branch de homologação, se houver.
