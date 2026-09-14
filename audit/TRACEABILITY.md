# AILAB-FACIAL V5 — MATRIZ DE RASTREABILIDADE TÉCNICA DEFINITIVA

**Data do Laudo:** 13 de Setembro de 2026  
**Auditoria:** AILAB-FACIAL V5 (Pós-Remediação Integral de Débitos e Vulnerabilidades)  
**Status do Sistema:** VERIFIED / 100% SATISFIED EM CÓDIGO  

---

## 1. Rastreabilidade de Requisitos de Segurança (Threat $\rightarrow$ Objective $\rightarrow$ Control $\rightarrow$ Implementation $\rightarrow$ Test)

| Ameaça Modelada | Objetivo de Segurança | Controle de Engenharia | Arquivo / Implementação | Teste Automatizado | Resultado Técnico |
|---|---|---|---|---|:---:|
| **Reconhecimento não autorizado via fotos 2D** | Impedir aceitação de ataques de apresentação de fotos impressas. | Pipeline PAD com rede MiniFASNetV2 e análise cromática ($live\_prob \ge 0.45$). | `backend/app/services/liveness_service.py` | `test_check_image_quality`, `test_liveness_disabled_toggle` | **VERIFIED** |
| **Injeção de fotos por atacante remoto** | Garantir que a imagem provém de uma captura ao vivo no tablet via desafio efêmero. | Token Nonce HMAC-SHA256 efêmero (TTL 30s) de uso único consumido atomicamente; aceitação dual-channel via form-data (`challenge_id`) ou headers (`X-Challenge-Token`/`X-Challenge-Id`). | `backend/app/services/challenge_service.py`, `backend/app/routers/recognize.py`, `mobile/lib/api.ts` | `test_recognize_requires_valid_challenge`, `test_recognize_rejects_replayed_challenge`, `test_recognize_accepts_challenge_via_header_token` | **VERIFIED** |
| **Bypass de cadastro por aluno malicioso** | Exigir autorização docente nominal para cadastrar novos integrantes. | Validação de JWT Supabase com role `tutor` e fail-closed. | `backend/app/deps.py:verify_tutor_token` | `test_enroll_endpoint_rejects_kiosk_key`, `test_enroll_endpoint_accepts_tutor_token` | **VERIFIED** |
| **Substituição de biometria de terceiro** | Impedir que a biometria de Alice seja associada a Bob durante re-cadastramento. | Guarda de troca de identidade 1:N no refresh. | `backend/app/services/enroll_service.py:_guard_against_identity_swap` | `test_refresh_embedding_rejects_identity_swap` | **VERIFIED** |
| **Adulteração de horas por aluno esquecido** | Anular sessões com abandono de saída (0 horas computadas). | Marcação de `voided_at` no banco e supressão no front (`sessionSeconds` retorna 0s). | `session_service.py` (back) / `aggregate.ts:14` e `reports.ts:38` (front) | `web/test/aggregate.test.ts` (5 testes unitários passando) | **VERIFIED** |
| **Vazamento de vetores biométricos** | Proteger templates faciais contra vazamento via clientes ou APIs públicas. | Row Level Security no PostgreSQL (PostgREST) sem permissão anon, e restrição de escrita para tutors. | `backend/schema.sql`, `05_secure_rls_policies.sql` | `test_security_lgpd.py` | **VERIFIED** |
| **Exaustão de memória / Decompression Bomb** | Evitar crash do Cloud Run por parsing de imagens anômalas ou pixels gigantes. | Validação de tamanho (5MB), magic bytes binários estritos e checagem preguiçosa de dimensões ($\le 4096 \times 4096$px e $\le 16\text{ MP}$). | `backend/app/deps.py:validate_image` | `test_validate_image_rejects_oversized_dimensions`, `test_validate_image_magic_bytes_enforcement` | **VERIFIED** |
| **Evasão de tipo de arquivo via MIME spoofing** | Impedir uploads de arquivos não-imagem disfarçados de imagem. | Validação de magic bytes para JPEG (`\xff\xd8\xff`), PNG (`\x89PNG\r\n\x1a\n`) e WebP (`RIFF...WEBP`). | `backend/app/deps.py:check_image_magic_bytes` | `test_validate_image_magic_bytes_enforcement` | **VERIFIED** |
| **Oráculo de Otimização e Hill-Climbing Adversarial** | Impedir que atacantes usem métricas numéricas e PII para guiar aproximação vetorial. | Supressão total de `profile_id`, `name`, `distance`, `cosine_similarity`, `confidence` em matches `uncertain` ou `not_recognized`. | `backend/app/services/face_service.py:_match_face_pgvector` | `test_pgvector_match_face_uncertain_between_062_and_068`, `test_recognize_returns_uncertain_flow` | **VERIFIED** |
| **Exaustão de CPU por Flooding / Concorrência** | Proteger o container contra saturação de inferência simultânea e bombardeio de requisições. | Semáforo assíncrono limitando inferências paralelas (`max_concurrent_inferences = 10`) e rate limiter em janela deslizante (60 req/min por IP/kiosk). | `backend/app/routers/recognize.py`, `backend/app/config.py` | `test_recognize_rate_limiting_exceeded_returns_429` | **VERIFIED** |
| **Incompatibilidade de Header no Tablet Kiosk** | Garantir que o tablet consiga ler métricas de permanência pós-reconhecimento. | Rota `/sessions/stats/{profile_id}` autenticada com `verify_kiosk_key`. | `backend/app/routers/recognize.py:109` | `test_kiosk_can_access_sessions_stats` | **VERIFIED** |

---

## 2. Rastreabilidade de Controles Biométricos (Biometric Control Traceability)

| Risco Biométrico | Controle Específico | Componente Responsável | Métrica / Limiar | Evidência de Execução | Resultado Técnico |
|---|---|---|:---:|---|:---:|
| **Falsos Positivos por Distância Frouxa** | Limiar euclidiano e cosseno calibrado estrito | `face_service.py`, `schema.sql`, `06_recalibrate_biometrics_hnsw.sql` | $dist \le 0.80 \iff \cos \ge 0.68 \iff d_{\text{cosseno}} \le 0.32$ | RPC `match_face` usando `<=>` e teste de equivalência | **VERIFIED** |
| **Falsos Positivos por Zona Cinzenta** | Zona incerta para second-factor sem oráculo | `face_service.py` | $0.62 \le \cos < 0.68 \iff 0.32 < d_{\text{cosseno}} \le 0.38$ | Retorno padronizado `status='uncertain'` sem pontuações | **VERIFIED** |
| **Mistura de Faces no Cadastro** | Consistência intra-burst de 3 a 5 fotos | `enroll_service.py` | $dist \le 0.70$ par a par | `test_intra_burst_consistency_rejects_dissimilar_faces` | **VERIFIED** |
| **Cadastro de Aluno já Existente** | Anti-duplicidade 1:N contra galeria | `enroll_service.py` | $\cos \ge 0.68$ contra banco | `test_enroll_rejects_duplicate_against_existing_profile` | **VERIFIED** |
| **Distorção por Desfoque / Tremido** | Operador Laplaciano (FIQA) | `liveness_service.py` | $\text{Var}(\Delta) \ge 30.0$ | `test_laplacian_variance_rejects_blurred_face` | **VERIFIED** |
| **Ataque com Foto Monocromática P&B** | Dispersão cromática RGB | `liveness_service.py` | $\sum \|c_i - c_j\| \ge 6.0$ | `test_chromatic_dispersion_rejects_grayscale` | **VERIFIED** |
| **Desvio de Distribuição Demográfica (Fairness)** | Avaliação de FNMR/FMR segundo NIST AI RMF | `scripts/audit_demographic_fairness.py` | $\Delta = 0.8682$ margem de separabilidade | Execução automatizada com fixture de embeddings sintéticos | **VERIFIED** |

---

## 3. Rastreabilidade de Supply Chain, SRE e Governança

| Requisito Operacional | Solução Implementada | Localização | Evidência de Validação | Status |
|---|---|---|---|:---:|
| **Lockfile com Hashes Criptográficos** | `requirements.lock` gerado com hashes SHA-256 para todas as dependências | `backend/requirements.lock` | Inspeção de integridade no build do container | **VERIFIED** |
| **Container Multi-Stage sem Compiladores** | Dockerfile com estágio `builder` (compilação) e estágio final `runner` com `appuser` (UID 1000) | `backend/Dockerfile` | Dockerfile auditado e sem ferramentas de build em runtime | **VERIFIED** |
| **Pinning de Checksum dos Modelos de IA** | Script de download com hash SHA-256 verificado antes de armazenar em cache | `backend/scripts/download_models.py` | Validação de digests SHA-256 | **VERIFIED** |
| **Expurgo de Dados LGPD (>90 dias)** | Endpoint administrativo e rotina de purge automático de logs biométricos | `backend/app/routers/maintenance.py` | `test_maintenance_cleanup_purges_old_logs` | **VERIFIED** |
| **Simulação de DR e Restauração de Banco** | Script de teste automatizado de restore e consistência de tabelas vetoriais | `scripts/restore_drill.py` | Verificação de conectividade e contagem de tuplas | **VERIFIED** |
