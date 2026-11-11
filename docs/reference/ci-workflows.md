# Referência dos workflows (GitHub Actions)

> Gerada a partir de `.github/workflows/*.yml` em d935499. Reexecutar o gerador após mudar um workflow.
> Todas as ações são fixadas por SHA de commit, com a tag em comentário. Para atualizá-las, use os PRs do Dependabot (`.github/dependabot.yml`).

| Arquivo | Nome | Gatilhos | Permissões no topo | Jobs |
|---|---|---|---|---|
| `actionlint.yml` | actionlint | pull_request master (paths); push master (paths) | contents: read | `actionlint` |
| `ci.yml` | Continuous Integration & Shift-Left Security (CI) | push master/main; pull_request master/main; workflow_dispatch | contents: read | `web-tests`, `mobile-tests`, `backend-tests` |
| `codeql.yml` | CodeQL | push master; pull_request master; schedule 17 5 * * 1 | contents: read | `analyze` |
| `dependency-review.yml` | Dependency review | pull_request master | contents: read | `review` |
| `deploy-backend.yml` | Deploy backend to Cloud Run | push master (paths); workflow_dispatch | contents: read | `test`, `deploy` |
| `deploy-pages.yml` | Deploy web to GitHub Pages | push master; workflow_dispatch | contents: read, pages: write, id-token: write | `deploy` |
| `docs.yml` | Documentação | pull_request master (paths); push master (paths) | contents: read | `markdown`, `links` |
| `nightly-cleanup.yml` | Nightly Maintenance Cleanup | schedule 0 * * * *, 59 2 * * *; workflow_dispatch | {} | `cleanup` |
| `scorecard.yml` | OpenSSF Scorecard | push master; schedule 30 6 * * 1; workflow_dispatch | read-all | `analysis` |
| `secret-scan.yml` | Secret scan | pull_request master | contents: read | `gitleaks` |

## O que cada um garante

| Workflow | Falha se... |
|---|---|
| `ci.yml` | testes do web, `expo-doctor`/`tsc`/testes do mobile, Ruff/Bandit/pytest do backend (com Postgres 17 e `REQUIRE_DB_TESTS=1`) falharem |
| `deploy-backend.yml` | os mesmos testes do backend falharem; só então implanta no Cloud Run. Disparo manual roda só os testes, a menos que `deploy` esteja marcado |
| `deploy-pages.yml` | testes ou build do web falharem; só então publica o site |
| `nightly-cleanup.yml` | a chamada à rota de manutenção falhar |
| `codeql.yml` | o job de análise falhar (alertas não bloqueiam por padrão) |
| `secret-scan.yml` | o gitleaks achar segredo nos commits do PR |
| `dependency-review.yml` | PR introduzir dependência com vulnerabilidade de severidade alta (o job tem `continue-on-error` enquanto o Dependency Graph não estiver ativo) |
| `actionlint.yml` | um workflow tiver erro de sintaxe ou de expressão |
| `docs.yml` | `markdownlint` ou link interno quebrado em arquivos `.md` |
| `scorecard.yml` | a execução falhar (não bloqueia merge) |

## Bloqueio de merge

Se um check **bloqueia o merge** depende da proteção de branch (ruleset) configurada no GitHub, que não é visível pelo repositório. Ver `audit/OSS_GOVERNANCE_AUDIT.md`, seção 4.

## Segredos usados

| Segredo | Usado por | Observação |
|---|---|---|
| `GCP_SA_KEY` | `deploy-backend.yml` | Chave JSON de longa duração; alvo de troca por Workload Identity Federation (`audit/CI_CD_AUDIT.md`, CI-04) |
| `ADMIN_API_KEY` | `nightly-cleanup.yml` | Chave de manutenção; ver `docs/how-to/rotate-secrets.md` |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | `ci.yml`, `deploy-pages.yml` | Embutidos no site publicado; a anon key é pública por desenho |
| `VITE_VIEWER_EMAIL` | `deploy-pages.yml` | Embutido no site publicado; não é segredo |
| `BACKEND_URL` (variável, `vars.BACKEND_URL`) | `nightly-cleanup.yml` | URL base do serviço, sem barra final; não é segredo |
