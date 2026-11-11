# Mapa do repositório

> Contagens de arquivos rastreados por `git ls-files` em 2026-11-11 (313 arquivos).

| Pasta | Arquivos | Conteúdo |
|---|---|---|
| `backend/` | 83 | API FastAPI, migrations SQL, testes, Dockerfile, scripts |
| `web/` | 72 | Painel dos tutores (React 19, Vite, PWA) |
| `mobile/` | 56 | App do totem (Expo SDK 57, expo-router) |
| `audit/` | 38 | Auditoria de segurança, privacidade, testes e produto |
| `docs/` | 32 | Documentação (Diátaxis, ADRs, privacidade, ML, runbooks) |
| `.github/` | 17 | Workflows, Dependabot, templates, CODEOWNERS |
| raiz | 15 | README (EN e pt-BR), licença, políticas, `AGENTS.md`, `render.yaml` (descontinuado) |

## Backend (`backend/`)

| Caminho | Papel |
|---|---|
| `app/main.py` | Aplicação, middleware, tratamento global de erros, warmup do modelo |
| `app/config.py` | 45 configurações (ver [env-vars](env-vars.md)) |
| `app/deps.py` | Autenticação e autorização por dependência |
| `app/upload_guard.py` | Limite de corpo e checagem de upload antes de ler o formulário |
| `app/routers/` | Rotas: `recognize`, `enroll`, `profiles`, `kiosks`, `maintenance`, `health`, `contracts` |
| `app/services/` | Regras: `face_service`, `liveness_service`, `enroll_service`, `session_service`, `challenge_service`, `replay_guard`, `enrollment_window` |
| `app/db/` | Cliente Supabase e verificação de esquema |
| `migrations/` | Migrations SQL numeradas (01 a 29) |
| `db/test/` | Shim do Supabase e baseline para os testes de banco |
| `tests/` | Testes (pytest) |
| `scripts/` | Obtenção de modelos, auditoria de equidade, simulação de restauração |
| `schema.sql` | Esquema histórico, **descontinuado**: não executar em produção (ver `audit/FINDINGS.md`, N-09) |

## Web (`web/`)

| Caminho | Papel |
|---|---|
| `src/App.tsx` | Rotas (`/login`, `/dashboard`) |
| `src/auth/` | Provedor de autenticação |
| `src/pages/` | `Login`, `Dashboard` |
| `src/components/` | Componentes de tela, modais e gráficos |
| `src/lib/` | Regras sem interface: horas, períodos, CSV, justificativas, fuso, relatórios; os `*.test.ts` ficam aqui |
| `public/sw.js` | Service worker (shell e ativos em cache; API nunca é cacheada) |

## Mobile (`mobile/`)

| Caminho | Papel |
|---|---|
| `app/` | Telas (expo-router): totem, cadastro, atualização de template |
| `components/` | Câmera, painel de reconhecimento, modais de ativação e login de tutor |
| `hooks/` | Reconhecimento, cadastro, presença, perfis |
| `lib/` | API, identidade do totem (`kioskAuth.ts`), sessão do tutor, janela de cadastro, erros, tema |
| `eas.json`, `app.json` | Perfis de build e configuração de OTA |

## Onde mudar o quê

| Quero... | Edite |
|---|---|
| Mudar um limiar de reconhecimento | `backend/app/config.py` e o teste correspondente; ver [docs/ml/model-card.md](../ml/model-card.md) |
| Criar uma regra de banco | Nova migration em `backend/migrations/` (ver [apply-migration](../how-to/apply-migration.md)) |
| Mudar o contrato da API | Rota/schema em `backend/app/routers/`, depois a referência em [api.md](api.md) |
| Mudar uma regra de horas | `web/src/lib/` (hoje no cliente; ver `audit/UX_ACCESSIBILITY_AUDIT.md`, UX-07) |
| Publicar uma atualização no tablet | [build-apk-and-ota](../how-to/build-apk-and-ota.md) |
