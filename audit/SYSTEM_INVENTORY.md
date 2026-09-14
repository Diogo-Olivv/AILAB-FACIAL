# AILAB-FACIAL V4 — INVENTÁRIO COMPLETO DO SISTEMA

**Data:** 13 de Setembro de 2026  
**Auditoria:** AILAB-FACIAL V4  
**Status:** AUDITED  

---

## 1. Visão Geral da Pilha Tecnológica

| Camada | Tecnologias Principais | Versões Declaradas / Detectadas | Responsabilidade Primária |
|---|---|---|---|
| **Backend** | Python, FastAPI, Uvicorn, Pydantic, Starlette | Python 3.11/3.12, FastAPI 0.111+, Pydantic v2 | API REST, orquestração de biometria, autenticação e regras de sessão. |
| **Visão Computacional** | InsightFace, SCRFD, ArcFace (buffalo_s), OpenCV, PIL | InsightFace 0.7+, onnxruntime 1.17+, NumPy 1.26+ | Detecção facial, alinhamento, extração de embeddings 512-D normalizados L2. |
| **Liveness / PAD** | MiniFASNetV2 ONNX, SciPy (Laplacian), NumPy (LBP, FFT) | MiniFASNetV2 (80x80), SciPy 1.18+ | Detecção de vivacidade passiva contra ataques 2D (telas, papel impresso). |
| **Banco de Dados** | PostgreSQL, Supabase, pgvector, PostgREST | PostgreSQL 15+, pgvector 0.7+, PostgREST 12+ | Armazenamento de perfis, vetores vetoriais 512-D, sessões e logs faciais com RLS. |
| **Frontend Web** | React, Vite, TypeScript, Tailwind CSS | React 18.3, Vite 5.4, TypeScript 5.5 | Dashboard administrativo para tutores (visualização de presença e horas). |
| **Frontend Mobile** | React Native, Expo, Expo Camera, Expo Router | Expo 57.0 (SDK 52/53 equiv), React 19.2, TypeScript 6.0 | Kiosk para tablet Android na entrada do laboratório (captura e batimento de ponto). |
| **Infraestrutura / Cloud**| Google Cloud Run, Docker, GitHub Actions, EAS Build | Linux Debian Slim, Docker multi-stage | Execução serverless do backend com auto-scaling até 0 (scale-to-zero). |

---

## 2. Inventário de Componentes de Código

### 2.1 Backend (`backend/app/`)
- **`app/main.py`**: Ponto de entrada FastAPI, ciclo de vida (`lifespan`), validação de integridade de schema no boot (`validate_schema()`), warmup de modelos assíncrono em thread pool, middleware CORS restrito com fail-closed, e exception handler global para supressão de tracebacks e vazamento de infraestrutura.
- **`app/config.py`**: Configuração central via `pydantic_settings.BaseSettings`, lendo variáveis de ambiente com suporte a `.env`. Declara limiares biométricos calibrados (`face_threshold=0.80`, `face_min_cosine=0.68`, `face_uncertain_cosine=0.62`), parâmetros de qualidade FIQA (`min_laplacian_var=30.0`, `min_face_size=40`), tempos de debounce e credenciais de serviço.
- **`app/deps.py`**: Camada de dependências e autenticação:
  - `verify_kiosk_key`: Validação timing-safe da chave de inferência do tablet (`X-Kiosk-Key` com fallback legado para `X-API-Key`).
  - `verify_tutor_token`: Validação do JWT Supabase Auth com checagem estrita de privilégio em `app_metadata.role == 'tutor'`.
  - `verify_cron_or_api_key`: Validação de tokens OIDC da Service Account do Google Cloud Scheduler com fallback timing-safe para `API_KEY`.
  - `validate_image`: Validação estrita de Content-Type (`image/jpeg`, `image/png`, `image/webp`) e tamanho de payload (máximo 5 MB).
- **`app/routers/`**:
  - `health.py`: Endpoints de liveness (`GET /health`) e readiness probe (`GET /health/ready`), verificando o carregamento dos pesos ONNX em memória RAM.
  - `recognize.py`: Rota central de reconhecimento facial multi-frame (`POST /api/v1/recognize`), consulta de sessões ativas (`GET /api/v1/sessions/open`), encerramento de saídas esquecidas (`POST /api/v1/sessions/close-stale`) e estatísticas individuais (`GET /api/v1/sessions/stats/{profile_id}`).
  - `enroll.py`: Rota de cadastro biométrico (`POST /api/v1/enroll`), exigindo consentimento LGPD explícito, validação intra-burst de no mínimo 3 fotos consistentes e checagem anti-duplicidade 1:N.
  - `profiles.py`: Endpoints de direitos do titular LGPD: consulta de metadados (`GET /api/v1/profiles/{id}`), renovação biométrica (`POST /api/v1/profiles/{id}/refresh-embedding`), revogação de consentimento (`POST /api/v1/profiles/{id}/revoke-consent`) e eliminação definitiva de dados com expurgo de embeddings (`DELETE /api/v1/profiles/{id}`).
  - `maintenance.py`: Endpoint de rotina periódica (`POST /api/v1/maintenance/cleanup`), responsável pelo sweep de sessões órfãs e invalidação do cache em memória.
- **`app/services/`**:
  - `face_service.py`: Inicialização preguiçosa e thread-safe do `FaceAnalysis`, seleção heurística da face principal (área e proximidade ao centro), avaliação de qualidade FIQA, extração de embedding normalizado L2, busca vetorial acelerada via RPC `match_face` (pgvector HNSW) com fallback para matriz NumPy em memória (cache TTL de 180s), calibração sigmoidal de confiança (Platt Scaling) e processamento em lote multi-frame.
  - `liveness_service.py`: Avaliação de qualidade via variância laplaciana (descarte de motion blur), inferência do modelo ONNX MiniFASNetV2 contra spoofing 2D (crop 2.7x) e pipeline secundário estatístico de contingência (micro-textura LBP, espectro de frequência 2D FFT contra moiré e dispersão cromática YCrCb contra telas/papel fosco).
  - `enroll_service.py`: Orquestração de cadastro de integrantes, cálculo da média vetorial normalizada, verificação de consistência par a par ($dist \le 0.70$), garantia contra sobrescrita indevida de biometria de terceiros (`_guard_against_identity_swap`) e persistência atômica com rollback manual em caso de falha de gravação de embedding.
  - `session_service.py`: Lógica transacional de sessões acadêmicas de laboratório, com controle de concorrência mitigado por índice parcial UNIQUE no banco, histerese anti-flip-flop (`debounce_seconds=60`), anulação de saídas esquecidas (`voided_at`) e cálculo contínuo de total de horas em UTC.
- **`app/db/`**:
  - `supabase_client.py`: Singleton do cliente Supabase configurado exclusivamente com `service_role` key para uso interno no servidor.
  - `schema.py`: Dicionário canônico de colunas esperadas por tabela para detecção de incompatibilidades estruturais.
  - `schema_check.py`: Validador de inicialização que executa queries pontuais no boot para garantir paridade com as migrações SQL.

---

## 3. Inventário de Banco de Dados (Supabase / PostgreSQL)

### 3.1 Tabelas Estruturais
| Tabela | Colunas Chave | RLS Habilitado | RLS Forçado | Finalidade |
|---|---|:---:|:---:|---|
| `public.profiles` | `id` (UUID PK), `name`, `matricula`, `avatar_url`, `active`, `consent_given`, `consent_at`, `terms_version`, `consent_revoked_at`, `created_at` | Sim | Sim | Metadados do integrante e evidências de consentimento LGPD. |
| `public.face_embeddings` | `id` (UUID PK), `profile_id` (FK profiles CASCADE), `embedding` (float8[]), `vec` (vector(512)), `created_at` | Sim | Sim | Vetor biométrico matemático representativo da face do titular. |
| `public.sessions` | `id` (Bigint PK), `profile_id` (FK profiles CASCADE), `check_in`, `check_out`, `voided_at`, `auto_closed`, `duration_s` (Generated Always Stored) | Sim | Sim | Histórico de permanência física dos alunos no laboratório. |
| `public.face_logs` | `id` (Bigint PK), `profile_id` (FK profiles CASCADE), `confidence` (float8), `created_at` | Sim | Sim | Log de auditoria de reconhecimentos e score de confiança. |

### 3.2 Índices Críticos
- `idx_sessions_profile_single_open`: Índice UNIQUE parcial em `public.sessions (profile_id) WHERE check_out IS NULL`. Garante restrição matemática contra múltiplas sessões simultâneas abertas para o mesmo aluno.
- `idx_face_embeddings_hnsw`: Índice vetorial HNSW em `public.face_embeddings USING hnsw (vec vector_cosine_ops) WITH (m = 16, ef_construction = 64)`. Acelera consultas de similaridade no banco.
- `idx_face_embeddings_profile`: Índice B-tree padrão em `profile_id` para otimização de joins e deleções em cascata.

### 3.3 Funções Armazenadas & RPCs
- `public.match_face(vector(512), float, int)`: Função com privilégio `SECURITY DEFINER` e `set search_path = public`. Executa o cálculo de distância cosseno (`fe.vec <=> query_embedding`) filtrando integrantes ativos. Permissão de execução revogada de `anon` e `authenticated`, concedida unicamente a `service_role`.

---

## 4. Inventário dos Clientes (Web e Mobile)

### 4.1 Frontend Web (`web/`)
- **Framework:** React 18 SPA construído com Vite e styled com Tailwind CSS.
- **Rotas Implementadas:**
  - `/login` (`web/src/pages/Login.tsx`): Formulário de login institucional de tutores integrado com `supabase.auth.signInWithPassword`.
  - `/dashboard` (`web/src/pages/Dashboard.tsx`): Painel protegido por `<RequireAuth>` exibindo tabela de horas totais por integrante e histórico detalhado por dia.
- **Comunicação de Dados:** Conexão direta cliente-banco via `@supabase/supabase-js` utilizando `VITE_SUPABASE_ANON_KEY`. O painel web **não** consome a API FastAPI diretamente.

### 4.2 Frontend Mobile (`mobile/`)
- **Framework:** React Native gerenciado via Expo SDK com roteamento declarativo por arquivo (`expo-router`).
- **Telas & Componentes:**
  - `app/index.tsx`: Tela principal dividida em duas colunas:
    - Coluna esquerda: `RecognitionPanel.tsx` (câmera com `CameraView`, botões de disparo de Entrada e Saída, captura sequencial rápida de 2 frames).
    - Coluna direita: `PresenceSidebar.tsx` (lista de membros atualmente presentes no laboratório com atualização via Supabase Realtime).
  - `components/TutorPinModal.tsx`: Modal administrativo que exige login com e-mail e senha de tutor (`app_metadata.role == 'tutor'`) para desbloquear o fluxo de cadastro.
  - `app/enroll.tsx` & `components/EnrollCapture.tsx`: Interface de cadastro guiado de novos membros, coletando nome, matrícula (9 dígitos), toggle de consentimento e disparo de 5 fotos sequenciais (`SequentialCamera.tsx`), enviando o payload para `POST /api/v1/enroll`.
- **Comunicação de Dados:**
  - Para leitura de presença: Conexão direta com Supabase via `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
  - Para biometria e sessões: Requisições HTTP REST contra o backend FastAPI (`EXPO_PUBLIC_API_BASE_URL`), enviando `X-Kiosk-Key` em operações de reconhecimento e `Authorization: Bearer <tutorToken>` em operações administrativas.

---

## 5. Modelos de Inteligência Artificial & Artefatos

| Modelo | Arquitetura | Formato | Dimensão / Input | Origem / Hash SHA-256 | Localização em Disco |
|---|---|---|---|---|---|
| **InsightFace Recognition** | MobileFaceNet (w600k_mbf) | ONNX | 112x112 RGB $\rightarrow$ 512-D L2 norm | InsightFace Model Zoo (buffalo_s) | `/app/.insightface/models/buffalo_s/w600k_mbf.onnx` |
| **InsightFace Detection** | SCRFD (2.5k) | ONNX | 640x640 RGB $\rightarrow$ Bounding boxes & 5 landmarks | InsightFace Model Zoo (buffalo_s) | `/app/.insightface/models/buffalo_s/det_500m.onnx` |
| **Anti-Spoofing (PAD)** | MiniFASNetV2 | ONNX | 80x80 BGR $\rightarrow$ 3 logits (Print, Live, Replay) | HuggingFace (`garciafido`) <br>`d7b3cd9ba8a7ceb13baa8c4720902e27ca3112eff52f926c08804af6b6eecc7b` | `backend/app/models/pad.onnx` |
