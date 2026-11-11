# Governança de repositório: avaliação contra boas práticas OSS

> Revisado em 2026-11-11 · base `master@5f1d99c` · referências: OpenSSF Scorecard (checks atuais), GitHub Community Standards, OpenSSF Best Practices.
> Legenda: **F** verificado no repositório · **F\*** relatado por API ou leitura de agente · **NV** precisa de token de administrador ou de execução do Scorecard.
> **Nota do Scorecard:** não foi executada nesta revisão (NV). A nota será registrada aqui após a execução local com token.

## 1. Community Standards (GitHub)

| Item | Estado | Evidência | Após o PR de governança |
|---|---|---|---|
| Descrição do repositório | Ausente | F\* (API) | A definir (ação no GitHub, ver seção 4) |
| Tópicos | Ausentes | F\* | A definir |
| README | Presente, desatualizado | F: `README.md` | Reescrito em PR de documentação |
| LICENSE | Ausente na raiz; `mobile/LICENSE` é template MIT de terceiros | F | **Adicionado: Apache-2.0** (PR #78) |
| Código de conduta | Ausente | F | **Adicionado: Contributor Covenant 2.1** (PR #78); canal de denúncia pendente |
| Contribuição | Ausente | F | **Adicionado** (PR #78) |
| Política de segurança | Ausente | F | **Adicionado** (PR #78); relato privado a habilitar |
| Templates de issue | Ausentes | F | **Adicionados** (PR #78) |
| Template de PR | Ausente | F | **Adicionado** (PR #78) |
| CODEOWNERS | Ausente | F | **Adicionado** (PR #78) |
| Suporte | Ausente | F | **Adicionado** (PR #78) |
| Changelog | Ausente | F | **Adicionado** (PR #78); histórico anterior não reconstruído |
| Releases e tags | 0 tags e 0 releases | F\* | Política de versão em `GOVERNANCE.md`; primeira tag após DP e pendências críticas |
| Discussões | Não avaliado | NV | — |

Community health estimado pela API antes da mudança: **14%** (F\*). Recalcular após o merge.

## 2. OpenSSF Scorecard (checks principais)

Avaliação por leitura dos workflows e da configuração. Não é a nota oficial.

| Check | Risco | Estado | Evidência | Ação |
|---|---|---|---|---|
| Binary-Artifacts | Alto | Parcial | `qr_apk.png`, `qr_expo_page.png` rastreados (imagens, não binários executáveis); histórico com shards de modelo de 4 MB e 2 MB (F\*) | Remover da raiz; avaliar histórico |
| Branch-Protection | Alto | **Desconhecido** (token sem admin) | `gh api branches/master/protection` retornou 404 (F\*) | Configurar ruleset (ver seção 4) |
| Code-Review | Alto | Desconhecido | Não é possível ver aprovações (F\*) | Exigir revisão no ruleset |
| Dangerous-Workflow | Crítico | Bom | Sem `pull_request_target`; `nightly-cleanup.yml` com `permissions: {}` (F) | Manter |
| Dependency-Update-Tool | Alto | Parcial | Dependabot para npm (web e mobile), pip e actions (F: `.github/dependabot.yml`); **sem docker**; alertas desativados (F\*, 403) | Adicionar docker; ativar alertas |
| Maintained | Alto | Baixo | Repositório criado em 2026-06-16; 3 contribuidores (F\*) | Ritmo e donos documentados em `GOVERNANCE.md` |
| Pinned-Dependencies | Médio | **Ruim** | Ações por tag móvel, nenhuma por SHA (F); Dockerfile com imagem base sem digest (F\*) | Pinar por SHA (PR de endurecimento) |
| Security-Policy | Médio | **Adicionado** | `SECURITY.md` (PR #78) | — |
| Signed-Releases | Alto | Ausente | Sem releases (F\*) | Assinatura e atestação ao publicar release (`sbom-provenance.yml` a criar) |
| Token-Permissions | Alto | Parcial | `deploy-backend.yml` com `contents: read` por job (F); `ci.yml` sem bloco `permissions` (F) | `permissions: contents: read` no topo do `ci.yml` |
| Fuzzing | Médio | Ausente | — | Avaliar para parser de imagem (`upload_guard`) |
| SAST | Médio | Parcial | Ruff e Bandit em `app/` (F); CodeQL ausente (F\*) | Adicionar CodeQL (`codeql.yml` a criar) |
| License | Baixo | **Adicionado** | Apache-2.0 (PR #78) | — |
| CII-Best-Practices | Baixo | Não iniciado | — | Avaliar após estabilizar |
| Contributors | Baixo | Baixo | Dois autores principais (F\*) | Documentar mantenedores em `GOVERNANCE.md` |

## 3. Práticas de qualidade do repositório

| Prática | Estado | Ação |
|---|---|---|
| Padrão de commits | Majoritariamente Conventional Commits (F\*: cerca de 227 de 256); não imposto | Validar título de PR no CI (`CONTRIBUTING.md` já descreve) |
| `.editorconfig` | Ausente | Criar |
| `.gitattributes` | Ausente; avisos de CRLF em todo commit (F) | Criar com `* text=auto eol=lf` |
| `.mailmap` | Ausente; mesmo autor com identidades diferentes (F\*) | Criar com as identidades reconhecidas pelo mantenedor |
| Pre-commit | Ausente | `.pre-commit-config.yaml` (ruff, gitleaks, verificação de arquivo grande) |
| Ruff e formatação | Ruff só em `app/` no CI; sem config (F) | `pyproject.toml` com regras e formato |
| ESLint e Prettier para web e mobile | Ausente (F\*) | Avaliar no PR de qualidade |
| Lockfiles | `package-lock.json` presentes (F\*); `requirements.lock` sem hashes (F) | Gerar lock com hashes (AF-08) |
| Arquivos indevidos na raiz | `qr_*.png`, `requirements.txt` (obsoleto), `eas.json` duplicado, `render.yaml` (F) | Limpeza no PR 6 |
| `.gitignore` | Sem `.env.*`, `*.pem`, `*.key`, `*.apk`, caches (F) | Completar |

## 4. Configurações do GitHub a aplicar (exigem aprovação)

Nenhuma destas foi aplicada. Cada uma exige ok explícito do mantenedor, com o diff apresentado antes.

| Configuração | Efeito | Risco de aplicar | Ordem |
|---|---|---|---|
| Ruleset em `master`: PR obrigatório, checks obrigatórios (web, mobile, backend), sem force-push, sem exclusão | Bloqueia push direto e merge sem CI | Bloquear o próprio fluxo se um check estiver errado | 1 |
| Aprovação obrigatória de revisor (1 aprovação) | Revisão de terceiros | Com um mantenedor, o autor não aprova o próprio PR; avaliar exceção | 2 |
| Secret scanning e push protection | Bloqueia commit com segredo conhecido | Baixo | 3 |
| Dependabot alerts e security updates | Alertas e PRs de correção | Baixo | 4 |
| Relato privado de vulnerabilidade | Habilita o canal citado em `SECURITY.md` | Baixo | 5 |
| Descrição e tópicos | Descoberta | Nenhum | 6 |
| Environment `master` com aprovação para deploy | Deploy só com aprovação | Atrasa deploy | 7 |

Requisito: token de administrador para verificar tudo isso. Sem ele, o estado desta tabela é desconhecido (NV).

## 5. Metas

| Meta | Prazo sugerido | Evidência de conclusão |
|---|---|---|
| Community health ≥ 80% | Após o PR 1 | Relatório da API |
| Scorecard ≥ 7 | Após PRs 4 e 5 | Execução local registrada aqui |
| Todas as ações pinadas por SHA | PR 5 | `actionlint` e grep no workflow |
| Primeira release com changelog e SBOM | Após pendências críticas | Tag, release e atestação |
