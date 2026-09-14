# AILAB-FACIAL V4 — CATÁLOGO EXAUSTIVO DE FINDINGS

**Data:** 13 de Setembro de 2026  
**Auditoria:** AILAB-FACIAL V4  
**Total de Findings Documentadas:** 14 achados estruturados  

---

## [FINDING-001] — Inflação de Horas em Sessões Esquecidas no Dashboard Web

- **Type:** BUG
- **Severity:** CRITICAL
- **Priority:** P0
- **Confidence:** HIGH
- **Evidence Grade:** E2 (Evidência Estática Direta) & E4 (Reprodução Local)
- **Status:** VULNERABLE
- **Category:** Business Logic Flaw / Data Integrity
- **Location:** `web/src/lib/aggregate.ts:L13-L23` e `web/src/lib/reports.ts:L33-L47`
- **Affected Component:** Painel Web dos Tutores (Módulo de Relatórios e Cômputo de Horas)
- **Related Threat:** Fraude no cômputo de horas acadêmicas de extensão; alunos recebendo créditos por horas não trabalhadas.
- **Related Invariant:** INV-04 ("Sessões com saída esquecida anuladas devem computar exatamente 0 horas").
- **Root Cause:** O backend anula sessões abandonadas definindo `voided_at = now()`. No PostgreSQL, a coluna gerada `duration_s` é calculada como `CASE WHEN check_out IS NOT NULL AND voided_at IS NULL THEN ... ELSE NULL END`. Quando `voided_at` é preenchido, `duration_s` retorna `NULL`. No entanto, a query `fetchSessions` no frontend web não seleciona o campo `voided_at`, e a função de cálculo `sessionSeconds` em `aggregate.ts` possui uma cláusula de fallback `if (session.checkOut != null)` que recalcula `checkOut - checkIn` quando `durationS` é nulo.
- **Precondition:** O aluno entra no laboratório, não registra saída e aguarda o sweep automático da meia-noite (ou dias posteriores).
- **Attacker-Controlled Input:** Momento da entrada e omissão da saída.
- **Failure Mechanism:** Ao omitir o check-out, a sessão é encerrada pelo sweep. O tutor visualiza o dashboard web acreditando que o sistema anulou as horas, mas a interface web recomputa a diferença entre o check-out do sweep e o check-in original, atribuindo de 10 a 72+ horas fraudulentas ao integrante.
- **Evidence:**
  - Código em `web/src/lib/aggregate.ts:13-20`:
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
- **Exploitability:** Trivial (basta esquecer de bater o ponto na saída).
- **Impact:** Fraude acadêmica material, corrupção da prestação de contas de bolsas e projetos de extensão.
- **Blast Radius:** Todos os integrantes que utilizam o laboratório e possuem sessões encerradas automaticamente.
- **Attack Path:** Aluno dá entrada às 08:00 $\rightarrow$ vai embora às 10:00 sem bater saída $\rightarrow$ às 00:00 o sweep anula a sessão $\rightarrow$ o dashboard web credita 16 horas de presença.
- **Reproduction:** Criar um objeto de sessão com `checkIn="2026-09-10T08:00:00Z"`, `checkOut="2026-09-11T00:00:00Z"`, `durationS=null`. Executar `sessionSeconds`. O resultado retornado é 57.600 segundos (16 horas), quando deveria ser 0.
- **Technical Remediation:**
  1. Alterar `web/src/lib/reports.ts` para incluir `voided_at` na consulta:
     ```ts
     .select("profile_id, check_in, check_out, duration_s, auto_closed, voided_at")
     ```
  2. Ajustar `web/src/lib/aggregate.ts` para verificar `session.voidedAt`:
     ```ts
     function sessionSeconds(session: SessionRecord, now: Date): number {
       if (session.voidedAt != null) return 0;
       if (session.durationS != null) return session.durationS;
       ...
     ```
- **Compensating Control:** O backend possui o método `total_hours` em `session_service.py` que filtra corretamente `voided_at is null`. Tutores podem consultar o endpoint da API diretamente enquanto o frontend não for corrigido.
- **Trade-offs:** Nenhum. A correção restaura o comportamento pretendido e documentado.
- **Residual Risk:** Baixo após revalidação.
- **Acceptance Criteria:**
  - **Given** uma sessão encerrada automaticamente com `voided_at` preenchido e `duration_s` nulo;
  - **When** o dashboard web carrega e agrega as horas do integrante;
  - **Then** a duração agregada atribuída a essa sessão deve ser estritamente zero segundos (0h 00m).
- **Regression Test:** Teste unitário em TypeScript validando que `sessionSeconds` com `voidedAt != null` retorna `0`.
- **Revalidation Method:** Build do frontend (`npm run build`) e inspeção de visualização com fixtures contendo sessões anuladas.

---

## [FINDING-002] — Injeção Digital Remota e Ausência de Desafio Temporal

- **Type:** DESIGN FLAW
- **Severity:** CRITICAL
- **Priority:** P0
- **Confidence:** HIGH
- **Evidence Grade:** E3 (Cadeia de Execução Correlacionada)
- **Status:** VULNERABLE
- **Category:** Biometric Decision Chain / Sensor Integrity
- **Location:** `backend/app/routers/recognize.py:L22-L67` e `mobile/components/RecognitionPanel.tsx:L31-L91`
- **Affected Component:** Pipeline de Entrada de Dados e Reconhecimento Facial
- **Related Threat:** Autenticação remota forjada de presença; marcação de ponto sem presença física real.
- **Related Invariant:** INV-12 ("Vinculação Temporal de Captura e Desafio").
- **Root Cause:** O endpoint `POST /api/v1/recognize` é completamente stateless e não exige um handshake prévio de desafio (nonce). Ele aceita qualquer arquivo multipart contendo imagem JPEG/PNG acompanhado da `KIOSK_API_KEY`. Como a chave do tablet está embutida no aplicativo cliente móvel (`EXPO_PUBLIC_KIOSK_KEY`), qualquer atacante com a chave pode fazer requests diretos ao Cloud Run.
- **Precondition:** O atacante extrai a chave do APK e possui fotos nítidas do rosto da vítima (ex: de perfis públicos no LinkedIn/Instagram).
- **Attacker-Controlled Input:** Arquivos de imagem enviados no payload multipart e cabeçalho `X-Kiosk-Key`.
- **Failure Mechanism:** O backend recebe os frames digitais injetados, submete ao detector SCRFD e ao modelo MiniFASNetV2. Se a foto for digitalmente limpa e de boa qualidade (ou se o atacante aplicar transformações de leve perturbação para atingir `live_prob >= 0.45`), o backend extrai o embedding de Alice e registra presença física para Alice, mesmo que ela esteja em outro país.
- **Evidence:** Ausência de qualquer parâmetro de desafio, timestamp assinado pelo cliente ou atestação de hardware no endpoint `recognize.py`.
- **Exploitability:** Alta para usuários técnicos e estudantes de exatas.
- **Impact:** Quebra completa do objetivo de segurança da biometria (provar presença física real).
- **Blast Radius:** Toda a galeria de integrantes cadastrados.
- **Attack Path:** `curl -X POST https://ailab-facial-api.../api/v1/recognize -H "X-Kiosk-Key: secret" -F "frame=@foto_alice.jpg"` $\rightarrow$ Check-in forjado gravado no banco.
- **Technical Remediation:**
  1. Implementar um fluxo de desafio em duas etapas:
     - `POST /api/v1/recognize/challenge`: Retorna um token de desafio criptográfico com TTL de 30 segundos (`challenge_id` assinado HMAC).
     - `POST /api/v1/recognize`: Exige o `challenge_id` no corpo e invalida o token após um único uso (one-time nonce).
  2. Implementar desafio de vivacidade dinâmico ativo no tablet (ex: piscar de olhos guiado ou rotação aleatória da cabeça solicitada pelo app durante o burst).
- **Compensating Control:** Câmera de segurança física no laboratório auditando o tablet e presença de tutores.
- **Trade-offs:** Aumento de latência no processo de captura ($\approx 50$ ms para obter o nonce).
- **Residual Risk:** Médio (mitiga injeções automatizadas sem presença física simultânea).
- **Acceptance Criteria:**
  - **Given** uma requisição de reconhecimento enviada sem um `challenge_id` válido e recente;
  - **When** a API processa a chamada;
  - **Then** a requisição deve ser rejeitada com HTTP 400/403.
- **Regression Test:** Teste de API rejeitando chamadas com nonce ausente, expirado ou reutilizado.
- **Revalidation Method:** Teste automatizado com `TestClient` simulando tentativa de replay de desafio.

---

## [FINDING-003] — Inversão de Parâmetro e Divergência Crítica na RPC `match_face`

- **Type:** BUG
- **Severity:** HIGH
- **Priority:** P0
- **Confidence:** HIGH
- **Evidence Grade:** E2 (Evidência Estática Direta)
- **Status:** VULNERABLE
- **Category:** Database Schema Drift / Biometric Threshold Inversion
- **Location:** `backend/schema.sql:L174-L204` vs. `backend/migrations/06_recalibrate_biometrics_hnsw.sql:L17-L45` vs. `backend/app/services/face_service.py:L314-L328`
- **Affected Component:** Supabase PostgreSQL RPC `match_face` & Serviço Facial Python
- **Related Threat:** Colapso da precisão biométrica em novas instalações, gerando falsos positivos massivos.
- **Related Invariant:** INV-01 ("Limiar calibrado estrito de reconhecimento").
- **Root Cause:** No `schema.sql`, a cláusula WHERE da RPC é `(1 - (fe.vec <=> query_embedding)) >= match_threshold` (interpretação de similaridade). Na migração 06, a cláusula é `(fe.vec <=> query_embedding) <= match_threshold` (interpretação de distância). O backend passa `max_distance = 0.38`. Se o schema autoritativo for executado, `0.38` é tratado como similaridade mínima, aceitando correspondências quase aleatórias ($\ge 38\%$).
- **Precondition:** Execução do arquivo `backend/schema.sql` em um ambiente novo ou restaurado.
- **Attacker-Controlled Input:** Imagem com face aleatória.
- **Failure Mechanism:** O banco retorna o candidato com similaridade de 0.40 como correspondente válido; a barreira de corte é rebaixada indevidamente.
- **Evidence:** Comparação direta das linhas de código SQL entre os dois arquivos versionados.
- **Exploitability:** Alta em caso de reimplantação ou uso de ambiente de staging.
- **Impact:** Destruição da confiabilidade do reconhecimento facial; impostores autenticados como integrantes.
- **Blast Radius:** Todas as chamadas de reconhecimento processadas via pgvector.
- **Technical Remediation:** Atualizar `backend/schema.sql` para adotar estritamente a convenção de distância cosseno da migração 06 (`(fe.vec <=> query_embedding) <= match_threshold`) e renomear o parâmetro para `max_distance` para evitar qualquer ambiguidade semântica.
- **Compensating Control:** O backend possui uma checagem secundária em Python (`if cosine_sim < settings.face_uncertain_cosine`), que atenua o impacto imediato, mas sobrecarrega o tráfego de dados e gera alertas espúrios de zona incerta.
- **Trade-offs:** Nenhum.
- **Residual Risk:** Nulo após sincronização.
- **Acceptance Criteria:**
  - **Given** uma chamada à RPC `match_face` com vetor de consulta e limiar de distância de 0.38;
  - **When** o PostgreSQL executa a query;
  - **Then** apenas registros com distância cosseno real $\le 0.38$ (similaridade $\ge 0.62$) devem ser retornados.
- **Regression Test:** Teste SQL verificando a definição de `pg_proc` para `match_face`.
- **Revalidation Method:** Inspeção estática de diff entre `schema.sql` e `06_recalibrate_biometrics_hnsw.sql`.

---

## [FINDING-004] — Incompatibilidade de Header de Autenticação em `/sessions/stats/{profile_id}`

- **Type:** BUG
- **Severity:** MEDIUM
- **Priority:** P1
- **Confidence:** HIGH
- **Evidence Grade:** E2 (Evidência Estática Direta)
- **Status:** VULNERABLE
- **Category:** API Authentication & Protocol Drift
- **Location:** `backend/app/routers/recognize.py:L89` e `mobile/lib/api.ts:L37-L40, L130-L141`
- **Affected Component:** Router de Reconhecimento e Cliente Móvel do Kiosk
- **Related Threat:** Quebra de funcionalidade de produção (Denial of Service funcional).
- **Related Invariant:** Separação de chaves de serviço.
- **Root Cause:** O app móvel foi parametrizado para enviar apenas `X-Kiosk-Key` em requisições de kiosk (`api.ts#L39`). Porém, o endpoint `/sessions/stats/{profile_id}` permaneceu com a dependência legada `verify_api_key` (que exige `X-API-Key` atrelado a `settings.api_key`).
- **Precondition:** Tablet em produção tentando consultar as horas acumuladas do integrante após o reconhecimento.
- **Attacker-Controlled Input:** N/A (defeito operacional).
- **Failure Mechanism:** O tablet recebe resposta HTTP 401 Unauthorized e falha ao exibir as horas para o integrante.
- **Evidence:**
  - `backend/app/routers/recognize.py:89`: `@router.get("/sessions/stats/{profile_id}", dependencies=[Depends(verify_api_key)])`
  - `mobile/lib/api.ts:130-141`: usa `request<SessionStats>` sem `tutorToken`, enviando `X-Kiosk-Key`.
- **Exploitability:** N/A (falha de disponibilidade funcional).
- **Impact:** Experiência de uso degradada; indisponibilidade de métricas de permanência no tablet.
- **Blast Radius:** Todos os integrantes do laboratório ao consultarem estatísticas no tablet.
- **Technical Remediation:** Alterar a dependência da rota `/sessions/stats/{profile_id}` em `recognize.py` para `verify_kiosk_key`.
- **Compensating Control:** Manter `API_KEY` com o mesmo valor de `KIOSK_API_KEY` provisoriamente no Cloud Run.
- **Trade-offs:** Nenhum.
- **Residual Risk:** Nulo após correção.
- **Acceptance Criteria:**
  - **Given** uma requisição GET para `/api/v1/sessions/stats/{profile_id}` enviando o header `X-Kiosk-Key`;
  - **When** o backend avalia a autenticação;
  - **Then** a requisição deve ser autorizada com HTTP 200.
- **Regression Test:** Teste unitário em pytest chamando a rota de stats com header `X-Kiosk-Key`.
- **Revalidation Method:** Execução de `pytest tests/test_security_lgpd.py`.

---

## [FINDING-005] — Vazamento de Metadados e Identidade em Respostas de Zona Incerta

- **Type:** PRIVACY GAP
- **Severity:** MEDIUM
- **Priority:** P1
- **Confidence:** HIGH
- **Evidence Grade:** E2 (Evidência Estática Direta)
- **Status:** VULNERABLE
- **Category:** Information Disclosure / Side-Channel
- **Location:** `backend/app/services/face_service.py:L370-L380`
- **Affected Component:** Serviço Facial (`_match_face_pgvector`)
- **Related Threat:** Enumeração não autorizada de identidade e facilitação de ataques de colisão biométrica.
- **Related Invariant:** Princípio de Minimização de Dados (LGPD Art. 6º III).
- **Root Cause:** Quando o candidato mais próximo está na zona incerta ($0.62 \le \cos < 0.68$), o backend informa `recognized: false`, mas inclui `profile_id`, `name`, `confidence`, `distance` e `cosine_similarity` no payload retornado para o cliente.
- **Precondition:** O atacante envia uma foto com similaridade marginal contra algum membro da base.
- **Attacker-Controlled Input:** Imagens de sondagem facial.
- **Failure Mechanism:** O atacante descobre o nome e o ID do membro que mais se assemelha à foto, podendo ajustar pequenos ângulos ou buscar fotos adicionais do alvo até atingir o threshold de 0.68 (Hill-Climbing Attack).
- **Evidence:**
  ```python
  return {
      "recognized": False,
      "status": "uncertain",
      "profile_id": top.get("profile_id"),
      "name": top.get("name"),
      "confidence": confidence,
      "distance": round(euclidean_dist, 4),
      "cosine_similarity": round(cosine_sim, 4),
      ...
  }
  ```
- **Exploitability:** Média.
- **Impact:** Vazamento de dados pessoais de integrantes e facilitação de bypass direcionado.
- **Blast Radius:** Integrantes com rostos semelhantes aos inputs enviados por atacantes.
- **Technical Remediation:** Remover `profile_id` e `name` do retorno de `uncertain`. Retornar apenas `{"recognized": false, "status": "uncertain", "message": "Similaridade insuficiente..."}`.
- **Compensating Control:** Logs internos mantêm os dados para auditoria do tutor.
- **Trade-offs:** O frontend precisará de outro fluxo caso queira pedir confirmação por nome.
- **Residual Risk:** Baixo.
- **Acceptance Criteria:**
  - **Given** uma requisição de reconhecimento que resulta em similaridade em zona incerta;
  - **When** a API responde;
  - **Then** a resposta JSON não deve conter as chaves `profile_id` nem `name`.
- **Regression Test:** Teste unitário em pytest validando o dicionário retornado em caso de incerteza.
- **Revalidation Method:** Teste automatizado com assert negativo sobre as chaves.

---

## [FINDING-006] — Exposição Histórica de Chave Anon e URL de Produção no Git

- **Type:** VULNERABILITY
- **Severity:** HIGH
- **Priority:** P0
- **Confidence:** HIGH
- **Evidence Grade:** E2 (Evidência Estática Direta no Histórico Git)
- **Status:** VULNERABLE
- **Category:** Credential Leakage / Git History Exposure
- **Location:** Commits `6c4f975` em `mobile/eas.json` e `6310cb8` em `mobile/.env.example`
- **Affected Component:** Repositório Git e Projeto Supabase
- **Related Threat:** Varredura não autorizada do PostgREST do Supabase por bots públicos no GitHub.
- **Related Invariant:** Proteção de segredos e credenciais de infraestrutura.
- **Root Cause:** Credenciais reais de projeto Supabase foram adicionadas e comitadas diretamente no repositório antes da criação de arquivos `.env.example` sanitizados.
- **Precondition:** Acesso de leitura ao histórico do repositório Git.
- **Attacker-Controlled Input:** N/A.
- **Failure Mechanism:** Um atacante clona o repositório, inspeciona o log com `git log -p` e extrai o JWT da anon key e a URL do cluster Supabase.
- **Evidence:** Commit `6c4f975` contém a linha:
  `"EXPO_PUBLIC_SUPABASE_ANON_KEY": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."`
- **Exploitability:** Trivial (scanners automatizados de credenciais operam 24/7 no GitHub).
- **Impact:** Exposição da camada PostgREST e possível abuso de cotas gratuitas do Supabase.
- **Blast Radius:** Todo o banco de dados Supabase (`profiles`, `sessions`).
- **Technical Remediation:**
  1. Rotacionar a chave Anon e JWT Secret no painel do Supabase.
  2. Executar expurgo histórico do commit com `git-filter-repo` ou ferramenta equivalente.
- **Compensating Control:** As políticas RLS impedem leitura de `face_embeddings` mesmo com a anon key.
- **Trade-offs:** Necessidade de redistribuir o APK do tablet após a rotação.
- **Residual Risk:** Nulo após rotação efetiva.
- **Acceptance Criteria:**
  - **Given** uma consulta ao histórico do Git procurando por tokens de chave;
  - **When** a busca é concluída;
  - **Then** nenhum token válido do Supabase deve existir nem responder no endpoint oficial.
- **Revalidation Method:** `git log -S "eyJh"` e teste HTTP contra a URL do projeto.

---

## [FINDING-007] — Risco de Negação de Serviço por Descompressão de Imagem (Decompression Bomb)

- **Type:** VULNERABILITY
- **Severity:** MEDIUM
- **Priority:** P1
- **Confidence:** HIGH
- **Evidence Grade:** E2 (Evidência Estática Direta)
- **Status:** VULNERABLE
- **Category:** Resource Exhaustion / Denial of Service
- **Location:** `backend/app/deps.py:L215-L221` e `backend/app/services/face_service.py:L188-L195`
- **Affected Component:** Validador de Mídia e Parser de Imagem PIL
- **Related Threat:** Queda do container Cloud Run por consumo descontrolado de memória (OOM Killer).
- **Related Invariant:** Resiliência e integridade operacional do backend.
- **Root Cause:** A validação de mídia checa apenas o tamanho em bytes na rede (`len(b) <= 5 MB`), mas não verifica a largura e altura da imagem. Arquivos JPEG altamente compactados com resolução de dezenas de megapixels exigem alocação massiva na matriz descompactada do Pillow (`Image.open().convert('RGB')`).
- **Precondition:** Envio de payload multipart especialmente construído com dimensões anômalas (ex: 15.000 x 15.000 pixels).
- **Attacker-Controlled Input:** Cabeçalhos e dados de imagem JPEG.
- **Failure Mechanism:** O container Cloud Run de 2 GiB aloca memória além do limite ao tentar processar 5 frames gigantes simultâneos, sofrendo restart imediato (502 Bad Gateway).
- **Exploitability:** Média.
- **Impact:** Indisponibilidade temporária do serviço de reconhecimento para todo o laboratório.
- **Blast Radius:** Instância do Cloud Run em execução.
- **Technical Remediation:** Inspecionar `img.size` sem descompactar todos os dados e limitar dimensões a no máximo 2500x2500 pixels.
- **Compensating Control:** Auto-restart do Cloud Run em caso de crash.
- **Trade-offs:** Pequeno overhead de parsing de cabeçalho.
- **Residual Risk:** Nulo após checagem de dimensões.
- **Acceptance Criteria:** Imagens com mais de 2.500 pixels de largura ou altura devem ser rejeitadas com HTTP 400.
- **Regression Test:** Teste com imagem 3000x3000px gerando HTTP 400.
- **Revalidation Method:** `pytest tests/test_infra_performance.py`.

---

## [FINDING-008] — Falta de Lockfile Determinístico no Backend Python

- **Type:** SUPPLY CHAIN GAP
- **Severity:** LOW
- **Priority:** P2
- **Confidence:** HIGH
- **Evidence Grade:** E2 (Evidência Estática Direta)
- **Status:** VULNERABLE
- **Category:** Supply Chain Security / Reproducibility
- **Location:** `backend/requirements.txt`
- **Affected Component:** Pipeline de Build Docker e CI/CD
- **Root Cause:** Uso de versionamento solto (`fastapi>=0.111,<1`) sem `requirements.lock` contendo hashes SHA-256 de cada wheel/tarball.
- **Technical Remediation:** Adotar `pip-compile --generate-hashes` ou `poetry` para travar versões exatas e digests criptográficos.

---

## [FINDING-009] — Compiladores e Ferramentas de Build Presentes na Imagem Final de Produção

- **Type:** DESIGN FLAW
- **Severity:** LOW
- **Priority:** P2
- **Confidence:** HIGH
- **Evidence Grade:** E2 (Evidência Estática Direta)
- **Status:** VULNERABLE
- **Category:** Container Hardening / Least Privilege
- **Location:** `backend/Dockerfile:L4-L8`
- **Affected Component:** Imagem Docker de Produção
- **Root Cause:** Pacote `build-essential` instalado no mesmo estágio do container final.
- **Technical Remediation:** Migrar para Dockerfile multi-stage build (estágio `builder` com compiladores e estágio `runner` com apenas `libgl1` e runtime Python).

---

## [FINDING-010] — Ausência de SHA-256 Pinning para o Pacote de Modelos `buffalo_s`

- **Type:** SUPPLY CHAIN GAP
- **Severity:** MEDIUM
- **Priority:** P1
- **Confidence:** HIGH
- **Evidence Grade:** E2 (Evidência Estática Direta)
- **Status:** VULNERABLE
- **Category:** ML Supply Chain & Model Integrity
- **Location:** `backend/Dockerfile:L30-L31`
- **Affected Component:** Model Zoo do InsightFace
- **Root Cause:** O download do modelo `buffalo_s` é delegado diretamente à biblioteca `insightface`, que consome mirrors externos sem checagem de SHA-256 no Dockerfile.
- **Technical Remediation:** Baixar os modelos `det_500m.onnx` e `w600k_mbf.onnx` via script dedicado (como feito para `pad.onnx`), validando seus hashes criptográficos antes de confiar neles.

---

## [FINDING-011] — Configuração Abandonada `max_session_cap_hours` como Código Morto

- **Type:** CODE QUALITY / LOGIC GAP
- **Severity:** INFO
- **Priority:** P3
- **Confidence:** HIGH
- **Evidence Grade:** E2 (Evidência Estática Direta)
- **Status:** VULNERABLE
- **Category:** Dead Code / Specification Drift
- **Location:** `backend/app/config.py:L26` e `backend/app/services/session_service.py:L196`
- **Affected Component:** Configuração de Sessão
- **Root Cause:** A variável `max_session_cap_hours = 4` existe nas configurações e em docstrings, mas `_close_stale_session` anula a sessão inteira com `voided_at`. A variável não é referenciada em nenhuma linha executável de código.
- **Technical Remediation:** Remover a variável da configuração ou implementar o teto justo de forma explícita caso a política de negócio mude.

---

## [FINDING-012] — Documentação Divergente sobre Kiosk Web e Cadastro Web

- **Type:** DOCUMENTATION DRIFT
- **Severity:** INFO
- **Priority:** P3
- **Confidence:** HIGH
- **Evidence Grade:** E2 (Evidência Estática Direta)
- **Status:** VULNERABLE
- **Category:** Documentation Drift
- **Location:** `README.md` e `web/README.md` vs. `web/src/App.tsx`
- **Affected Component:** Documentação do Projeto
- **Root Cause:** O `README.md` e `web/README.md` afirmam existir modo kiosk e tela de cadastro no navegador web. Na prática, a aplicação web possui apenas `/login` e `/dashboard`.
- **Technical Remediation:** Atualizar os arquivos de documentação para refletir a arquitetura real implementada (kiosk e cadastro exclusivos no aplicativo móvel do tablet).

---

## [FINDING-013] — Falta de Teste de Restauração de Banco de Dados (Restore Testing)

- **Type:** ASSURANCE GAP
- **Severity:** MEDIUM
- **Priority:** P2
- **Confidence:** HIGH
- **Evidence Grade:** E2 (Evidência de Processo SRE)
- **Status:** UNKNOWN
- **Category:** Disaster Recovery & Business Continuity
- **Location:** Supabase Cluster & Processos de SRE
- **Affected Component:** Infraestrutura de Armazenamento
- **Root Cause:** Dependência exclusiva dos backups automatizados da plataforma Supabase sem nenhum procedimento documentado ou automatizado de teste de restauração em ambiente sandbox.
- **Technical Remediation:** Estabelecer rotina trimestral de teste de restore para validar RTO e integridade das tabelas e índices vetoriais.

---

## [FINDING-014] — Ausência de Validação de Viés e Teste Demográfico (Fairness Gap)

- **Type:** ASSURANCE GAP
- **Severity:** MEDIUM
- **Priority:** P2
- **Confidence:** HIGH
- **Evidence Grade:** E1 (Hipótese Teórica Fundamentada)
- **Status:** UNKNOWN
- **Category:** AI Ethics & Biometric Fairness
- **Location:** Modelos de Reconhecimento InsightFace
- **Affected Component:** Decisão Biométrica
- **Root Cause:** O sistema nunca foi submetido a um teste de disparidade de falsos rejeites (FNMR) entre diferentes tons de pele (Escala de Fitzpatrick) ou faixas etárias.
- **Technical Remediation:** Criar um benchmark ético interno com fotos consentidas de diferentes subgrupos para auditar se a taxa de falso não-reconhecimento afeta desproporcionalmente minorias no laboratório.
