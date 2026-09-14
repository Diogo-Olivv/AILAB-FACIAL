# AILAB-FACIAL V4 — MATRIZ DE RASTREABILIDADE TÉCNICA

**Data:** 13 de Setembro de 2026  
**Auditoria:** AILAB-FACIAL V4  
**Status:** AUDITED  

---

## 1. Rastreabilidade de Requisitos de Segurança (Threat $\rightarrow$ Objective $\rightarrow$ Control $\rightarrow$ Implementation $\rightarrow$ Test)

| Ameaça Modelada | Objetivo de Segurança | Controle de Engenharia | Arquivo / Implementação | Teste Automatizado | Resultado da Auditoria |
|---|---|---|---|---|:---:|
| **Reconhecimento não autorizado via fotos 2D** | Impedir aceitação de ataques de apresentação de fotos impressas. | Pipeline PAD com rede MiniFASNetV2 e análise cromática. | `backend/app/services/liveness_service.py` | `test_check_image_quality`, `test_liveness_disabled_toggle` | **PARTIALLY MITIGATED** (Eficaz contra papel fosco; vulnerável a telas OLED). |
| **Injeção de fotos por atacante remoto** | Garantir que a imagem provém de uma captura ao vivo no tablet. | Inexistente (requer Nonce / Desafio de Captura). | Não implementado | Nenhum | **VULNERABLE (F-002)** |
| **Bypass de cadastro por aluno malicioso** | Exigir autorização docente para cadastrar novos integrantes. | Validação de JWT Supabase com role `tutor`. | `backend/app/deps.py:verify_tutor_token` | `test_enroll_endpoint_rejects_kiosk_key` | **VERIFIED** (Fail-closed implementado). |
| **Substituição de biometria de terceiro** | Impedir que a biometria de Alice seja associada a Bob. | Guarda de troca de identidade 1:N no refresh. | `backend/app/services/enroll_service.py:_guard_against_identity_swap` | `test_refresh_embedding_rejects_identity_swap` | **VERIFIED**. |
| **Adulteração de horas por aluno esquecido** | Anular sessões com abandono de saída (0 horas). | Marcação de `voided_at` no banco e supressão no front. | `session_service.py` (back) / `aggregate.ts` (front) | `total_hours` no back; ausente no front | **VULNERABLE (F-001)** (Front calcula as horas). |
| **Vazamento de vetores biométricos** | Proteger templates faciais contra vazamento em clientes. | Row Level Security no PostgreSQL (PostgREST). | `backend/schema.sql` (tabela `face_embeddings`) | `test_security_lgpd.py` | **VERIFIED** (Sem policy para anon). |
| **Exaustão de memória no Cloud Run** | Evitar crash por parsing de imagens excessivamente grandes. | Validação de tamanho e tipos de arquivo. | `backend/app/deps.py:validate_image` | `test_validate_image_rejects_large_files` | **PARTIALLY MITIGATED** (Bytes limitados a 5MB, mas sem limite de pixels). |

---

## 2. Rastreabilidade de Controles Biométricos (Biometric Control Traceability)

| Risco Biométrico | Controle Específico | Componente Responsável | Métrica / Limiar | Evidência de Execução | Resultado Técnico |
|---|---|---|:---:|---|:---:|
| **Falsos Positivos por Distância Frouxa** | Limiar euclidiano calibrado | `face_service.py` | $dist \le 0.80$ ($\cos \ge 0.68$) | Linha 442 e teste matemático de equivalência | **VERIFIED** |
| **Falsos Positivos por Zona Cinzenta** | Zona incerta para second-factor | `face_service.py` | $0.62 \le \cos < 0.68$ | Linha 459 e retorno `status='uncertain'` | **VERIFIED** |
| **Mistura de Faces no Cadastro** | Consistência intra-burst | `enroll_service.py` | $dist \le 0.70$ par a par | Linha 50 e `test_intra_burst_consistency...` | **VERIFIED** |
| **Cadastro de Aluno já Existente** | Anti-duplicidade 1:N | `enroll_service.py` | $\cos \ge 0.68$ contra galeria | Linha 83 e `test_enroll_rejects_duplicate...` | **VERIFIED** |
| **Distorção por Desfoque / Tremido** | Operador Laplaciano (FIQA) | `liveness_service.py` | $\text{Var}(\Delta) \ge 30.0$ | Linha 103 e `test_laplacian_variance...` | **VERIFIED** |
| **Ataque com Foto Monocromática P&B** | Dispersão cromática RGB | `liveness_service.py` | $\sum |c_i - c_j| \ge 6.0$ | Linha 251 | **VERIFIED** |
