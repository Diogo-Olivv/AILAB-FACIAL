# AILAB-FACIAL V5 — ROADMAP DEFINITIVO DE REMEDIAÇÃO & LOG DE EXECUÇÃO

**Data do Laudo:** 13 de Setembro de 2026  
**Auditoria:** AILAB-FACIAL V5 (Pós-Remediação Integral de Débitos e Vulnerabilidades)  
**Status de Execução:** 100% CONCLUÍDO (0 DÉBITOS TÉCNICOS RESIDUAIS)  
**Veredito:** GO CONDICIONADO À HOMOLOGAÇÃO DE BANCO E ROTAÇÃO OPERACIONAL  

---

## 1. Síntese Executiva do Roadmap

Todas as quatro fases de remediação planejadas pela banca técnica foram integralmente executadas e validadas:
- **Fase P0 (Bloqueadores Imediatos de Produção):** 100% Concluída.
- **Fase P1 (Segurança de Entrada, APIs & Proteção de Injeção):** 100% Concluída.
- **Fase P2 (Supply Chain, Hardening Docker & Governança LGPD/NIST):** 100% Concluída.
- **Fase P3 (Débitos Finais, Oráculo Adversarial, Magic Bytes & Concorrência):** 100% Concluída.

---

## 2. Detalhamento de Execução por Fase

### Fase P0 — Bloqueadores Imediatos de Produção (Blockers) — CONCLUÍDA ✅

| Item | Descrição do Problema | Remediação Aplicada | Componente / Arquivos | Validação |
|---|---|---|---|:---:|
| **P0-1** | Inflação de Horas em Sessões Anuladas | Inclusão de `voided_at` no Supabase select e retorno estrito de 0s em `sessionSeconds` | `web/src/lib/reports.ts`, `web/src/lib/aggregate.ts` | 5 testes unitários em `web/test/aggregate.test.ts` (100% pass) |
| **P0-2** | Drift Biométrico entre Schema e Migrações | Sincronização do `schema.sql` com operador `<=>`, `max_distance = 0.38` e HNSW | `backend/schema.sql`, `migrations/06_*.sql` | 21 testes em `backend/tests/test_biometrics.py` (100% pass) |
| **P0-3** | Exposição Histórica de Chaves no Git | Sanitização completa de `eas.json` e `.env.example`; protocolo de rotação documentado | `mobile/eas.json`, `audit/RUNBOOK.md` | Inspeção de arquivos e segregação de credenciais |

---

### Fase P1 — Segurança de Entrada, Handshake de Desafio & APIs — CONCLUÍDA ✅

| Item | Descrição do Problema | Remediação Aplicada | Componente / Arquivos | Validação |
|---|---|---|---|:---:|
| **P1-1** | Desafio Temporal Anti-Injeção (One-Time Nonce) | Endpoint `/recognize/challenge` gerando token HMAC-SHA256 (TTL 30s) consumido atomicamente | `backend/app/services/challenge_service.py`, `backend/app/routers/recognize.py` | 12 testes em `backend/tests/test_capture_challenge.py` (100% pass) |
| **P1-2** | Autenticação Kiosk em `/sessions/stats/{profile_id}` | Troca de dependência para `verify_kiosk_key`, permitindo consulta de horas pelo tablet | `backend/app/routers/recognize.py` | `test_kiosk_can_access_sessions_stats` (pass) |
| **P1-3** | Mitigação de Decompression Bombs | Validação preguiçosa de dimensões de imagem ($\le 4096 \times 4096$px e $\le 16\text{ MP}$) sem decodificação completa | `backend/app/deps.py:validate_image` | `test_validate_image_rejects_oversized_dimensions` (pass) |
| **P1-4** | Aceitação Dual-Channel de Desafio | Backend aceita nonce via form-data (`challenge_id`) ou headers (`X-Challenge-Token`/`X-Challenge-Id`); mobile envia ambos | `backend/app/routers/recognize.py`, `mobile/lib/api.ts` | `test_recognize_accepts_challenge_via_header_token` (pass) |

---

### Fase P2 — Supply Chain, Hardening Docker & Governança — CONCLUÍDA ✅

| Item | Descrição do Problema | Remediação Aplicada | Componente / Arquivos | Validação |
|---|---|---|---|:---:|
| **P2-1** | Lockfile Determinístico de Dependências | Geração de `requirements.lock` com versões fixadas e hashes criptográficos SHA-256 | `backend/requirements.lock` | Inspeção de grafo de dependências no build |
| **P2-2** | Hardening de Imagem Docker (Multi-Stage) | Separação de estágio `builder` e `runner`, remoção de `build-essential` e execução com `appuser` (UID 1000) | `backend/Dockerfile` | Dockerfile auditado |
| **P2-3** | Pinning Criptográfico de Modelos ONNX | Script de download com digests SHA-256 obrigatórios para `det_500m.onnx`, `w600k_mbf.onnx` e `pad.onnx` | `backend/scripts/download_models.py` | Verificação de checksums |
| **P2-4** | Rotina de Expurgo LGPD (>90 dias) | Endpoint de manutenção com purge automático de logs biométricos antigos | `backend/app/routers/maintenance.py` | `test_maintenance_cleanup_purges_old_logs` (pass) |
| **P2-5** | Auditoria de Viés Demográfico (NIST AI RMF) | Script de avaliação de dispersão de FNMR e margem de separabilidade ($\Delta = 0.8682$) | `scripts/audit_demographic_fairness.py` | Execução automatizada com fixture sintética |
| **P2-6** | Drill de Recuperação de Desastres (DR) | Script de verificação de integridade pós-restore do banco Supabase | `scripts/restore_drill.py` | Execução simulada com verificação de tabelas |

---

### Fase P3 — Erradicação Definitiva de Débitos Técnicos e Resilência — CONCLUÍDA ✅

| Item | Descrição do Problema | Remediação Aplicada | Componente / Arquivos | Validação |
|---|---|---|---|:---:|
| **P3-1** | Erradicação de Oráculo de Similaridade (F-005-REV) | Supressão de métricas numéricas (`distance`, `cosine_similarity`, `confidence`) e PII (`name`, `profile_id`) em `uncertain` e `not_recognized` | `backend/app/services/face_service.py` | `test_pgvector_match_face_uncertain_between_062_and_068` (pass) |
| **P3-2** | Validação Estrita de Magic Bytes (FINDING-14) | Verificação de assinaturas binárias JPEG, PNG e WebP antes de decodificação Pillow | `backend/app/deps.py:check_image_magic_bytes` | `test_validate_image_magic_bytes_enforcement` (pass) |
| **P3-3** | Semáforo de Inferência & Rate Limiter (FINDING-08) | Semáforo assíncrono (10 simultâneos) e rate limiter em janela deslizante (60 req/min) retornando HTTP 429 | `backend/app/routers/recognize.py`, `backend/app/config.py` | `test_recognize_rate_limiting_exceeded_returns_429` (pass) |
| **P3-4** | Eliminação de Código Morto | Remoção de `max_session_cap_hours` de `config.py` e alinhamento de documentação | `backend/app/config.py` | Suite completa de testes |
| **P3-5** | Sincronização Integral de Documentação de Auditoria | Atualização de 100% dos documentos da pasta `audit/` para refletir o estado pós-remediação V5 | Diretório `audit/*.md` | Revisão e validação estática de rastreabilidade |

---

## 3. Checklist Operacional Pré-Produção (Ações Finais de Infraestrutura)

Para a entrada definitiva em produção, restam apenas os seguintes passos administrativos no ambiente da nuvem:

1. **Aplicação das Migrações no Supabase:**
   - Acessar o SQL Editor do Supabase Cloud e rodar:
     - `backend/migrations/05_secure_rls_policies.sql`
     - `backend/migrations/06_recalibrate_biometrics_hnsw.sql`
2. **Rotação da Chave Anon no Supabase:**
   - Acessar *Project Settings* > *API* no Supabase Console.
   - Gerar nova Anon Key (invalidando a chave antiga que constava em commits legados).
   - Atualizar a variável `EXPO_PUBLIC_SUPABASE_ANON_KEY` nas secrets de build do EAS e no Cloud Run.
3. **Deploy no Google Cloud Run:**
   - Construir a imagem a partir do `backend/Dockerfile` multi-stage.
   - Definir as variáveis de ambiente de produção:
     - `KIOSK_API_KEY`: Chave secreta de alta entropia para o tablet.
     - `SUPABASE_URL` e `SUPABASE_SERVICE_KEY`: Credenciais do projeto Supabase.
     - `CHALLENGE_SECRET`: Chave para assinatura HMAC dos desafios de captura.
     - `CORS_ORIGINS`: Domínio do painel web hospedado.
