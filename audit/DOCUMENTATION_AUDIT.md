# Auditoria de documentação

> Revisado em 2026-11-11 · base `master@5f1d99c` · cada contradição foi conferida no sistema de arquivos ou no código nesta revisão (F), salvo quando marcada F\*.

## 1. Inventário

| Documento | Propósito | Situação |
|---|---|---|
| `README.md` | Visão geral, execução local, deploy | **Desatualizado** (ver seção 2) |
| `ARQUITETURA.md` | Arquitetura, modelo no Docker, Cloud Run | **Desatualizado**: descreve `X-API-Key`, Dockerfile antigo, limiar 0,55 |
| `backend/README.md` | Resumo da API | **Desatualizado**: três endpoints de cerca de 18 (F\*) |
| `web/README.md` | Notas do web | Não lido (NV) |
| `audit/` (25 arquivos) | Auditoria de segurança | Ver `audit/README.md` (status por arquivo) |
| `mobile/AGENTS.md`, `mobile/CLAUDE.md` | Instruções para agentes de IA (Expo) | Modelo do Expo; `AGENTS.md` manda ler docs versionadas do Expo 57 (F) |
| `docs/` | Documentação estruturada (Diátaxis) | **Não existia**; criada em PR 3 |
| `CHANGELOG.md`, `CONTRIBUTING.md`, `SECURITY.md`, `GOVERNANCE.md`, `SUPPORT.md`, `CODE_OF_CONDUCT.md`, `LICENSE`, `NOTICE` | Governança | **Criados** (PR #78) |

## 2. Contradições entre documentação e realidade

| ID | Documento | O que diz | Realidade | Evidência |
|---|---|---|---|---|
| DOC-01 | README | Pastas `supabase/`, `pwa/`, `python/`, `enrollment/` | Nenhuma existe; o schema está em `backend/schema.sql` e as migrations em `backend/migrations/` | F: `ls` na raiz |
| DOC-02 | README | `POST /recognize` | Caminho real é `POST /api/v1/recognize` | F: `backend/app/routers/recognize.py` |
| DOC-03 | README | Web usa `VITE_OWNER_EMAIL`, `VITE_API_BASE_URL`, `VITE_API_KEY` | `web/.env.example` define `VITE_VIEWER_EMAIL`, `VITE_LAB_CAPACITY` e as chaves do Supabase | F |
| DOC-04 | README | Mobile usa `EXPO_PUBLIC_API_KEY` | O código lê `EXPO_PUBLIC_KIOSK_KEY` (`mobile/lib/api.ts:70`) e o exemplo não tem nenhum dos dois | F |
| DOC-05 | README | Sweep diário por `X-API-Key` em `/sessions/close-stale` | Rota exige admin ou scheduler; o job real é `nightly-cleanup.yml` com `X-Admin-Key` | F: `recognize.py:348`, `deps.py:228` |
| DOC-06 | README e `render.yaml` | URL do Cloud Run `ailab-facial-api-qpzev7qaoq-rj.a.run.app` | `mobile/eas.json` usa `ailab-facial-api-948162587922.southamerica-east1.run.app`. Duas URLs para o mesmo serviço (F) | F |
| DOC-07 | `.env.example` do backend | `FACE_THRESHOLD=0.80`, `FACE_MIN_COSINE=0.68`, `LIVENESS_MIN_SCORE=0.60` | Padrões do código: 0,87, 0,62 e 0,45 (`config.py:16-17,20`). Valor copiado do exemplo rejeitaria quase todos (**N-15**) | F |
| DOC-08 | `.env.example` do backend | Lista `API_KEY` e `MAX_SESSION_CAP_HOURS` | `API_KEY` não é mais lida pelo código de autenticação; `KIOSK_API_KEY` e `ADMIN_API_KEY` não estão no exemplo | F\* |
| DOC-09 | `render.yaml` | Comentário de `FACE_THRESHOLD` diz "0.87 ↔ cos ≥ 0.62" | Equivalência aproximada (**N-15**); render está obsoleto (ARQUITETURA diz que foi abandonado) | F |
| DOC-10 | ARQUITETURA | Dockerfile com `/app/.insightface`, `det_size=(320, 320)` | Dockerfile real é multi-stage, usa `/build/.insightface` e `download_models.py` (F\*) | F\* |
| DOC-11 | ARQUITETURA | Validação de imagem "5 MB, JPEG/PNG/WEBP" com `validate_image` | Substituída por `upload_guard.py` para o corpo e `validate_image` por frame | F\* |
| DOC-12 | ARQUITETURA | "Nunca no git" para segredos | `eas.json` com chave de totem está no histórico (**AF-02**) | F |
| DOC-13 | README | Lista de endpoints e autenticação `X-API-Key` | Autenticação atual: JWT de tutor ou kiosk, `X-Admin-Key` para manutenção | F\* |
| DOC-14 | README | "Nenhum cliente autenticado lê a biometria" | Confirmado em produção: `authenticated` tem o grant de SELECT em `face_embeddings`, mas as únicas policies da tabela são `service_role_all_embeddings` e `tutor_delete_face_embeddings`; sem policy de SELECT, a RLS nega a leitura. Frágil: qualquer policy futura de SELECT abriria a biometria. Recomendado revogar o grant (SELECT, INSERT, UPDATE) de `authenticated` em `face_embeddings` | F (snapshot seção 4) |
| DOC-15 | AUDIT_REPORT | "79 testes no backend, 5 no frontend" | 180 definições e 61 casos web (F, contagem desta revisão) | F |
| DOC-16 | AUDIT_REPORT | Limiares 0,68/0,62 | Padrões de código 0,62/0,55 (F) | F |
| DOC-17 | `.github/` | Dependabot cobre actions e pip | Cobre; falta `docker` (F) | F |

## 3. Problemas de estrutura

- Os documentos se contradizem entre si (README versus ARQUITETURA versus `.env.example`), porque cada um foi escrito em um momento diferente e nenhum tem data de revisão ou dono.
- Não há índice de documentação: quem entra no repositório não sabe o que é atual.
- `audit/` tem 25 arquivos com estados diferentes, sem status declarado.
- Sem glossário de termos (checagem de vivacidade, PAD, FIQA, BioHash, sessão anulada, janela de cadastro).

## 4. Mapeamento para o modelo Diátaxis

| Tipo | Hoje | Proposto (PR 3) |
|---|---|---|
| Tutoriais (aprender fazendo) | Ausente | `docs/tutorials/first-run-local.md`, `docs/tutorials/first-enrollment.md` |
| How-to (resolver uma tarefa) | Parcial, no README (deploy, APK) | `docs/how-to/` (deploy, rollback, rotação, provisionar totem, aplicar migration, rodar testes de banco) |
| Referência (consulta) | Ausente; env e rotas espalhadas | `docs/reference/` (variáveis, API, erros, banco, RPCs, limiares, workflows) |
| Explicação (entender) | ARQUITETURA parcial | `docs/explanation/` (arquitetura C4, fluxos, segurança, biometria, privacidade) |

Decisões de arquitetura: `docs/adr/` (MADR), com os nove registros já listados em `audit/`.

## 5. Ações

1. Corrigir DOC-01 a DOC-09 nos READMEs e no `.env.example` (PR 3). Não há mudança de comportamento.
2. Marcar `ARQUITETURA.md` como "em reescrita" até o PR 3 substituir o conteúdo por `docs/explanation/architecture-c4.md`.
3. Gerar a lista de variáveis de ambiente a partir de `backend/app/config.py` (45 configurações, F) por script, para não voltar a divergir.
4. Adicionar verificação de referências `arquivo:linha` e de links no CI (`docs.yml`, PR 4).
