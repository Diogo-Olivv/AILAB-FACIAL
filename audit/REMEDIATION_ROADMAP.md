# AILAB-FACIAL V4 — ROADMAP CRONOLÓGICO DE REMEDIAÇÃO

**Data:** 13 de Setembro de 2026  
**Auditoria:** AILAB-FACIAL V4  
**Organização:** Prioridades P0 (Blockers), P1 (Pré-Lançamento), P2 (Hardening), P3 (Refinamento)  

---

## 1. Fase P0 — Bloqueadores Imediatos de Produção (Blockers)

### Sprint Emergencial (Semana 1)

#### P0-1: Correção do Cômputo de Horas de Sessões Anuladas no Dashboard Web
- **Problema:** O painel web calcula a diferença de tempo de sessões esquecidas quando `duration_s` é nulo, inflando horas de presença.
- **Componente:** `web/src/lib/reports.ts` e `web/src/lib/aggregate.ts`.
- **Arquivos:** `web/src/lib/reports.ts`, `web/src/lib/aggregate.ts`.
- **Solução:** Incluir `voided_at` no SELECT do Supabase e instruir `sessionSeconds` a retornar `0` se `session.voidedAt != null`.
- **Esforço Estimado:** 2 horas.
- **Critério de Aceite:** Sessões encerradas automaticamente não podem somar nem um minuto ao total de horas do aluno no dashboard.

#### P0-2: Sincronização do `schema.sql` com as Migrações 05 e 06
- **Problema:** Conflito entre a RPC `match_face` (distância vs similaridade) e políticas RLS de `authenticated`.
- **Componente:** `backend/schema.sql`.
- **Arquivos:** `backend/schema.sql`.
- **Solução:** Atualizar o `schema.sql` para refletir as políticas restritas de tutor da migração 05 e o limiar em distância cosseno ($\le 0.32$) da migração 06.
- **Esforço Estimado:** 2 horas.
- **Critério de Aceite:** Execução do `schema.sql` em banco virgem deve produzir exatamente o mesmo comportamento das migrações 01 a 06 aplicadas em série.

#### P0-3: Rotação de Credenciais Supabase e Higienização do Git
- **Problema:** Chave Anon e URL de produção comitadas no histórico do Git (`eas.json` e `.env.example`).
- **Componente:** Supabase Console / Git Repository.
- **Solução:** Gerar nova Anon Key no Supabase Studio e expurgar os commits históricos com `git-filter-repo`.
- **Esforço Estimado:** 3 horas.
- **Critério de Aceite:** A chave anon antiga deve retornar HTTP 401 e o histórico do Git não deve conter strings `eyJhbGciOi`.

---

## 2. Fase P1 — Pré-Lançamento (Curto Prazo — Semanas 2 e 3)

#### P1-1: Compatibilização do Header na Rota `/sessions/stats/{profile_id}`
- **Problema:** Tablet enviando `X-Kiosk-Key`, backend exigindo `verify_api_key`.
- **Componente:** `backend/app/routers/recognize.py`.
- **Solução:** Trocar a dependência da rota de stats para `verify_kiosk_key`.
- **Esforço Estimado:** 1 hora.

#### P1-2: Supressão de Metadados em Retornos de Incerteza (Privacidade)
- **Problema:** Resposta de zona incerta vaza `profile_id` e `name` do candidato mais próximo.
- **Componente:** `backend/app/services/face_service.py`.
- **Solução:** Omitir `profile_id` e `name` quando `recognized == False`.
- **Esforço Estimado:** 1 hora.

#### P1-3: Mitigação de Decompression Bomb e Limitação de Dimensões em Pixels
- **Problema:** Uploads de JPEG com resolução extrema podem causar OOM no Cloud Run.
- **Componente:** `backend/app/deps.py`.
- **Solução:** Checar `Image.size` em modo preguiçoso e rejeitar imagens maiores que 2.500 x 2.500 pixels.
- **Esforço Estimado:** 2 horas.

#### P1-4: Implementação de Desafio/Nonce de Captura Anti-Injeção Digital
- **Problema:** Envio direto de fotos via HTTP sem garantia de atualidade ou captura física.
- **Componente:** `backend/app/routers/recognize.py` e `mobile/hooks/useRecognize.ts`.
- **Solução:** Implementar rota de handshake efêmero (`/recognize/challenge`) com TTL de 30 segundos.
- **Esforço Estimado:** 8 horas.

---

## 3. Fase P2 — Hardening e Confiabilidade (Médio Prazo)

#### P2-1: Lockfile com Hashes Criptográficos para o Backend
- **Componente:** `backend/requirements.txt` $\rightarrow$ `backend/requirements.lock`.
- **Solução:** Adotar `pip-compile --generate-hashes`.
- **Esforço Estimado:** 3 horas.

#### P2-2: Hardening do Container Docker (Multi-Stage Build)
- **Componente:** `backend/Dockerfile`.
- **Solução:** Remover `build-essential` da imagem final, mantendo apenas bibliotecas dinâmicas em runtime limpo.
- **Esforço Estimado:** 4 horas.

#### P2-3: Validação de Hashes SHA-256 para o Pacote `buffalo_s`
- **Componente:** `backend/scripts/download_models.py`.
- **Solução:** Baixar os arquivos `.onnx` do InsightFace com verificação explícita de digest SHA-256 no script.
- **Esforço Estimado:** 4 horas.

#### P2-4: Exercício de Simulação de Restauração de Banco (Restore Drill)
- **Componente:** SRE / Supabase.
- **Solução:** Criar script ou procedimento manual de restauração em ambiente de homologação.
- **Esforço Estimado:** 4 horas.

---

## 4. Fase P3 — Refinamento e Evolução Contínua (Longo Prazo)

#### P3-1: Remoção de Código Morto e Alinhamento de Documentação
- Remover variável inoperante `max_session_cap_hours` e ajustar `README.md` sobre as interfaces web.
- **Esforço Estimado:** 2 horas.

#### P3-2: Suite de Testes Automatizados no Frontend (Vitest / Playwright)
- Adicionar testes de unidade para agregações e testes E2E básicos de renderização.
- **Esforço Estimado:** 12 horas.

#### P3-3: Avaliação Empírica de Viés Demográfico e Calibração Local
- Benchmark com subgrupos demográficos locais do laboratório para avaliar dispersão de FNMR.
- **Esforço Estimado:** 16 horas.
