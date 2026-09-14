# AILAB-FACIAL V4 — INVARIANTES DE SEGURANÇA E REGRAS DE NEGÓCIO

**Data:** 13 de Setembro de 2026  
**Auditoria:** AILAB-FACIAL V4  
**Status:** AUDITED  

---

## 1. Matriz de Invariantes Críticos

| ID do Invariante | Definição da Regra / Propriedade Inegociável | Onde é Aplicada (Enforcement) | Cobertura em Banco | Cobertura em Backend | Cobertura em Client | Teste Automatizado | Status / Veredito |
|---|---|---|:---:|:---:|:---:|:---:|:---:|
| **INV-01** | **Identidade não pode ser definida pelo cliente:** O client envia apenas imagens brutas; o backend determina o `profile_id` resultante. | Backend (`face_service.py` / `recognize.py`) | ❌ | ✅ | ❌ | `test_biometrics.py` | **VERIFIED** |
| **INV-02** | **Unicidade de Sessão Aberta:** Um perfil não pode possuir mais de uma sessão com `check_out IS NULL` simultaneamente. | Banco (`idx_sessions_profile_single_open`) | ✅ | ✅ | ❌ | `test_register_event_handles_concurrent_insert_collision` | **VERIFIED** |
| **INV-03** | **Anti-Flip-Flop (Histerese Temporal):** Um perfil não pode alternar entre entrada e saída em intervalo menor que `debounce_seconds` (60s). | Backend (`session_service.py`) | ❌ | ✅ | ❌ | `test_register_event_debounce_prevents_flip_flop` | **VERIFIED** |
| **INV-04** | **Sessões Esquecidas Anuladas contam 0 horas:** Registros encerrados com `voided_at IS NOT NULL` não podem somar horas de presença. | Banco (`duration_s` gerada) / Frontend / Backend | ⚠️ Parcial | ✅ (`total_hours`) | ❌ (`aggregate.ts`) | Ausente no frontend | **VULNERABLE (F-001)** |
| **INV-05** | **Consentimento LGPD Obrigatório para Cadastro:** Nenhum perfil pode ser criado sem `consent_given = true` e registro de timestamp. | Backend (`enroll_service.py`) | ❌ | ✅ | ✅ | `test_security_lgpd.py` | **VERIFIED** |
| **INV-06** | **Segregação de Privilégios no Cadastro:** Apenas usuários autenticados com `role = 'tutor'` podem cadastrar novos membros ou alterar biometria. | Backend (`deps.py:verify_tutor_token`) | ❌ | ✅ | ✅ (`TutorPinModal`) | `test_enroll_endpoint_rejects_kiosk_key` | **VERIFIED** |
| **INV-07** | **Isolamento de Biometria contra Clientes:** Chaves `anon` ou usuários comuns não podem consultar `face_embeddings`. | Banco (RLS sem policy para anon/auth) | ✅ | ✅ | N/A | `test_security_lgpd.py` | **VERIFIED** |
| **INV-08** | **Anti-Duplicidade 1:N no Cadastro:** O sistema não pode cadastrar um rosto se houver match com similaridade $\ge 0.68$ contra a base ativa. | Backend (`enroll_service.py:_check_1_to_n_duplicate`) | ❌ | ✅ | ❌ | `test_enroll_rejects_duplicate_face_1_to_n` | **VERIFIED** |
| **INV-09** | **Consistência Intra-Burst:** Todas as fotos do burst de cadastro devem pertencer à mesma face ($dist \le 0.70$ par a par). | Backend (`enroll_service.py:_validate_intra_burst_consistency`) | ❌ | ✅ | ❌ | `test_intra_burst_consistency_rejects_divergent_faces` | **VERIFIED** |
| **INV-10** | **Proteção contra Troca de Identidade:** `refresh-embedding` não pode atualizar a biometria de Alice com a foto de Bob. | Backend (`enroll_service.py:_guard_against_identity_swap`) | ❌ | ✅ | ❌ | `test_refresh_embedding_rejects_identity_swap` | **VERIFIED** |
| **INV-11** | **Exclusão de Titular Expulsa Biometria:** A deleção ou revogação de consentimento deve expurgar imediatamente os embeddings do banco e do cache RAM. | Backend (`profiles.py` / `face_service.py`) | ⚠️ (Cascade) | ✅ | ❌ | `test_delete_profile_success`, `test_revoke_consent_success` | **VERIFIED** |
| **INV-12** | **Vinculação Temporal de Captura (Desafio/Nonce):** A captura deve conter evidência criptográfica de vivacidade e atualidade temporal. | Inexistente no sistema atual | ❌ | ❌ | ❌ | Inexistente | **VULNERABLE (F-002)** |

---

## 2. Análise Detalhada dos Invariantes Violados

### Violação Crítica do Invariante INV-04 (Cômputo de Horas de Presença)
- **Definição Teórica:** "Sessões marcadas como saída esquecida contam exatamente zero horas nos relatórios oficiais".
- **Implementação no Banco:** Em `schema.sql`:
  ```sql
  duration_s integer generated always as (
    case
      when check_out is not null and voided_at is null then
        greatest(0, extract(epoch from (check_out - check_in))::integer)
      else null
    end
  ) stored
  ```
  Quando `voided_at IS NOT NULL`, `duration_s` é forçado a `NULL`.
- **Implementação no Backend:** Em `session_service.py`:
  ```python
  q = db.table("sessions").select("check_in, check_out").is_("voided_at", "null")
  ```
  O backend ignora sessões anuladas com sucesso.
- **Falha no Frontend Web:** Em `web/src/lib/aggregate.ts`:
  ```ts
  function sessionSeconds(session: SessionRecord, now: Date): number {
    if (session.durationS != null) return session.durationS;
    if (session.checkOut != null) {
      const closedElapsed = Math.floor(
        (new Date(session.checkOut).getTime() - new Date(session.checkIn).getTime()) / 1000
      );
      return Math.max(0, closedElapsed);
    }
  ```
  Como `session.durationS` é `null`, o frontend cai diretamente no segundo `if`, recomputando a diferença inteira entre `check_out` e `check_in`! O invariante é completamente quebrado na interface gráfica utilizada pelos tutores para certificar horas.

### Violação Crítica do Invariante INV-12 (Vinculação de Captura e Desafio)
- **Definição Teórica:** "Nenhuma decisão biométrica pode ser validada se o payload de captura não demonstrar vínculo estrito a um desafio efêmero emitido pelo servidor na sessão atual".
- **Falha no Sistema:** O endpoint `/api/v1/recognize` é stateless e aceita requisições avulsas sem prévia geração de nonce. Qualquer requisição HTTP forjada com uma imagem válida colhe o mesmo efeito de uma captura presencial legítima na câmera física.
