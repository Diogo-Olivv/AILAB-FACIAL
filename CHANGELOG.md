# Changelog

Todas as mudanças notáveis deste projeto são registradas aqui.

O formato segue [Keep a Changelog 1.1.0](https://keepachangelog.com/pt-BR/1.1.0/) e o versionamento segue [Semantic Versioning 2.0.0](https://semver.org/lang/pt-BR/). Como o projeto ainda não publicou releases, as entradas são agrupadas por data e pelos PRs mergeados.

## [Unreleased]

### Adicionado

- Arquivos de governança: LICENSE (Apache-2.0), NOTICE, SECURITY, CONTRIBUTING, CODE_OF_CONDUCT, GOVERNANCE, SUPPORT, CODEOWNERS e templates de issue e PR.

### Corrigido

- Painel web: a lotação voltou a ser classificada (Tranquilo, Moderado, Movimentado). O deploy do site passa a definir `VITE_LAB_CAPACITY=20`; sem esse valor o painel mostra "Sem classificação".
- Banco de produção: aplicadas as migrations 22 a 26 (funções de totem, registro de presença e anti-replay no banco, LGPD atômica; remove o login legado). Corrige o erro 503 "serviço de reconhecimento indisponível" ao escanear.
- Backend: imagem e CI instalam de lock com hashes (`--require-hashes`), em Python 3.12 e com a imagem base fixada por digest. A imagem de produção deixa de usar as versões antigas (por exemplo fastapi 0.111 e pillow 10.3). O CI passa a construir a imagem Docker.
- Backend: removidos os tokens mestres compartilhados (AF-01). Tutor e totem passam a ser aceitos apenas com JWT do Supabase Auth. Totens precisam estar ativados por conta própria.

- Teste de regressão do fallback offline do service worker (`web/src/lib/sw_offline.test.ts`), PR #77.
- Migration 15 com sintaxe válida e gate de parse de todas as migrations, PR #76.
- Modo obrigatório de banco de testes no CI com Postgres 17 e pgvector, PR #76.

### Segurança

- Migration 29 revoga escrita do role `anon` nas tabelas biométricas e a execução de `link_tutor_profile` por `anon`, PR #76. Aplicada em produção em 2026-11-10 antes do PR, por decisão do mantenedor.
- Credenciais compartilhadas legadas ainda aceitas pelo backend e pelo app: **pendente** (ver `audit/REMEDIATION_STATUS.md`).

## Histórico anterior

O histórico de commits completo está em `git log`. As entradas acima começam na data de criação deste arquivo.
