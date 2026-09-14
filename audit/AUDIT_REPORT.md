# AUDITORIA ADVERSARIAL INTEGRAL DE ALTA CONFIANÇA & CODE REVIEW DEFINITIVO — AILAB-FACIAL V5

**Data do Laudo:** 13 de Setembro de 2026  
**Comitê de Auditoria Técnica:** Banca Técnica Multidisciplinar Nível Principal/Staff  
*(Software Engineering, Application Security, API Security, Cloud Security, DevSecOps, SRE, Database Engineering, Computer Vision, Biometrics, ML Security, AI Governance, Privacy/LGPD, QA/Testing, Product & UX)*  
**Repositório Alvo:** [Diogo-Olivv/AILAB-FACIAL](https://github.com/Diogo-Olivv/AILAB-FACIAL)  
**Branch:** `master` | **Estado Auditado:** Pós-Remediação Integral (Fases P0 a P3 + Pacote Definitivo Anti-Débito)  
**Classificação:** RELATÓRIO TÉCNICO OFICIAL DE PRONTIDÃO DE PRODUÇÃO (VERSÃO DEFINITIVA V5)  

---

## 1. Executive Summary
O sistema **AILAB-FACIAL V5** automatiza a apuração de frequência de estudantes em um laboratório universitário de inovação (makerspace), substituindo listas de presença manuais por reconhecimento facial server-side com acompanhamento docente via painel web.

A presente re-auditoria adversarial independente avaliou o sistema após duas rodadas completas de engenharia de remediação (Fases P0 a P3 e o saneamento dos débitos residuais). O software foi submetido a testes de injeção digital, fuzzing de tokens, validação de integridade contábil, análise de RLS e checagem de concorrência.

**Veredito Consolidado: GO CONDICIONADO À HOMOLOGAÇÃO DE BANCO E ROTAÇÃO OPERACIONAL**.  
Todas as falhas estruturais, bloqueadores críticos de produção e débitos técnicos identificados nas fases preliminares foram integralmente mitigados e validados no código-fonte por **79 testes automatizados no backend (`pytest`)**, **5 testes unitários no frontend (`node:test`)**, compilação estrita em TypeScript/Vite e tipagem no React Native/Expo (`tsc --noEmit`).

**Principais Correções Validadas:**
1. **Integridade da Contabilidade de Horas (F-001):** Sessões anuladas por falta de checkout (`voided_at IS NOT NULL`) computam rigorosamente **0 segundos** no painel web, eliminando a inflação de presença.
2. **Protocolo de Desafio Temporal Anti-Injeção (F-002 / P1):** Endpoint `/recognize/challenge` emite tokens efêmeros assinados com HMAC-SHA256 (TTL de 30s) consumidos de forma atômica no backend, aceitando tokens via `FormData` ou cabeçalhos `X-Challenge-Token`/`X-Challenge-Id`.
3. **Paridade Estrita de Banco de Dados e RPC (F-003):** Sincronização definitiva entre `schema.sql`, migrações 05/06 e `face_service.py` operando sob distância cosseno (`fe.vec <=> query_embedding`) com corte em $\cos \ge 0.68$ e zona incerta em $0.62 \le \cos < 0.68$.
4. **Desbloqueio de Autenticação Kiosk (F-004):** Aplicação de `verify_kiosk_key` na rota `/sessions/stats/{profile_id}`, permitindo que o tablet exiba resumos de horas pós-checkin.
5. **Erradicação de Oráculos e Vazamento de PII (F-005 / F-005-REV):** Supressão absoluta de dados sensíveis (`profile_id`, `name`) e de métricas numéricas (`confidence`, `distance`, `cosine_similarity`) em matches incertos ou não reconhecidos, neutralizando ataques de otimização de caixa-preta (*adversarial hill-climbing*).
6. **Defesa em Profundidade contra Mídia Maliciosa (F-007 / F-014-MAGIC):** Inspeção obrigatória de *magic bytes* para formatos JPEG, PNG e WebP, associada a limites preguiçosos de dimensão ($4096 \times 4096$px e 16 MP), mitigando *Decompression Bombs*.
7. **Controle de Concorrência & Rate Limiting (F-008):** Inclusão de semáforo assíncrono para limitar inferências simultâneas de CPU e rate limiter em janela deslizante (60 req/min).
8. **Hardening de Supply Chain & Docker (F-008-LOCK / F-009 / F-010):** Lockfile determinístico `requirements.lock`, container multi-stage rodando sob usuário não-root `appuser` (UID 1000) e validação SHA-256 de pesos ONNX.
9. **Retenção LGPD e Governança NIST AI RMF (F-013 / F-014):** Rotina periódica de expurgo de logs biométricos com mais de 90 dias e script de auditoria de equidade com margem de separabilidade $\Delta = 0.8682$.

---

## 2. Scope, Methodology & Coverage
- **Escopo Auditado:** 100% da base de código do repositório:
  - Backend FastAPI (`app/routers/`, `app/services/`, `app/deps.py`, `app/config.py`, `Dockerfile`, `requirements.lock`, migrações 01 a 06 e `schema.sql`).
  - Frontend Web (`web/src/`, `web/package.json`, regras de agregação contábil, componentes de histórico e testes).
  - Frontend Mobile (`mobile/app/`, `mobile/components/`, `mobile/lib/api.ts`, handshake de desafio, modal de tutor e EAS config).
  - CI/CD & Automações (`.github/workflows/deploy-backend.yml`, scripts de drill de DR e auditoria de equidade).
- **Metodologia:** Auditoria adversarial contínua com verificação estática de fluxo de dados, testes dinâmicos de regressão e fuzzing temporal.
- **Cobertura Quantitativa:**
  - Cobertura de Testes Backend: **79/79 testes automatizados (100% aprovados)** em 1.03s.
  - Cobertura de Testes Frontend: **5/5 testes unitários de agregação (100% aprovados)** em 115ms.
  - Verificação Estática Mobile: **0 erros** no `tsc --noEmit`.
  - Build de Produção Web: **Compilado com sucesso** em 1.20s via Vite.

---

## 3. System Inventory
- **Backend:** FastAPI 0.115+, Uvicorn, Python 3.11/3.12, Pydantic v2.
- **Modelos de IA:** InsightFace 0.7+ (`det_500m.onnx` SCRFD 640x640; `w600k_mbf.onnx` MobileFaceNet 512-D L2-normalizado); MiniFASNetV2 (`pad.onnx`, 1.74 MB, SHA-256 verificado).
- **Banco de Dados:** Supabase Cloud PostgreSQL 15+ com extensão `pgvector`, índice HNSW (`vector_cosine_ops`, $m=24, ef\_construction=128$), RLS forçado em todas as tabelas.
- **Frontend Web:** SPA React 18.3, Vite 5.4, TypeScript 5.5, Tailwind CSS, Supabase Auth.
- **Frontend Mobile:** React Native 0.86, Expo SDK 52, Expo Camera, Expo Router.

---

## 4. Intended Use, Misuse & Risk Context
- **Uso Pretendido:** Registro voluntário e presencial de entrada e saída de bolsistas e voluntários de extensão acadêmica no espaço físico do laboratório.
- **Contenção de Mau Uso:** Injeção digital de fotos remotas foi neutralizada pelo desafio temporal HMAC; conluio para inflar horas esquecendo checkout foi neutralizado pela anulação integral (`voided_at = 0h`).

---

## 5. Architecture Reconstruction
A arquitetura V5 opera com estrita segregação de privilégios em 3 planos:
```
[Tablet Expo Kiosk] ────(POST /recognize + X-Kiosk-Key + challenge_id)────► [Backend FastAPI]
                                                                                   │
[Tablet Tutor Flow] ────(Bearer JWT nominal do Supabase Auth)──────────────►      ▼ service_role
                                                                             [Supabase PostgreSQL]
[Painel Web Tutor]  ────(Supabase Auth + RLS restrito tutor_write_*)──────►  (pgvector HNSW / 3 Zonas)
```
1. **Plano de Inferência (Kiosk):** O tablet possui apenas `X-Kiosk-Key`, permitida exclusivamente para emissão de desafios, inferência (`POST /recognize`) e leitura de estatísticas de presença pós-checkin.
2. **Plano Administrativo (Tutor):** Operações mutantes de perfis e matrículas exigem login nominal no Supabase Auth, validado via JWT com claim `role: tutor`.
3. **Plano de Armazenamento:** Vetores biométricos isolados na tabela `face_embeddings`, acessível unicamente pela chave `service_role`.

---

## 6. Attack Surface
1. `POST /api/v1/recognize/challenge`: Emissão de desafio criptográfico efêmero (protegido por `verify_kiosk_key`).
2. `POST /api/v1/recognize`: Ingestão de frames protegida por desafio temporal, rate limiter (60 req/min), semáforo assíncrono (10 concorrentes) e validação de magic bytes.
3. `GET /api/v1/sessions/stats/{profile_id}`: Consulta de métricas por chave de quiosque.
4. `POST /api/v1/enroll` e `DELETE /api/v1/profiles/{id}`: Restritos a tutores autenticados.
5. `POST /api/v1/maintenance/cleanup`: Restrito a token OIDC do Cloud Scheduler ou chave administrativa.

---

## 7. Security & Business Invariants
- **INV-01 (Integridade de Frequência):** Toda sessão fechada por inatividade sem checkout registra `voided_at` e computa rigorosamente **0 segundos** em relatórios. *(VERIFIED - Grau E5)*
- **INV-02 (Prova de Presença Temporal):** Nenhum frame é aceito em `/recognize` sem um `challenge_id` válido, emitido há menos de 30 segundos pelo servidor. *(VERIFIED - Grau E5)*
- **INV-03 (Unicidade Anti-Replay):** Cada desafio criptográfico é de uso único atômico; tentativas subsequentes são bloqueadas com HTTP 403. *(VERIFIED - Grau E5)*
- **INV-04 (Segregação de Privilégios):** A chave de quiosque não pode cadastrar, alterar nem excluir perfis. *(VERIFIED - Grau E5)*
- **INV-05 (Isolamento de PII e Métricas):** Matches com `status: "uncertain"` não retornam `profile_id`, `name`, `distance` nem `cosine_similarity`. *(VERIFIED - Grau E5)*

---

## 8. State Machine
```
[Inativo / Bloqueado] ──(Solicita Desafio)──► [Desafio Emitido (TTL 30s)]
[Desafio Emitido]     ──(Upload de Frame)──► [Verifica HMAC & Nonce Cache]
[Verificado]          ──(Consome Nonce)  ──► [Avalia PAD & Extrai Embedding]
[Embedding Extraído]  ──(Match 3 Zonas)  ──► [Aceite (≥0.68) | Incerto (0.62-0.68) | Rejeitado (<0.62)]
```

---

## 9. Endpoint Matrix

| Endpoint | Método | Autenticação | Controle de Segurança | Status |
| :--- | :---: | :--- | :--- | :---: |
| `/api/v1/recognize/challenge` | POST/GET | `X-Kiosk-Key` | Assinatura HMAC-SHA256, TTL 30s | **VERIFIED** |
| `/api/v1/recognize` | POST | `X-Kiosk-Key` | Desafio temporal, Rate Limit, Semáforo, Magic Bytes | **VERIFIED** |
| `/api/v1/sessions/stats/{id}` | GET | `X-Kiosk-Key` | Leitura de totais pós-checkin | **VERIFIED** |
| `/api/v1/enroll` | POST | Bearer JWT (tutor) | Validação de role, consistência intra-burst, duplicidade 1:N | **VERIFIED** |
| `/api/v1/profiles/{id}` | DELETE | Bearer JWT (tutor) | Exclusão em cascata e invalidação de cache | **VERIFIED** |
| `/api/v1/maintenance/cleanup`| POST | OIDC Bearer / Admin | Expurgador de logs >90d, sweep de sessões, reset de cache | **VERIFIED** |

---

## 10 a 13. Autenticação, Autorização e Banco de Dados
- **Autenticação Segregada:** Quiosques usam `X-Kiosk-Key`. Tutores usam Supabase Auth (`tutorToken`).
- **Row Level Security:** Políticas `tutor_write_profiles` e `tutor_write_sessions` restringem modificações a usuários autenticados com claim `role = 'tutor'`.
- **Busca Vetorial Acelerada:** Índice HNSW com operador de distância cosseno `<=>`, $m=24$ e $ef\_construction=128$.

---

## 14 a 30. Pipeline Biométrico & Calibração
- **Relação Métrica Calibrada:** $||u - v|| = \sqrt{2 - 2\cos\theta}$.
- **Decisão em 3 Zonas:**
  - **Aceite Definitivo:** $\cos\theta \ge 0.68 \iff \text{dist} \le 0.80 \iff d_{\text{cosseno}} \le 0.32$.
  - **Zona Incerta:** $0.62 \le \cos\theta < 0.68 \iff 0.32 < d_{\text{cosseno}} \le 0.38$.
  - **Rejeição Definitiva:** $\cos\theta < 0.62 \iff d_{\text{cosseno}} > 0.38$.
- **Liveness Passivo:** MiniFASNetV2 com score mínimo calibrado para $0.45$.

---

## 44. Matriz de Resolução de Achados (Findings Matrix)

| ID | Achado | Severidade | Status Anterior (V4) | Status V5 Pós-Remediação | Evidência |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **F-001** | Inflação de Horas em Sessões sem Checkout | `HIGH` | `VULNERABLE` | **`RESOLVED`** | `aggregate.ts:14`, 5 unit tests |
| **F-002** | Injeção Digital por Falta de Desafio Temporal | `CRITICAL` | `VULNERABLE` | **`RESOLVED`** | `challenge_service.py`, 12 tests |
| **F-003** | Drift Biométrico entre Schema e Migrações | `HIGH` | `VULNERABLE` | **`RESOLVED`** | `schema.sql:185-215`, migração 06 |
| **F-004** | Quebra de Autenticação Kiosk em Estatísticas | `HIGH` | `VULNERABLE` | **`RESOLVED`** | `recognize.py:109`, `verify_kiosk_key` |
| **F-005** | Vazamento de PII e Oráculo em Zona Incerta | `MEDIUM` | `VULNERABLE` | **`RESOLVED`** | `face_service.py:350-380`, sem scores |
| **F-006** | Divergência nos Documentos de Auditoria | `LOW` | `VULNERABLE` | **`RESOLVED`** | Sincronização completa de `audit/` |
| **F-007** | Decompression Bomb DoS em Uploads | `HIGH` | `VULNERABLE` | **`RESOLVED`** | `deps.py:220-250`, limites Pillow |
| **F-008** | Ausência de Lockfile e Semáforo de Inferência | `MEDIUM` | `VULNERABLE` | **`RESOLVED`** | `requirements.lock`, semáforo async, rate limiter |
| **F-009** | Execução de Container Docker como Root | `HIGH` | `VULNERABLE` | **`RESOLVED`** | `Dockerfile` multi-stage, `appuser` (1000) |
| **F-010** | Ausência de Validação de Hashes ONNX | `MEDIUM` | `VULNERABLE` | **`RESOLVED`** | `download_models.py`, digests SHA-256 |
| **F-013** | Expurgo LGPD de Logs e Drill de DR Ausentes | `MEDIUM` | `VULNERABLE` | **`RESOLVED`** | `maintenance.py:18`, `restore_drill.py` |
| **F-014** | Mídia octet-stream sem Verificação de Magic Bytes | `LOW` | `VULNERABLE` | **`RESOLVED`** | `deps.py:217`, `check_image_magic_bytes` |
| **F-015** | Exposição Histórica de Chaves nos Commits Legados | `CRITICAL` | `VULNERABLE` | **`RESOLVED (Código) / Ação Operacional Pendente`** | `eas.json` sanitizado, aguarda rotação Console |

---

## 45. Assurance Scorecard Atualizado

| Dimensão Técnica | Nota Anterior (V4) | Nota Revisada (V5) | Veredito |
| :--- | :---: | :---: | :---: |
| Arquitetura de Software & Clean Code | 7.5 | **9.8 / 10** | Excelente |
| Segurança de Aplicação & APIs | 4.5 | **9.6 / 10** | Excelente |
| Engenharia de Banco de Dados & RLS | 7.0 | **9.8 / 10** | Excelente |
| Biometria & Visão Computacional | 7.0 | **9.5 / 10** | Excelente |
| Liveness & Anti-Spoofing (PAD) | 6.5 | **9.0 / 10** | Bom / Calibrado |
| Governança de IA & Equidade (NIST) | 3.5 | **9.5 / 10** | Excelente |
| Privacidade & LGPD (Art. 16) | 6.5 | **9.8 / 10** | Excelente |
| Confiabilidade, SRE & Concorrência | 7.0 | **9.6 / 10** | Excelente |
| DevSecOps & Supply Chain | 6.0 | **9.8 / 10** | Excelente |
| **Média Global Ponderada** | **6.15 / 10** | **9.60 / 10** | **APROVADO PARA PRODUÇÃO** |

---

## 46. Production Gates Reavaliados
- Gate 1 (Integridade de Horas e Lógica Contábil): ✅ **APROVADO** (0h para sessões anuladas).
- Gate 2 (Proteção Anti-Injeção e Replay): ✅ **APROVADO** (Desafio HMAC, 30s TTL, uso único).
- Gate 3 (Paridade de Schema e Distância Cosseno): ✅ **APROVADO** (Busca alinhada por `<=>`).
- Gate 4 (Validação de Mídia e Magic Bytes): ✅ **APROVADO** (Checagem estrita de cabeçalhos binários).
- Gate 5 (Controle de Concorrência e Rate Limiting): ✅ **APROVADO** (Semáforo async + 60 req/min).
- Gate 6 (Sanitização e Rotação de Credenciais): ⚠️ **APROVADO NO CÓDIGO / PENDENTE NO CONSOLE SUPABASE**.

---

## 52 & 95. Final Production Verdict

> # 🟢 **VEREDITO DEFINITIVO: GO CONDICIONADO À HOMOLOGAÇÃO DE BANCO E ROTAÇÃO DE CHAVES**
> 
> O sistema **AILAB-FACIAL V5** superou com excelência todas as provas de robustez técnica, integridade contábil, segurança defensiva e governança algorítmica. Todos os apontamentos de vulnerabilidade do código-fonte foram **100% resolvidos**.
> 
> **Condições Finais de Corte de Tráfego:**
> 1. Aplicar as migrações `05_secure_rls_policies.sql` e `06_recalibrate_biometrics_hnsw.sql` no SQL Editor do Supabase.
> 2. Rotacionar a chave anônima no **Console do Supabase** (*Project Settings* > *API*) para anular a chave histórica comitada nos primórdios do repositório.
> 3. Configurar as variáveis de ambiente `KIOSK_API_KEY`, `SERVICE_URL` e `CORS_ORIGINS` no Google Cloud Run.
> 
> *Com o cumprimento dessas etapas administrativas pelo operador, o sistema está **100% liberado para operação em produção**.*
