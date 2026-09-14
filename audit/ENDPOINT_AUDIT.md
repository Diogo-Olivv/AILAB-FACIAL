# AILAB-FACIAL V4 — AUDITORIA ENDPOINT POR ENDPOINT

**Data:** 13 de Setembro de 2026  
**Auditoria:** AILAB-FACIAL V4  
**Framework:** OWASP API Security Top 10 / ASVS 5.0.0  
**Status:** AUDITED  

---

## 1. Matriz Consolidada de Endpoints da API

| Método | Endpoint | Autenticação Exigida | Autorização / Role | Validação de Entrada | Limite de Arquivo / Recursos | Efeito no Banco (Mutações) | Veredito Técnico |
|---|---|---|---|---|---|---|:---:|
| `GET` | `/health` | Nenhuma | Pública | N/A | N/A | Nenhuma | **VERIFIED** |
| `GET` | `/health/ready` | Nenhuma | Pública | N/A | N/A | Nenhuma (leitura de variável global) | **VERIFIED** |
| `POST` | `/api/v1/recognize` | `verify_kiosk_key` (`X-Kiosk-Key` ou fallback `X-API-Key`) | Kiosk do Tablet | Multipart (frame/frames), `validate_image` | Até 5 frames, máx 5 MB cada. Sem restrição de dimensões em pixels. | `INSERT face_logs`<br>`INSERT/UPDATE sessions` | **VULNERABLE (F-002, F-005, Decompress Bomb)** |
| `GET` | `/api/v1/sessions/open` | `verify_api_key` (`X-API-Key`) | Legado / Admin | N/A | N/A | `SELECT sessions WHERE check_out IS NULL` | **VERIFIED** |
| `POST` | `/api/v1/sessions/close-stale` | `verify_api_key` (`X-API-Key`) | Admin / Cron legado | N/A | N/A | `UPDATE sessions SET voided_at=now(), check_out=now()` | **PARTIALLY MITIGATED** |
| `GET` | `/api/v1/sessions/stats/{profile_id}` | `verify_api_key` (`X-API-Key`) | Legado / Admin | `profile_id` (UUID no path), query params `year`, `month` | N/A | `SELECT sessions WHERE profile_id=...` | **VULNERABLE (F-004: Incompatibilidade de Header)** |
| `POST` | `/api/v1/enroll` | `verify_tutor_token` (Bearer JWT Supabase Auth) | `role == 'tutor'` em `app_metadata` | Form: `name`, `matricula`, `consent`. Files: `frames` (3 a 5 imagens). | Máx 5 fotos, 5 MB cada. | `INSERT profiles`<br>`INSERT face_embeddings` | **VERIFIED** |
| `GET` | `/api/v1/profiles/{profile_id}` | `verify_api_key` (`X-API-Key`) | Legado / Admin | `profile_id` no path | N/A | `SELECT profiles WHERE id=...` | **PARTIALLY MITIGATED (BOLA / Enumeração)** |
| `POST` | `/api/v1/profiles/{profile_id}/refresh-embedding` | `verify_tutor_token` (Bearer JWT Supabase Auth) | `role == 'tutor'` em `app_metadata` | `profile_id` no path; `frames` (3 a 5 fotos). | Máx 5 fotos, 5 MB cada. | `UPDATE/INSERT face_embeddings` | **VERIFIED** |
| `POST` | `/api/v1/profiles/{profile_id}/revoke-consent` | `verify_tutor_token` (Bearer JWT Supabase Auth) | `role == 'tutor'` em `app_metadata` | `profile_id` no path | N/A | `UPDATE profiles SET consent_revoked_at=now()`<br>`DELETE face_embeddings` | **VERIFIED** |
| `DELETE` | `/api/v1/profiles/{profile_id}` | `verify_tutor_token` (Bearer JWT Supabase Auth) | `role == 'tutor'` em `app_metadata` | `profile_id` no path | N/A | `DELETE face_embeddings`<br>`DELETE face_logs`<br>`DELETE profiles` | **VERIFIED** |
| `POST` | `/api/v1/maintenance/cleanup` | `verify_cron_or_api_key` (Google OIDC Bearer ou `X-API-Key`) | Cloud Scheduler SA autorizada ou Admin | N/A | N/A | `UPDATE sessions` (sweep de saídas esquecidas) | **VERIFIED** |

---

## 2. Auditoria Individual de Vulnerabilidades OWASP API Top 10

### 2.1 API1:2023 — Broken Object Level Authorization (BOLA)
- **Endpoint:** `GET /api/v1/profiles/{profile_id}` e `GET /api/v1/sessions/stats/{profile_id}`.
- **Análise:** O endpoint aceita qualquer `profile_id` fornecido pelo cliente e valida apenas a posse da chave de API genérica compartilhada. Qualquer cliente com a chave pode iterar sobre UUIDs e coletar o nome, matrícula institucional e histórico acumulado de horas de qualquer integrante.
- **Remediação:** Exigir `verify_tutor_token` para consulta administrativa de perfil ou vincular o token do próprio aluno autenticado.

### 2.2 API2:2023 — Broken Authentication
- **Endpoint:** `/api/v1/sessions/stats/{profile_id}` vs. `mobile/lib/api.ts`.
- **Análise:** O cliente móvel (`api.ts#L130`) tenta consumir a rota enviando `X-Kiosk-Key`. O backend (`recognize.py#L89`) exige `verify_api_key` (`X-API-Key`). Há colapso de autenticação em produção: os tablets receberão 401 Unauthorized para todas as consultas de horas de alunos.
- **Remediação:** Atualizar a rota para aceitar `verify_kiosk_key`.

### 2.3 API3:2023 — Broken Object Property Authorization
- **Endpoint:** `POST /api/v1/enroll`.
- **Análise:** O endpoint recebe parâmetros de formulário e constrói explicitamente o payload do Supabase com campos autorizados (`name`, `matricula`, `consent_given`, `consent_at`). Não há vulnerabilidade de Mass Assignment no endpoint FastAPI.

### 2.4 API4:2023 — Unrestricted Resource Consumption
- **Endpoint:** `POST /api/v1/recognize` e `POST /api/v1/enroll`.
- **Análise:** A função `validate_image` em `deps.py` valida apenas o tamanho em bytes (`size <= 5 MB`) e o tipo MIME. No entanto, não há verificação da resolução geométrica da imagem antes de invocar `Image.open().convert("RGB")`. Uma imagem JPEG válida de 3 MB descompactada com dimensões de 16.000 x 16.000 pixels pode forçar a alocação de mais de 768 MB de RAM por frame, provocando OOM crash no Cloud Run quando múltiplos frames são processados simultaneamente.
- **Remediação:** Inspecionar os cabeçalhos de imagem com `PIL.Image.open` usando modo preguiçoso (sem carregar os pixels) e rejeitar imagens com largura ou altura superiores a 2.500 pixels.

### 2.5 API5:2023 — Broken Function Level Authorization (BFLA)
- **Endpoint:** `POST /api/v1/maintenance/cleanup`.
- **Análise:** O endpoint está adequadamente protegido por `verify_cron_or_api_key`. A validação OIDC rejeita tokens que não correspondam à audiência `settings.service_url` e ao e-mail da Service Account configurada. O bypass legado sem verificação de assinatura foi completamente eliminado.
- **Status:** Mitigado com sucesso.
