# AILAB-FACIAL V4 — SUMÁRIO EXECUTIVO DA AUDITORIA TÉCNICA

**Data da Auditoria:** 13 de Setembro de 2026  
**Auditor Responsável:** Banca Técnica Multidisciplinar Principal/Staff (Engenharia de Software, AppSec, Biometria, ML Security, SRE, LGPD)  
**Repositório Auditado:** [Diogo-Olivv/AILAB-FACIAL](https://github.com/Diogo-Olivv/AILAB-FACIAL) (Branch: `master`)  
**Commit Auditado:** `d5a0f15` (com verificação da árvore de trabalho local e histórico)  
**Classificação do Documento:** Confidencial / Relatório Técnico de Risco de Produção  

---

## 1. Veredito Final de Produção

### **DECISÃO: NO-GO (BLOQUEIO DE ENTRADA EM PRODUÇÃO)**

O sistema **AILAB-FACIAL V4** apresenta avanços arquiteturais significativos em relação a iterações legadas — destacando-se a migração da inferência para o backend em container Docker, o isolamento dos vetores biométricos via Supabase RLS restrito a `service_role`, o pareamento biométrico com limiares matemáticos estritos baseados em ArcFace/buffalo_s (distância euclidiana $\le 0.80$ / cosseno $\ge 0.68$) e a incorporação de rede neural passiva de anti-spoofing (MiniFASNetV2 ONNX).

**No entanto, o sistema NÃO PODE ser liberado para operação produtiva irrestrita.**

Foram comprovadas **4 falhas críticas (P0)** e **7 falhas de alta prioridade (P1)** com evidência estática direta (E2), correlação de fluxo (E3) e testes locais (E4). Essas falhas permitem desde o crédito ilegítimo massivo de horas acadêmicas por bypass de lógica no painel web, até a injeção digital arbitrária de presenças via requisições HTTP forjadas, além da exposição de credenciais do Supabase no histórico versionado do Git.

---

## 2. Postura de Maturidade por Eixo Técnico

| Eixo de Avaliação | Postura | Nota (0–10) | Resumo da Situação |
|---|:---:|:---:|---|
| **Arquitetura & Engenharia de Software** | 🟡 **YELLOW** | **7.2 / 10** | Boa separação FastAPI / Supabase, mas há drift entre documentação (`README.md`), schema autoritativo e código. |
| **Segurança de Aplicação & APIs (AppSec)** | 🔴 **RED** | **4.5 / 10** | Ausência de validação de nonce/tempo nas capturas; segredo Supabase exposto no histórico do Git. |
| **Biometria & Visão Computacional** | 🟡 **YELLOW** | **6.8 / 10** | Calibração matemática correta ($\cos \ge 0.68$), mas vulnerável a ataques de injeção digital HTTP (bypass de sensor). |
| **Machine Learning & PAD / Liveness** | 🟡 **YELLOW** | **6.5 / 10** | MiniFASNetV2 integrado com SHA-256 verificado, mas o threshold passivo não foi avaliado contra datasets ISO/IEC 30107-3. |
| **AI Governance & TEVV** | 🔴 **RED** | **3.0 / 10** | Ausência de documentação de proveniência de dados de treino, teste de fairness demográfico e auditoria de viés. |
| **Privacidade & Conformidade LGPD** | 🟡 **YELLOW** | **6.0 / 10** | Direitos do titular implementados (revogação/exclusão), mas há vazamento de metadados em respostas de erro/zona incerta. |
| **Banco de Dados & Concorrência** | 🟡 **YELLOW** | **7.0 / 10** | Índice parcial UNIQUE previne sessões simultâneas, mas a RPC `match_face` possui inconsistência de limiar entre schema e migrações. |
| **SRE, Infraestrutura & Confiabilidade** | 🟡 **YELLOW** | **6.8 / 10** | Container Docker não-root, warmup no boot, mas dependência crítica de keep-alive externo no Cloud Run contra cold start. |

---

## 3. Resumo dos 5 Maiores Riscos Materiais (Top Risks)

### [R-01 | CRITICAL / P0] Inflação e Distorção de Horas por Falha de Lógica no Dashboard Web
- **Causa:** O backend encerra sessões abandonadas marcando `voided_at = now()`, fazendo com que a coluna gerada `duration_s` no Postgres retorne `NULL` (para registrar 0 horas). Porém, o código do frontend web (`web/src/lib/aggregate.ts` e `reports.ts`) não consulta `voided_at` e recalcula manualmente `(check_out - check_in)` sempre que `duration_s` for nulo, creditando integralmente 10h a 72h+ por sessão abandonada.
- **Impacto:** Fraude e distorção contábil do cômputo de horas acadêmicas de extensão para estudantes do laboratório.

### [R-02 | CRITICAL / P0] Injeção Digital Remota e Ausência de Desafio Temporal (Replay de Captura)
- **Causa:** O endpoint `POST /api/v1/recognize` aceita arquivos JPEG estáticos sem vincular a imagem a um desafio dinâmico (nonce server-side, carimbo de tempo assinado ou teste de vivacidade ativo). Um atacante com a chave do kiosk (presente no bundle do app) pode enviar requisições HTTP diretamente via `curl` contendo fotos de redes sociais de alunos cadastrados.
- **Impacto:** Forjamento sistemático e remoto de presença física no laboratório sem necessidade de presença real ou hardware de tablet.

### [R-03 | CRITICAL / P0] Exposição Histórica de Chave Anon e URL de Produção do Supabase no Git
- **Causa:** No commit `6c4f975` em `mobile/eas.json` e no commit `6310cb8` em `mobile/.env.example`, a chave anon real do projeto Supabase (`eyJhbGciOi...`) e a URL `https://jbahfjfvyomayrmytpdk.supabase.co` foram comitadas em texto puro.
- **Impacto:** Qualquer usuário com acesso de leitura ao repositório GitHub pode conectar-se diretamente ao PostgREST do Supabase e realizar consultas automatizadas.

### [R-04 | HIGH / P0] Inversão de Parâmetro e Divergência Crítica na RPC `match_face`
- **Causa:** No arquivo autoritativo `backend/schema.sql`, a RPC `match_face` filtra por similaridade cosseno (`similarity >= match_threshold`), com default 0.68. Na migração `06_recalibrate_biometrics_hnsw.sql`, o filtro foi alterado para distância cosseno (`dist <= match_threshold`), com default 0.32. O backend Python passa `max_distance = 0.38`. Se o banco for recriado pelo `schema.sql`, a RPC interpretará 0.38 como similaridade mínima, aceitando qualquer par com similaridade ínfima de 38% (FAR catastrófico).
- **Impacto:** Destruição da acurácia biométrica e falsos positivos massivos em caso de provisionamento de novos ambientes.

### [R-05 | HIGH / P1] Incompatibilidade de Header de Autenticação em `/sessions/stats/{profile_id}`
- **Causa:** A biblioteca de rede móvel (`mobile/lib/api.ts`) envia `X-Kiosk-Key` para consultas do kiosk, mas a rota de estatísticas no backend (`backend/app/routers/recognize.py#L89`) exige estritamente a dependência `verify_api_key` (`X-API-Key`).
- **Impacto:** Quebra funcional da tela de estatísticas do aluno no aplicativo do tablet quando operando com chaves segregadas de produção (HTTP 401).

---

## 4. Condições Obrigatórias para Concessão de GO (Production Gates)

Para que o AILAB-FACIAL receba autorização formal de entrada em produção (GO), a equipe de engenharia deve satisfazer os seguintes critérios de aceite inegociáveis:

1. **Correção do Cômputo no Dashboard:** Modificar `web/src/lib/reports.ts` para incluir `voided_at` na projeção SELECT e ajustar `sessionSeconds` em `aggregate.ts` para zerar a duração caso `voided_at` esteja preenchido ou `durationS === null`.
2. **Harmonização da RPC `match_face`:** Sincronizar a definição de `schema.sql` e `06_recalibrate_biometrics_hnsw.sql` para padronizar unicamente em distância cosseno ($\le 0.32$) ou similaridade ($\ge 0.68$).
3. **Rotação de Credenciais e Higienização do Git:** Rotacionar o JWT anon do Supabase no console e executar expurgo do histórico de commits via `git-filter-repo`.
4. **Alinhamento dos Headers do Kiosk:** Alterar a rota `/sessions/stats/{profile_id}` para aceitar `verify_kiosk_key`.
5. **Supressão de Metadados em Zona Incerta:** Remover os campos `profile_id` e `name` da resposta do backend quando o resultado for classificado como `uncertain` ou `not_recognized`.
6. **Implementação de Desafio/Nonce de Captura:** Adicionar geração de nonce efêmero com TTL de 30 segundos no backend, exigindo assinatura ou envio do nonce junto ao payload de frames.

---

## 5. Próximos Passos & Documentação Completa

Os detalhes técnicos, vetores de ataque, matrizes de rastreabilidade e roadmaps de remediação encontram-se estruturados nos arquivos complementares desta pasta `/audit/`:
- **Relatório Completo (95 Seções):** [`AUDIT_REPORT.md`](file:///c:/Users/pedrohpsantos/Documents/AILAB-FACIAL/audit/AUDIT_REPORT.md)
- **Catálogo de Findings Detalhado:** [`FINDINGS.md`](file:///c:/Users/pedrohpsantos/Documents/AILAB-FACIAL/audit/FINDINGS.md)
- **Auditoria de Endpoints:** [`ENDPOINT_AUDIT.md`](file:///c:/Users/pedrohpsantos/Documents/AILAB-FACIAL/audit/ENDPOINT_AUDIT.md)
- **Auditoria Biométrica & PAD:** [`BIOMETRIC_ASSURANCE.md`](file:///c:/Users/pedrohpsantos/Documents/AILAB-FACIAL/audit/BIOMETRIC_ASSURANCE.md)
- **Roadmap de Remediação:** [`REMEDIATION_ROADMAP.md`](file:///c:/Users/pedrohpsantos/Documents/AILAB-FACIAL/audit/REMEDIATION_ROADMAP.md)
- **Backlog de Issues para GitHub:** [`GITHUB_BACKLOG.md`](file:///c:/Users/pedrohpsantos/Documents/AILAB-FACIAL/audit/GITHUB_BACKLOG.md)
