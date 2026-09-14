# AILAB-FACIAL V4 — BACKLOG DE ISSUES PARA O GITHUB

**Data:** 13 de Setembro de 2026  
**Auditoria:** AILAB-FACIAL V4  
**Formato:** Pronto para importação / abertura direta no GitHub Issues  

---

## Issue #1 — [BUG / P0] Corrigir inflação de horas de presença em sessões esquecidas no dashboard web

- **Labels:** `bug`, `critical`, `p0`, `frontend`, `data-integrity`
- **Component:** `web/src/lib/reports.ts` & `web/src/lib/aggregate.ts`
- **Effort:** 2h
- **Description:**
  O backend encerra sessões de saída esquecida marcando `voided_at = now()`, fazendo com que a coluna gerada `duration_s` no Postgres retorne `NULL` (para computar 0 horas). Porém, o frontend web não seleciona `voided_at` e a função `sessionSeconds` em `aggregate.ts` possui uma lógica de fallback `if (session.checkOut != null)` que recomputa `checkOut - checkIn` quando `durationS == null`. Isso credita indevidamente de 10h a 72h+ para alunos que esqueceram de bater saída.
- **Acceptance Criteria:**
  - `fetchSessions` em `reports.ts` projeta o campo `voided_at`.
  - `sessionSeconds` em `aggregate.ts` retorna estritamente `0` caso `session.voidedAt != null` ou `session.durationS == null`.

---

## Issue #2 — [SECURITY / P0] Sincronizar `backend/schema.sql` com as migrações 05 e 06 para evitar regressão de RLS e biometria

- **Labels:** `security`, `database`, `p0`, `backend`
- **Component:** `backend/schema.sql`
- **Effort:** 2h
- **Description:**
  O arquivo autoritativo `backend/schema.sql` contém políticas RLS inseguras de `authenticated` (`USING (true)` em `profiles` e `sessions`) que foram corrigidas na migração 05, e contém uma definição de RPC `match_face` que avalia similaridade cosseno ($\ge 0.68$) enquanto a migração 06 e o backend Python avaliam distância cosseno ($\le 0.32$). Re-executar o `schema.sql` reinstala as políticas vulneráveis e quebra o limiar biométrico do sistema.
- **Acceptance Criteria:**
  - O `schema.sql` espelha estritamente as políticas da migração 05 (escrita restrita a `tutor`).
  - O `schema.sql` adota a comparação por distância cosseno ($\le 0.32$) alinhada com a migração 06 e o código Python.

---

## Issue #3 — [SECURITY / P0] Rotacionar credenciais do Supabase expostas no histórico do Git

- **Labels:** `security`, `credentials`, `p0`, `devops`
- **Component:** Supabase / Git
- **Effort:** 3h
- **Description:**
  A chave Anon JWT real e a URL do projeto Supabase foram comitadas no histórico do Git nos commits `6c4f975` (`eas.json`) e `6310cb8` (`.env.example`). Embora a árvore de trabalho atual use placeholders, os tokens históricos continuam válidos até 2036.
- **Acceptance Criteria:**
  - Chave anon rotacionada no console do Supabase.
  - Commits históricos sanitizados com `git-filter-repo`.

---

## Issue #4 — [BUG / P1] Compatibilizar header `X-Kiosk-Key` no endpoint `/sessions/stats/{profile_id}`

- **Labels:** `bug`, `api`, `p1`, `backend`
- **Component:** `backend/app/routers/recognize.py`
- **Effort:** 1h
- **Description:**
  O app móvel envia `X-Kiosk-Key` para consultas do tablet, mas a rota de estatísticas `/sessions/stats/{profile_id}` possui a dependência `verify_api_key`, que exige o header legado `X-API-Key`. Isso gera erro HTTP 401 ao visualizar horas no tablet.
- **Acceptance Criteria:**
  - Rota de stats alterada para `dependencies=[Depends(verify_kiosk_key)]`.

---

## Issue #5 — [PRIVACY / P1] Suprimir vazamento de identidade em respostas de reconhecimento incerto

- **Labels:** `privacy`, `security`, `p1`, `backend`
- **Component:** `backend/app/services/face_service.py`
- **Effort:** 1h
- **Description:**
  Quando a similaridade cai na zona incerta ($0.62 \le \cos < 0.68$), o backend responde com `recognized: false`, mas inclui `profile_id` e `name` do candidato mais próximo, permitindo inferência e enumeração de dados de integrantes.
- **Acceptance Criteria:**
  - Respostas com `status: "uncertain"` omitem os campos `profile_id` e `name`.

---

## Issue #6 — [SECURITY / P1] Implementar handshake de desafio efêmero (Nonce) contra injeção digital

- **Labels:** `security`, `biometrics`, `p1`, `architecture`
- **Component:** `backend/app/routers/recognize.py` & `mobile/`
- **Effort:** 8h
- **Description:**
  A API de reconhecimento aceita imagens estáticas via HTTP sem validar o momento da captura nem vincular a imagem a um desafio do servidor. Implementar endpoint `/recognize/challenge` que gera um token one-time com validade de 30 segundos.
- **Acceptance Criteria:**
  - Requisições para `/recognize` sem nonce válido recente são rejeitadas com HTTP 400.
  - O nonce é invalidado após o primeiro uso.

---

## Issue #7 — [SECURITY / P1] Mitigar vulnerabilidade de Decompression Bomb limitando resolução em pixels

- **Labels:** `security`, `reliability`, `p1`, `backend`
- **Component:** `backend/app/deps.py`
- **Effort:** 2h
- **Description:**
  O validador checa apenas tamanho em bytes, permitindo imagens JPEG de alta compressão com dimensões exageradas (ex: 15.000 x 15.000 px) que causam estouro de memória no Pillow.
- **Acceptance Criteria:**
  - Imagens com largura ou altura superior a 2.500 pixels são rejeitadas com HTTP 400 antes da conversão para array NumPy.

---

## Issue #8 — [DEVOPS / P2] Adicionar lockfile determinístico com hashes SHA-256 no backend

- **Labels:** `devops`, `supply-chain`, `p2`
- **Component:** `backend/requirements.txt`
- **Effort:** 3h
- **Description:**
  O backend instala dependências com ranges abertos sem checagem de integridade SHA-256 de pacotes PyPI.
- **Acceptance Criteria:**
  - Geração e versionamento de `requirements.lock` via `pip-compile --generate-hashes`.

---

## Issue #9 — [HARDENING / P2] Migrar Dockerfile do backend para Multi-Stage Build limpo

- **Labels:** `devops`, `security`, `p2`, `docker`
- **Component:** `backend/Dockerfile`
- **Effort:** 4h
- **Description:**
  A imagem de produção contém compiladores (`build-essential`) desnecessários no runtime.
- **Acceptance Criteria:**
  - Dockerfile dividido em estágio `builder` e estágio final `runner` sem compiladores C/C++.

---

## Issue #10 — [DOCS / P3] Alinhar documentação do repositório à arquitetura real implementada

- **Labels:** `documentation`, `p3`
- **Component:** `README.md`, `web/README.md`, `render.yaml`
- **Effort:** 2h
- **Description:**
  Remover referências obsoletas a modo kiosk e cadastro na web, sincronização Google Sheets e deploy Render com threshold descalibrado.
- **Acceptance Criteria:**
  - `README.md` reflete fielmente as rotas do app Expo, do dashboard web e a calibração de produção.
