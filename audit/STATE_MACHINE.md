# AILAB-FACIAL V5 — AUDITORIA DA MÁQUINA DE ESTADOS DE SESSÕES & ENROLLMENT
**Banca Técnica Multidisciplinar Nível Principal/Staff**  
**Data:** 13 de Setembro de 2026 | **Versão:** V5 Definitiva  
**Status:** 100% VERIFIED & HARDENED  

---

## 1. Diagrama de Transição de Estados da Presença (V5)

```mermaid
stateDiagram-v2
    [*] --> FORA_DO_LAB: Estado Inicial

    FORA_DO_LAB --> PRESENTE: Reconhecido (cos ≥ 0.68) + Desafio HMAC Válido\n[Gera nova linha em sessions com check_in=now]
    FORA_DO_LAB --> FORA_DO_LAB: Ação Check-out explícita para quem não entrou\n[Rejeitado: 'not_in']

    PRESENTE --> FORA_DO_LAB: Reconhecido (cos ≥ 0.68) + Desafio HMAC Válido (> 60s)\n[Atualiza linha com check_out=now]
    PRESENTE --> PRESENTE: Ação Check-in explícita para quem já está dentro\n[Rejeitado: 'already_in']

    PRESENTE --> PRESENTE: Requisição dentro da histerese (< 60s)\n[Rejeitado: 'debounced']
    FORA_DO_LAB --> FORA_DO_LAB: Requisição dentro da histerese (< 60s)\n[Rejeitado: 'debounced']

    PRESENTE --> ANULADA_SAIDA_ESQUECIDA: Tempo aberto >= max_session_hours (10h)\n[Acionado por Sweep diário ou reentrada]\n[Define voided_at=now, auto_closed=true]

    ANULADA_SAIDA_ESQUECIDA --> PRESENTE: Aluno retorna após abandono\n[Abre nova sessão limpa; anterior computa 0h]

    PRESENTE --> [*]: Exclusão do Perfil (LGPD Delete CASCADE)
    FORA_DO_LAB --> [*]: Exclusão do Perfil (LGPD Delete CASCADE)
```

---

## 2. Diagrama de Transição do Fluxo de Cadastro Biométrico (Enrollment)

```mermaid
stateDiagram-v2
    [*] --> KIOSK_IDLE: Tablet na Entrada
    KIOSK_IDLE --> TUTOR_AUTH_REQUIRED: Clique em "Cadastrar Novo Integrante"
    
    state TUTOR_AUTH_REQUIRED {
        [*] --> MODAL_PIN_LOGIN: Exibe TutorPinModal
        MODAL_PIN_LOGIN --> SUPABASE_AUTH: Submete e-mail institucional + senha
        SUPABASE_AUTH --> CHECK_ROLE: Retorna JWT Session
        CHECK_ROLE --> TOKEN_GRANTED: app_metadata.role === 'tutor'
        CHECK_ROLE --> AUTH_REJECTED: role !== 'tutor' (Erro 403)
    }

    AUTH_REJECTED --> KIOSK_IDLE: Retorna à tela inicial
    TOKEN_GRANTED --> ENROLLMENT_FORM: Navega para /enroll passando tutorToken
    
    ENROLLMENT_FORM --> KIOSK_IDLE: Navegação direta sem tutorToken (Bloqueado/Redirect)
    ENROLLMENT_FORM --> ENROLLMENT_BURST_CAPTURE: Preenche Nome, Matrícula, Consentimento
    
    ENROLLMENT_BURST_CAPTURE --> BACKEND_VALIDATION: Envia 3-5 fotos + Bearer tutorToken
    
    state BACKEND_VALIDATION {
        [*] --> CHECK_MAGIC_BYTES: Valida assinaturas binárias (JPEG/PNG)
        CHECK_MAGIC_BYTES --> CHECK_BURST_CONSISTENCY: Distância entre pares ≤ 0.70
        CHECK_BURST_CONSISTENCY --> CHECK_1_TO_N: Previne duplicidade de identidade na galeria
        CHECK_1_TO_N --> PERSIST_DUAL_VECTORS: Grava embedding inicial no Supabase
    }

    BACKEND_VALIDATION --> ENROLL_SUCCESS: HTTP 200 (Cadastro concluído)
    ENROLL_SUCCESS --> KIOSK_IDLE: Token descartado da memória transitória
```

---

## 3. Diagrama de Decisão Biométrica em 3 Zonas (Reconhecimento Facial)

```mermaid
stateDiagram-v2
    [*] --> CAPTURE_FRAME: Disparo da Câmera
    CAPTURE_FRAME --> REQUEST_CHALLENGE: Solicita Desafio (/recognize/challenge)
    REQUEST_CHALLENGE --> VERIFY_CHALLENGE: Backend valida HMAC e carimbo (TTL 30s)
    
    VERIFY_CHALLENGE --> REJECT_403: Desafio ausente, expirado ou forjado
    VERIFY_CHALLENGE --> CONSUME_NONCE: Consome nonce em cache atômico anti-replay
    
    CONSUME_NONCE --> PAD_INFERENCE: MiniFASNetV2 Anti-Spoofing
    PAD_INFERENCE --> REJECT_SPOOF: Liveness Score < 0.45 ('spoof_detected')
    
    PAD_INFERENCE --> VECTOR_MATCH: Consulta RPC match_face (pgvector HNSW)
    
    VECTOR_MATCH --> ACCEPT_RECOGNIZED: cos ≥ 0.68 (dist ≤ 0.80) [status: ok]
    VECTOR_MATCH --> UNCERTAIN_PROMPT: 0.62 ≤ cos < 0.68 [status: uncertain, sem PII e sem scores]
    VECTOR_MATCH --> COLD_REJECT: cos < 0.62 [status: not_recognized, sem PII e sem scores]
```

---

## 4. Auditoria das Transições de Estado

| Transição | Gatilho | Pré-condição | Efeito no Banco de Dados | Veredito V5 |
|---|---|---|---|:---:|
| **T1: Entrada Regular** | Reconhecimento com $\cos \ge 0.68$ + Desafio HMAC | Sem sessão aberta; intervalo $> 60$ s | `INSERT INTO sessions (profile_id, check_in) VALUES (id, now())` | **VERIFIED** |
| **T2: Saída Regular** | Reconhecimento com $\cos \ge 0.68$ + Desafio HMAC | Sessão aberta existente; intervalo $> 60$ s | `UPDATE sessions SET check_out = now() WHERE id = sess_id` | **VERIFIED** |
| **T3: Histerese (Debounce)** | Tentativa repetida em janela curta | Intervalo $< 60$ s do último evento | Nenhuma mutação; retorna `debounced` com tempo restante | **VERIFIED** |
| **T4: Saída Esquecida (Sweep)** | Rotina periódica `/maintenance/cleanup` | Sessão aberta há $\ge 10$ h | `UPDATE sessions SET check_out = now(), voided_at = now(), auto_closed = true` | **VERIFIED (0h)** |
| **T5: Reentrada com Sessão Stale** | Aluno retorna no dia seguinte | Sessão anterior aberta há $\ge 10$ h | Executa T4 (anula anterior com 0h) e T1 (abre nova) atomicamente | **VERIFIED** |
| **T6: Matrícula Biométrica** | Submissão de fotos em `/enroll` | `tutorToken` válido com claim `role=tutor` | `INSERT INTO profiles ...; INSERT INTO face_embeddings ...` | **VERIFIED** |
