# AILAB-FACIAL V5 — FLUXO DE DADOS & FRONTEIRAS DE CONFIANÇA
**Banca Técnica Multidisciplinar Nível Principal/Staff**  
**Data:** 13 de Setembro de 2026 | **Versão:** V5 Definitiva  
**Status:** 100% AUDITADO E MITIGADO  

---

## 1. Diagrama de Fluxo de Dados Ponta a Ponta (V5)

```mermaid
sequenceDiagram
    autonumber
    actor Aluno as Aluno / Bolsista
    participant Tablet as Tablet Kiosk (Expo)
    participant CloudRun as Backend (FastAPI / Cloud Run)
    participant Pipeline as Pipeline Biométrico (InsightFace + MiniFASNet)
    participant Supabase as Banco Supabase (pgvector + RLS)
    participant Painel as Dashboard Web (Tutores)

    Note over Aluno,Tablet: 1. Handshake Criptográfico Anti-Injeção
    Aluno->>Tablet: Aproxima-se do totem de entrada
    Tablet->>CloudRun: POST /api/v1/recognize/challenge (com X-Kiosk-Key)
    CloudRun->>CloudRun: Gera nonce UUIDv4 + carimbo iat/exp com HMAC-SHA256
    CloudRun-->>Tablet: Retorna JSON { challenge_id, expires_at, ttl_seconds: 30 }

    Note over Tablet,CloudRun: 2. Captura Vinculada e Despacho
    Tablet->>Tablet: Dispara captura da câmera frontal (2 frames)
    Tablet->>CloudRun: POST /api/v1/recognize (Multipart: frames + challenge_id + X-Challenge-Token)

    Note over CloudRun,CloudRun: 3. Validações de Borda (Fail-Closed)
    CloudRun->>CloudRun: Rate Limit (max 60 req/min) & Semáforo de Concorrência
    CloudRun->>CloudRun: Valida assinatura HMAC do challenge_id e consome nonce no cache
    CloudRun->>CloudRun: Inspeciona Magic Bytes (JPEG/PNG/WebP) e limites de dimensão

    Note over CloudRun,Pipeline: 4. Inferência Biométrica Server-Side
    CloudRun->>Pipeline: Offload para threadpool via asyncio.to_thread
    Pipeline->>Pipeline: SCRFD Detecção + FIQA Laplaciano (rejeita blur)
    Pipeline->>Pipeline: MiniFASNetV2 PAD (rejeita spoof se live_score < 0.45)
    Pipeline->>Pipeline: ArcFace: Extrai embedding 512-D normalizado L2

    Note over CloudRun,Supabase: 5. Pareamento & Persistência (service_role)
    CloudRun->>Supabase: RPC match_face(query_embedding, match_threshold=0.38)
    Supabase-->>CloudRun: Retorna candidato com menor distância cosseno (<=>)
    CloudRun->>CloudRun: Aplica decisão em 3 Zonas (Aceite ≥0.68 | Incerto 0.62-0.68 | Rejeição <0.62)
    CloudRun->>Supabase: INSERT face_logs & executa register_event() (com histerese de 60s)
    Supabase-->>CloudRun: Confirma registro da sessão

    CloudRun-->>Tablet: Responde JSON (recognized: true, name, event: check_in)
    Tablet->>Aluno: Feedback visual e sonoro imediato

    Note over Supabase,Painel: 6. Relatórios Administrativos com Blindagem Contábil
    Painel->>Supabase: SELECT * FROM sessions (autenticado Supabase Auth, role=tutor)
    Supabase-->>Painel: Retorna sessões (incluindo voided_at)
    Painel->>Painel: aggregate.ts impõe 0h para sessões com voided_at (sem checkout)
```

---

## 2. Análise Detalhada das Fronteiras de Confiança (Trust Boundaries)

### Fronteira TB-1: Sensor Físico $\rightarrow$ App Móvel (Tablet Kiosk)
- **Quem controla o dado?** O hardware do tablet Android e o ambiente físico do laboratório.
- **Controles V5:** Detecção ativa de spoofing facial via MiniFASNetV2 no servidor, descartando fotos em papel, telas digitais ou réplicas 2D antes da comparação de identidade.
- **Canal Duplo de Comunicação:**
  - **Canal 1 (Kiosk):** Utiliza `X-Kiosk-Key` exclusivamente para inferência biométrica, desafio temporal e leitura de horas do próprio integrante pós-checkin.
  - **Canal 2 (Tutor):** Operações de matrícula em `/enroll` exigem login nominal no Supabase Auth (`tutorToken`) com perfil de tutor confirmado no backend. A chave mestra foi extirpada do aplicativo móvel.

### Fronteira TB-2: App Móvel / Cliente Web $\rightarrow$ Backend FastAPI (Rede Externa)
- **Quem controla o dado?** O cliente (considerado não-confiável).
- **Controles V5:**
  - **Desafio Temporal Criptográfico:** Token HMAC-SHA256 obrigatório com TTL de 30s e invalidação atômica de uso único, impedindo gravação e replay de frames via `curl`.
  - **Rate Limiting:** Janela deslizante de 60 requisições por minuto por quiosque/IP.
  - **Semáforo Assíncrono:** Teto de 10 inferências concorrentes simultâneas por worker contra ataques de exaustão de CPU.
  - **Validação de Assinatura Binária (Magic Bytes):** Bloqueio de arquivos corrompidos ou maliciosos (JPEG `\xff\xd8\xff`, PNG `\x89PNG`, WebP `RIFF...WEBP`) antes de qualquer processamento pesado.

### Fronteira TB-3: Backend FastAPI $\rightarrow$ Banco de Dados Supabase (Service Role)
- **Quem controla o dado?** O processo do backend FastAPI.
- **Controles V5:** Conexão HTTPS/TLS criptografada; uso restrito da `SUPABASE_SERVICE_KEY`; índice parcial UNIQUE impedindo sessões duplicadas abertas para o mesmo integrante.

### Fronteira TB-4: Banco de Dados Supabase $\rightarrow$ Clientes Anônimos e Autenticados (PostgREST Direto)
- **Quem controla o dado?** O banco de dados PostgreSQL aplicando Row Level Security (RLS).
- **Controles V5:**
  - RLS forçado em todas as tabelas (`profiles`, `sessions`, `face_embeddings`, `face_logs`).
  - Políticas sincronizadas entre `schema.sql` e a migração 05: escrita restrita a usuários com `(auth.jwt() -> 'app_metadata' ->> 'role') = 'tutor'`.
  - Embeddings faciais inacessíveis para leitura ou escrita externa de usuários `anon` e `authenticated`.

---

## 3. Rastreabilidade de Retenção e Descarte de Dados (Conformidade LGPD Art. 16)

| Estágio do Dado | Onde Vive | Tempo de Retenção | Nível de Proteção | Status V5 |
|---|---|---|---|:---:|
| **Frame Bruto de Câmera** | Memória RAM volátil | Duração da requisição HTTP ($\approx 120-250$ ms) | Nunca gravado em disco; descartado imediatamente após extração | **CONFORME** |
| **Vetor Biométrico (Embedding 512-D)** | Tabela `face_embeddings` | Permanente enquanto o titular for membro ativo | Isolado por RLS estrito (sem políticas de leitura pública) | **CONFORME** |
| **Log Facial de Auditoria** | Tabela `face_logs` | **Máximo de 90 dias** (Expurgo automático) | Rotina periódica `purge_old_face_logs()` em `/maintenance/cleanup` | **CONFORME** |
| **Registros de Presença** | Tabela `sessions` | Permanente (histórico acadêmico) | Sessões abandonadas registram `voided_at` e contabilizam 0h | **CONFORME** |
