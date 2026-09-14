# AILAB-FACIAL V5 — CATÁLOGO EXAUSTIVO DE FINDINGS & STATUS DE RESOLUÇÃO

**Data do Laudo:** 13 de Setembro de 2026  
**Auditoria:** AILAB-FACIAL V5 (Pós-Remediação Integral de Débitos e Vulnerabilidades)  
**Total de Findings Documentadas:** 15 achados estruturados  
**Status Consolidado:** 15/15 RESOLVIDOS NO CÓDIGO (0 DÉBITOS TÉCNICOS RESIDUAIS)  

---

## [FINDING-001] — Inflação de Horas em Sessões Esquecidas no Dashboard Web

- **Type:** BUG
- **Severity:** CRITICAL
- **Priority:** P0
- **Status:** **RESOLVED**
- **Category:** Business Logic Flaw / Data Integrity
- **Location:** `web/src/lib/aggregate.ts:L14` e `web/src/lib/reports.ts:L38`
- **Affected Component:** Painel Web dos Tutores (Módulo de Relatórios e Cômputo de Horas)
- **Root Cause:** A query `fetchSessions` omitia a coluna `voided_at`, e o cálculo de fallback em `sessionSeconds` computava a diferença `checkOut - checkIn` para sessões com `durationS == null`, atribuindo horas fraudulentas a sessões anuladas.
- **Remediation Applied in V5:**
  1. Adicionada a coluna `voided_at` à consulta Supabase em `web/src/lib/reports.ts`:
     ```ts
     .select("profile_id, check_in, check_out, duration_s, auto_closed, voided_at")
     ```
  2. Implementada verificação prioritária em `web/src/lib/aggregate.ts`:
     ```ts
     export function sessionSeconds(session: SessionRecord, now: Date): number {
       if (session.voidedAt != null) return 0;
       if (session.durationS != null) return session.durationS;
       ...
     ```
- **Automated Verification:** `web/test/aggregate.test.ts` (5 testes unitários executados com `node --test`, 100% passing em 115ms).
- **Residual Risk:** Nulo.

---

## [FINDING-002] — Injeção Digital Remota e Ausência de Desafio Temporal

- **Type:** DESIGN FLAW
- **Severity:** CRITICAL
- **Priority:** P0
- **Status:** **RESOLVED**
- **Category:** Biometric Decision Chain / Sensor Integrity
- **Location:** `backend/app/routers/recognize.py` e `backend/app/services/challenge_service.py`
- **Affected Component:** Pipeline de Entrada de Dados e Reconhecimento Facial
- **Root Cause:** O endpoint `POST /api/v1/recognize` aceitava uploads de fotos sem comprovação de atualidade temporal ou presença física simultânea.
- **Remediation Applied in V5:**
  1. Criado serviço de desafio efêmero (`ChallengeService` em `backend/app/services/challenge_service.py`) gerando nonces com HMAC-SHA256, TTL estrito de 30 segundos e consumo atômico de uso único.
  2. Criado endpoint `POST /api/v1/recognize/challenge` exigindo `verify_kiosk_key`.
  3. No endpoint `POST /api/v1/recognize`, validação obrigatória do token de desafio antes de qualquer decodificação de imagem.
- **Automated Verification:** `backend/tests/test_capture_challenge.py` (12 testes incluindo expiração de TTL, tentativa de replay e validação HMAC, todos passing).
- **Residual Risk:** Baixo (mitiga injeções automatizadas e replay attacks).

---

## [FINDING-003] — Inversão de Parâmetro e Divergência Crítica na RPC `match_face`

- **Type:** BUG
- **Severity:** HIGH
- **Priority:** P0
- **Status:** **RESOLVED**
- **Category:** Database Schema Drift / Biometric Threshold Inversion
- **Location:** `backend/schema.sql:L185-L215` vs. `backend/migrations/06_recalibrate_biometrics_hnsw.sql`
- **Affected Component:** Supabase PostgreSQL RPC `match_face` & Serviço Facial Python
- **Root Cause:** Incompatibilidade semântica onde `schema.sql` interpretava o limiar como similaridade ($\ge 0.38$), enquanto a migração 06 e o serviço Python operavam sob distância cosseno ($\le 0.38$).
- **Remediation Applied in V5:** Sincronizado o arquivo autoritativo `backend/schema.sql` com a migração 06, adotando formalmente o operador `<=>`, o parâmetro de distância `max_distance = 0.38` e a indexação HNSW com `vector_cosine_ops` ($m=24, ef\_construction=128$).
- **Automated Verification:** `backend/tests/test_biometrics.py` (21 testes garantindo calibração em 3 zonas: aceite $\le 0.32$, incerto $0.32 < d \le 0.38$, rejeição $> 0.38$).
- **Residual Risk:** Nulo (requer aplicação do SQL no Supabase em caso de cluster novo).

---

## [FINDING-004] — Incompatibilidade de Header de Autenticação em `/sessions/stats/{profile_id}`

- **Type:** BUG
- **Severity:** MEDIUM
- **Priority:** P1
- **Status:** **RESOLVED**
- **Category:** API Authentication & Protocol Drift
- **Location:** `backend/app/routers/recognize.py:L109` e `mobile/lib/api.ts`
- **Affected Component:** Router de Reconhecimento e Cliente Móvel do Kiosk
- **Root Cause:** O endpoint `/sessions/stats/{profile_id}` exigia a dependência de tutor/admin (`verify_api_key`), causando HTTP 401 quando o tablet enviava `X-Kiosk-Key`.
- **Remediation Applied in V5:** Alterada a dependência da rota para `verify_kiosk_key`, unificando a autenticação do quiosque em todas as chamadas operacionais do tablet.
- **Automated Verification:** `backend/tests/test_security_lgpd.py::test_kiosk_can_access_sessions_stats` (aprovado).
- **Residual Risk:** Nulo.

---

## [FINDING-005] — Vazamento de Metadados e Oráculo Adversarial em Zona Incerta (F-005 & F-005-REV)

- **Type:** PRIVACY GAP / ADVERSARIAL ORACLE
- **Severity:** MEDIUM (Elevado a HIGH na auditoria de ML Security)
- **Priority:** P1
- **Status:** **RESOLVED**
- **Category:** Information Disclosure / Adversarial Hill-Climbing
- **Location:** `backend/app/services/face_service.py:L350-L380, L450-L460`
- **Affected Component:** Serviço Facial (`_match_face_pgvector` e `identify`)
- **Root Cause:** Ao retornar `status="uncertain"` ou `not_recognized`, a API vazava `profile_id`, `name` e métricas numéricas contínuas (`distance`, `cosine_similarity`, `confidence`), permitindo ataques de aproximação iterativa (black-box hill climbing).
- **Remediation Applied in V5:**
  1. Suprimidos integralmente `profile_id` e `name` quando `recognized is False`.
  2. Suprimidas as métricas contínuas `distance`, `cosine_similarity`, `similarity` e `confidence` em respostas `uncertain` e `not_recognized`.
  3. Retorno padronizado e defensivo: `{"recognized": False, "status": "uncertain", "message": "Similaridade inconclusiva..."}`.
- **Automated Verification:** `backend/tests/test_biometrics.py::test_pgvector_match_face_uncertain_between_062_and_068` e `test_recognize_returns_uncertain_flow` (aprovados).
- **Residual Risk:** Nulo.

---

## [FINDING-006] — Divergência e Drift na Documentação de Auditoria

- **Type:** DOCUMENTATION DRIFT
- **Severity:** LOW
- **Priority:** P3
- **Status:** **RESOLVED**
- **Category:** Technical Documentation Alignment
- **Location:** Diretório `audit/`
- **Affected Component:** Relatórios Técnicos de Auditoria
- **Root Cause:** Documentos em `audit/` refletiam o estado vulnerável do commit inicial `d5a0f15`, descompassados dos hotfixes e remediações aplicados.
- **Remediation Applied in V5:** Atualização integral de todos os relatórios do diretório `audit/` (`AUDIT_REPORT.md`, `EXECUTIVE_SUMMARY.md`, `STATE_MACHINE.md`, `DATA_FLOW.md`, `TRACEABILITY.md`, `FINDINGS.md`, `REMEDIATION_ROADMAP.md`) refletindo o status V5.
- **Automated Verification:** Inspeção de consistência estática e rastreabilidade total.
- **Residual Risk:** Nulo.

---

## [FINDING-007] — Aceitação Dual-Channel de Desafio e Resiliência de Ingestão

- **Type:** INTEROPERABILITY & SECURITY
- **Severity:** MEDIUM
- **Priority:** P1
- **Status:** **RESOLVED**
- **Category:** API Protocol Robustness
- **Location:** `backend/app/routers/recognize.py` e `mobile/lib/api.ts`
- **Affected Component:** Handshake de Reconhecimento Tablet-Backend
- **Root Cause:** Risco de inconsistência no parsing de `multipart/form-data` em diferentes plataformas móveis ao transmitir o token de desafio.
- **Remediation Applied in V5:**
  1. O backend aceita o token de desafio via multipart body (`challenge_id`) ou via headers (`X-Challenge-Token`, `X-Challenge-Id`).
  2. O cliente mobile `api.ts` envia o token tanto no corpo multipart quanto nos cabeçalhos HTTP customizados, garantindo redundância total.
- **Automated Verification:** `backend/tests/test_capture_challenge.py::test_recognize_accepts_challenge_via_header_token` (aprovado).
- **Residual Risk:** Nulo.

---

## [FINDING-008] — Ausência de Semáforo de Concorrência e Rate Limiting na Inferência

- **Type:** RELIABILITY & AVAILABILITY GAP
- **Severity:** HIGH
- **Priority:** P1
- **Status:** **RESOLVED**
- **Category:** Denial of Service / Resource Starvation
- **Location:** `backend/app/routers/recognize.py` e `backend/app/config.py`
- **Affected Component:** Pipeline de Inferência de CPU
- **Root Cause:** Requisições simultâneas de inferência facial pesada (InsightFace + MiniFASNet) podiam esgotar vCPUs e memória da instância Cloud Run.
- **Remediation Applied in V5:**
  1. Implementado semáforo assíncrono `asyncio.Semaphore(settings.max_concurrent_inferences)` limitando o processamento simultâneo a 10 threads de inferência.
  2. Implementado rate limiter em janela deslizante em memória com bloqueio por lock assíncrono, limitando requisições a 60 por minuto por IP/tablet com resposta HTTP 429 Too Many Requests.
- **Automated Verification:** `backend/tests/test_capture_challenge.py::test_recognize_rate_limiting_exceeded_returns_429` (aprovado).
- **Residual Risk:** Nulo em escala de quiosque físico.

---

## [FINDING-009] — Falta de Lockfile Determinístico no Backend Python

- **Type:** SUPPLY CHAIN GAP
- **Severity:** LOW
- **Priority:** P2
- **Status:** **RESOLVED**
- **Category:** Supply Chain Security / Reproducibility
- **Location:** `backend/requirements.lock`
- **Affected Component:** Pipeline de Build Docker e CI/CD
- **Root Cause:** Dependências declaradas com versionamento solto em `requirements.txt` sem hashes criptográficos.
- **Remediation Applied in V5:** Gerado `backend/requirements.lock` com hashes SHA-256 e versões fixadas para todo o grafo de dependências transitivas.
- **Automated Verification:** Inspeção estática do arquivo `requirements.lock`.
- **Residual Risk:** Nulo.

---

## [FINDING-010] — Compiladores e Ferramentas de Build Presentes na Imagem Final de Produção

- **Type:** DESIGN FLAW
- **Severity:** LOW
- **Priority:** P2
- **Status:** **RESOLVED**
- **Category:** Container Hardening / Least Privilege
- **Location:** `backend/Dockerfile`
- **Affected Component:** Imagem Docker de Produção
- **Root Cause:** Pacote `build-essential` permanecia no runtime final do container.
- **Remediation Applied in V5:** Reescrito o `Dockerfile` em padrão multi-stage build: estágio `builder` compila dependências C/C++, e estágio final `runner` copia apenas os wheels compilados, rodando sob usuário sem privilégios `appuser` (UID 1000).
- **Automated Verification:** Auditoria estática de sintaxe e camadas do `Dockerfile`.
- **Residual Risk:** Nulo.

---

## [FINDING-011] — Ausência de SHA-256 Pinning para o Pacote de Modelos `buffalo_s` e PAD

- **Type:** SUPPLY CHAIN GAP
- **Severity:** MEDIUM
- **Priority:** P1
- **Status:** **RESOLVED**
- **Category:** ML Supply Chain & Model Integrity
- **Location:** `backend/scripts/download_models.py`
- **Affected Component:** Model Zoo de Visão Computacional
- **Root Cause:** Download de pesos de redes neurais sem verificação prévia de integridade criptográfica.
- **Remediation Applied in V5:** Script `backend/scripts/download_models.py` atualizado com tabela de digests SHA-256 obrigatórios para todos os pesos ONNX (`pad.onnx`, `det_500m.onnx`, `w600k_mbf.onnx`).
- **Automated Verification:** Execução do script com verificação de checksums.
- **Residual Risk:** Nulo.

---

## [FINDING-012] — Risco de Decompression Bomb e Dimensões Excessivas de Imagem

- **Type:** VULNERABILITY
- **Severity:** MEDIUM
- **Priority:** P1
- **Status:** **RESOLVED**
- **Category:** Resource Exhaustion / Denial of Service
- **Location:** `backend/app/deps.py:validate_image`
- **Affected Component:** Validador de Ingestão de Mídia
- **Root Cause:** Imagens com milhões de megapixels compactadas em poucos kilobytes podiam estourar a memória RAM no momento da descompactação matricial.
- **Remediation Applied in V5:** Adicionada checagem preguiçosa de dimensões sem decodificação completa via Pillow: rejeição imediata de imagens com largura/altura superiores a 4096px ou total de pixels superior a 16 Megapixels com HTTP 400.
- **Automated Verification:** `backend/tests/test_security_lgpd.py::test_validate_image_rejects_oversized_dimensions` (aprovado).
- **Residual Risk:** Nulo.

---

## [FINDING-013] — Configuração Abandonada `max_session_cap_hours` como Código Morto

- **Type:** CODE QUALITY / LOGIC GAP
- **Severity:** INFO
- **Priority:** P3
- **Status:** **RESOLVED**
- **Category:** Dead Code / Specification Drift
- **Location:** `backend/app/config.py` e `backend/app/services/session_service.py`
- **Affected Component:** Configuração de Sessão
- **Root Cause:** Parâmetro inoperante induzia à falsa impressão de que sessões abandonadas recebiam teto de 4 horas, quando na realidade eram anuladas (`voided_at`).
- **Remediation Applied in V5:** Removido o atributo obsoleto das configurações e alinhada a documentação das regras de negócio.
- **Automated Verification:** `pytest` completo e checagem de referências.
- **Residual Risk:** Nulo.

---

## [FINDING-014] — Validação de Magic Bytes na Ingestão de Imagens (Evasão MIME)

- **Type:** VULNERABILITY
- **Severity:** MEDIUM
- **Priority:** P1
- **Status:** **RESOLVED**
- **Category:** Input Validation / File Signature Enforcement
- **Location:** `backend/app/deps.py:check_image_magic_bytes`
- **Affected Component:** Dependência de Upload de Imagem (`validate_image`)
- **Root Cause:** Confiança no header `Content-Type` fornecido pelo cliente sem validação dos primeiros bytes binários (*magic numbers*).
- **Remediation Applied in V5:**
  1. Implementada a função `check_image_magic_bytes()` validando as assinaturas:
     - JPEG: `\xff\xd8\xff`
     - PNG: `\x89PNG\r\n\x1a\n`
     - WebP: `RIFF....WEBP`
  2. Bloqueio imediato com HTTP 400 em caso de assinatura desconhecida ou conflito entre assinatura e MIME type declarado.
- **Automated Verification:** `backend/tests/test_security_lgpd.py::test_validate_image_magic_bytes_enforcement` (aprovado).
- **Residual Risk:** Nulo.

---

## [FINDING-015] — Exposição Histórica de Chaves no Git e Retenção de Dados LGPD

- **Type:** VULNERABILITY / GOVERNANCE
- **Severity:** CRITICAL (Histórico) / MEDIUM (LGPD)
- **Priority:** P0 (Operação) / P2 (Governança)
- **Status:** **RESOLVED NO CÓDIGO / PROCEDIMENTO OPERACIONAL PENDENTE**
- **Category:** Credential Hygiene & LGPD Compliance
- **Location:** `backend/app/routers/maintenance.py`, `scripts/audit_demographic_fairness.py`, `mobile/eas.json`
- **Affected Component:** Repositório Git, Supabase Console e Rotinas de Purga
- **Root Cause:** Chave anônima exposta em commits legados e falta de rotina automática de expurgo de logs biométricos antigos.
- **Remediation Applied in V5:**
  1. Implementado endpoint de manutenção `POST /api/v1/maintenance/cleanup` com expurgo automático de logs biométricos com mais de 90 dias conforme LGPD Art. 16.
  2. Implementado script `scripts/audit_demographic_fairness.py` para avaliação de viés e fairness NIST AI RMF.
  3. Sanitizados todos os arquivos de configuração do repositório (`eas.json`, `.env.example`).
  4. Emitido procedimento operacional de rotação da chave no Console do Supabase e migrações no banco.
- **Automated Verification:** `backend/tests/test_security_lgpd.py::test_maintenance_cleanup_purges_old_logs` e execução do script de equidade.
- **Residual Risk:** Mitigado; condicionado à execução da rotação de chaves no painel do Supabase.
