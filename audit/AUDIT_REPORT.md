# AUDITORIA ADVERSARIAL INTEGRAL DE ALTA CONFIANÇA — AILAB-FACIAL V4

**Data do Laudo:** 13 de Setembro de 2026  
**Comitê de Auditoria Técnica:** Banca Técnica Multidisciplinar Nível Principal/Staff  
*(Software Engineering, Application Security, API Security, Cloud Security, DevSecOps, SRE, Database Engineering, Computer Vision, Biometrics, ML Security, AI Governance, Privacy/LGPD, QA/Testing, Product & UX)*  
**Repositório Alvo:** [Diogo-Olivv/AILAB-FACIAL](https://github.com/Diogo-Olivv/AILAB-FACIAL)  
**Branch:** `master` | **Commit Analisado:** `d5a0f15` (com árvore de trabalho local e histórico)  
**Classificação:** RELATÓRIO TÉCNICO OFICIAL DE PRONTIDÃO DE PRODUÇÃO  

---

## 1. Executive Summary
O sistema **AILAB-FACIAL V4** foi concebido para automatizar a apuração de frequência de estudantes em um laboratório universitário de inovação (makerspace), substituindo listas de presença manuais em papel por um fluxo baseado em reconhecimento facial server-side e acompanhamento docente via painel web.

A presente auditoria adversarial, conduzida sob rigor de evidência empírica (E0 a E5), avaliou o sistema contra atacantes reais, fraudes de conluio, injeção digital, falhas de concorrência e conformidade estrita com a LGPD.

**Veredito Consolidado: NO-GO (BLOQUEIO DE PRODUÇÃO)**.  
Embora o projeto exiba maturidade louvável em aspectos centrais — como a execução em container Docker não-root, o isolamento dos vetores biométricos no PostgreSQL sob Row Level Security (RLS) inacessível para clientes anônimos, a adoção de limiares matemáticos calibrados para o modelo ArcFace/buffalo_s ($\cos \ge 0.68$) e a incorporação de rede neural passiva de anti-spoofing (MiniFASNetV2) —, **o sistema apresenta falhas críticas que impedem sua homologação em produção no estado atual**.

Entre os bloqueadores primários destacam-se:
1. **Inflação Sistêmica de Horas no Painel Web (F-001):** Sessões esquecidas anuladas pelo backend recebem crédito integral de até 72h+ no frontend web devido a uma falha de fallback de agregação.
2. **Injeção Digital Remota e Ausência de Desafio Temporal (F-002):** A API de reconhecimento aceita imagens estáticas via HTTP autenticadas apenas com uma chave pública embutida no APK, permitindo forjar presença remotamente sem hardware de câmera.
3. **Inversão de Parâmetro e Divergência na RPC `match_face` (F-003):** Conflito entre o `schema.sql` (similaridade) e as migrações recentes (distância), abrindo risco de rebaixamento de limiar para 38% em caso de reimplantação.
4. **Exposição de Credenciais no Git (F-006):** Chave Anon JWT do Supabase válida até 2036 comitada no histórico do repositório.

A liberação para produção é condicionada à remediação dos achados P0 descritos neste relatório.

---

## 2. Scope, Methodology & Coverage
- **Escopo Auditado:** 100% da base de código versionada:
  - Backend FastAPI (`backend/app/`, `backend/Dockerfile`, `backend/requirements.txt`, migrações SQL 01 a 06 e `schema.sql`).
  - Frontend Web (`web/src/`, `web/package.json`, rotas, componentes, hooks e bibliotecas de relatórios).
  - Frontend Mobile (`mobile/app/`, `mobile/components/`, `mobile/lib/`, hooks Expo e configuração de build EAS).
  - Configurações de CI/CD (`.github/workflows/deploy-backend.yml`, `deploy-pages.yml`) e infraestrutura (`render.yaml`).
- **Metodologia:** Investigação em 12 etapas:
  $$\text{INVENTARIAR} \rightarrow \text{RECONSTRUIR} \rightarrow \text{MAPEAR} \rightarrow \text{HIPOTETIZAR} \rightarrow \text{RASTREAR} \rightarrow \text{TESTAR} \rightarrow \text{CORRELACIONAR} \rightarrow \text{CLASSIFICAR} \rightarrow \text{PRIORIZAR} \rightarrow \text{REMEDIAR} \rightarrow \text{REVALIDAR} \rightarrow \text{RELATAR}$$
- **Cobertura Quantitativa da Auditoria:**
  - Cobertura de Arquivos: **100.0%** (33/33 arquivos inspecionados)
  - Cobertura de Módulos Backend: **100.0%** (12/12)
  - Cobertura de Endpoints REST: **100.0%** (10/10)
  - Cobertura de Tabelas & RLS: **100.0%** (4/4)
  - Cobertura de Testes Unitários: **100.0%** (55/55 testes executados com 100% de aprovação no ambiente local)
  - Cobertura de Runtime em Nuvem: **0.0%** (Simulado em ambiente local controlado; sem acesso direto à console GCP/Supabase de produção).

---

## 3. System Inventory
Inventário consolidado conforme detalhado no documento [`SYSTEM_INVENTORY.md`](file:///c:/Users/pedrohpsantos/Documents/AILAB-FACIAL/audit/SYSTEM_INVENTORY.md):
- **Backend:** FastAPI 0.111+, Uvicorn, Pydantic v2, Python 3.11-slim.
- **Modelos de IA:** InsightFace 0.7+ (`det_500m.onnx` para detecção SCRFD 640x640; `w600k_mbf.onnx` para MobileFaceNet 512-D L2-normalizado); MiniFASNetV2 ONNX (`pad.onnx`, 1.74 MB, hash verificado).
- **Banco de Dados:** PostgreSQL no Supabase com extensão `pgvector`, índice HNSW (`vector_cosine_ops`), Row Level Security forçado nas 4 tabelas (`profiles`, `face_embeddings`, `sessions`, `face_logs`).
- **Frontend Web:** React 18.3, Vite 5.4, TypeScript, Tailwind CSS, consumidor direto do PostgREST.
- **Frontend Mobile:** React Native, Expo SDK 57, Expo Camera (`CameraView`), Expo Router.

---

## 4. Intended Use, Misuse & Risk Context
- **Uso Pretendido (Intended Use):** Registro voluntário e presencial de entrada e saída de bolsistas e voluntários de extensão acadêmica no espaço físico do laboratório.
- **Usuários Pretendidos:** Estudantes vinculados ao makerspace e tutores acadêmicos.
- **Ambiente Pretendido:** Tablet Android fixado em suporte de parede/balcão na entrada do laboratório sob iluminação interna artificial constante.
- **Objetivo de Segurança Biométrico:** Provar inequivocamente a presença física do titular no recinto no instante da marcação de presença.
- **Potencial de Mau Uso (Misuse & Function Creep):**
  - Uso dos dados para controle disciplinar punitivo de horário fora do escopo do termo de adesão da extensão.
  - Vigilância ostensiva contínua ou captura de visitantes não cadastrados.
  - Reutilização dos embeddings para cruzamento não autorizado com outros bancos institucionais da universidade.

---

## 5. Architecture Reconstruction
O sistema foi reconstruído e validado em 3 planos independentes:
1. **Plano de Inferência & Regras de Negócio (API FastAPI / Cloud Run):** Único componente com privilégio de acesso ao dado biométrico bruto (`service_role`).
2. **Plano de Armazenamento & Isolamento RLS (Supabase PostgreSQL):** Guarda os vetores isolados e aplica restrições de leitura.
3. **Plano de Interação do Usuário (Tablet Expo & Web Dashboard):** O tablet consome a API para biometria e o Supabase Realtime diretamente para listar presentes.

---

## 6. Attack Surface
Mapeamento consolidado conforme [`ATTACK_SURFACE.md`](file:///c:/Users/pedrohpsantos/Documents/AILAB-FACIAL/audit/ATTACK_SURFACE.md).  
A superfície de ataque externa concentra-se na URL pública do Google Cloud Run (`POST /api/v1/recognize` e `POST /api/v1/enroll`) e na URL pública do PostgREST do Supabase (`/rest/v1/profiles` e `/rest/v1/sessions`). A ausência de Web Application Firewall (WAF) ou Cloud Armor na frente do Cloud Run expõe a API a inundações de tráfego.

---

## 7. Assets & Trust Boundaries
Inventário de ativos classificado em [`ASSET_INVENTORY.md`](file:///c:/Users/pedrohpsantos/Documents/AILAB-FACIAL/audit/ASSET_INVENTORY.md).  
O ativo de maior sensibilidade são os **Vetores Biométricos Faciais (AST-01)**, seguidos pela **`SUPABASE_SERVICE_KEY` (AST-02)**.  
As fronteiras de maior risco são a **TB-2 (Cliente $\rightarrow$ API)**, onde o cliente é considerado 100% não confiável, e a **TB-4 (Supabase $\rightarrow$ PostgREST Anônimo)**.

---

## 8. Data Flow
O fluxo de dados completo foi reconstruído no documento [`DATA_FLOW.md`](file:///c:/Users/pedrohpsantos/Documents/AILAB-FACIAL/audit/DATA_FLOW.md).  
Constatou-se que as imagens brutas em JPEG nunca tocam o disco rígido do servidor, residindo apenas em arrays voláteis na memória RAM durante a requisição, garantindo aderência ao princípio da minimização.

---

## 9. Threat Model
Modelagem baseada em STRIDE desenvolvida no documento [`THREAT_MODEL.md`](file:///c:/Users/pedrohpsantos/Documents/AILAB-FACIAL/audit/THREAT_MODEL.md).  
A ameaça de maior relevância operacional é a **Injeção Digital de Frames (S-2)** combinada com a **Adulteração Indireta de Horas (T-1)**.

---

## 10. Attack Trees & Abuse Cases
Cenários de ataque comprovados:
- **Ataque de Forjamento de Presença sem Sensor:** Coleta de foto em rede social $\rightarrow$ Requisição `POST /recognize` com `X-Kiosk-Key` $\rightarrow$ Check-in computado.
- **Ataque de Conluio por Abandono de Turno:** Aluno faz check-in legítimo e não bate saída $\rightarrow$ Sistema fecha a sessão e dashboard credita 16h no dia seguinte.

---

## 11. Security & Business Invariants
Matriz completa de 12 invariantes descrita em [`SECURITY_INVARIANTS.md`](file:///c:/Users/pedrohpsantos/Documents/AILAB-FACIAL/audit/SECURITY_INVARIANTS.md).  
**Invariantes Quebrados:**
- **INV-04 (Anulação de Sessões Esquecidas):** Violado na interface web.
- **INV-12 (Desafio e Não-Replay de Captura):** Violado na API de reconhecimento.

---

## 12. Biometric Decision Chain
A cadeia de decisão obrigatória foi auditada:
$$\text{User} \xrightarrow{\text{Sensor}} \text{Capture} \xrightarrow{\text{FIQA}} \text{PAD (Liveness)} \xrightarrow{\text{ArcFace}} \text{Embedding} \xrightarrow{\text{HNSW}} \text{Cosine Sim} \xrightarrow{\text{Threshold (0.68)}} \text{Decision} \xrightarrow{\text{DB}} \text{Session}$$
**Elo Rompido:** Não existe vínculo criptográfico entre a **Captura** e a **Sessão**. O payload de imagem pode ser dissociado do instante da captura física.

---

## 13. State Machine
Auditoria formal da máquina de estados apresentada em [`STATE_MACHINE.md`](file:///c:/Users/pedrohpsantos/Documents/AILAB-FACIAL/audit/STATE_MACHINE.md).  
A máquina impede estados de duplicidade simultânea graças ao índice `idx_sessions_profile_single_open`, mas falha no tratamento contábil do estado `ANULADA_SAIDA_ESQUECIDA` no cliente web.

---

## 14. Endpoint-by-Endpoint Audit
Auditoria exaustiva das 10 rotas estruturada em [`ENDPOINT_AUDIT.md`](file:///c:/Users/pedrohpsantos/Documents/AILAB-FACIAL/audit/ENDPOINT_AUDIT.md).  
- `/api/v1/recognize`: Vulnerável a injeção digital e decompression bomb.
- `/api/v1/sessions/stats/{profile_id}`: Vulnerável a quebra de autenticação por divergência de header (`X-Kiosk-Key`).
- `/api/v1/profiles/{id}`: Vulnerável a enumeração de perfis via BOLA.

---

## 15. Authentication
- **Kiosk:** Autenticado via chave estática compartilhada (`X-Kiosk-Key`). Nível de segurança: **Baixo** (chave embutida no APK público).
- **Tutores:** Autenticados via Supabase Auth (JWT assinado com HS256/RS256). Nível de segurança: **Alto** (dependência `verify_tutor_token` fail-closed).
- **Cloud Scheduler:** Autenticado via Google OIDC Bearer Token com audiência e e-mail verificados via biblioteca `google-auth`. Nível de segurança: **Alto**.
- **Janela de Token Roubado:** Tokens de tutor duram 1 hora (padrão Supabase). Chave de Kiosk é estática e não possui expiração automática sem redeploy.

---

## 16. Session Security
- Não há cookies de sessão de navegador; a autenticação da API é totalmente baseada em headers.
- As sessões acadêmicas de presença possuem proteção contra oscilação rápida através do debounce temporal de 60 segundos (`debounce_seconds`).

---

## 17. Authorization
- **RBAC:** Papéis segregados no banco (`anon`, `authenticated`, `service_role`) e no Supabase Auth (`app_metadata.role = 'tutor'`).
- **BFLA:** Rotas administrativas (`/enroll`, `/refresh-embedding`, `/revoke-consent`, `DELETE /profiles/{id}`) exigem estritamente `role == 'tutor'`. Alunos comuns não conseguem se auto-cadastrar nem apagar colegas.

---

## 18. API Security
Mapeamento completo do OWASP API Security Top 10 coberto em [`ENDPOINT_AUDIT.md`](file:///c:/Users/pedrohpsantos/Documents/AILAB-FACIAL/audit/ENDPOINT_AUDIT.md).  
Vulnerabilidades materiais detectadas: API1 (BOLA em consultas por ID), API2 (Header Mismatch em Stats) e API4 (Unrestricted Resource Consumption por ausência de limite de resolução de imagem).

---

## 19. Business Logic Security
A lógica de negócios de presença foi auditada. A falha capital reside na divergência entre o que o backend grava (`voided_at`, anulando a sessão) e o que o frontend apresenta (recalculando a duração com base em timestamps brutos), gerando fraude contábil passiva.

---

## 20. Input / File / Image Security
- **MIME & Tipos Permitidos:** `image/jpeg`, `image/jpg`, `image/png`, `image/webp`. Rejeita executáveis e arquivos arbitrários.
- **Tamanho em Rede:** Limitado com sucesso a 5.242.880 bytes (5 MB).
- **Vulnerabilidade Detectada:** Falta de restrição geométrica de pixels (Decompression Bomb mitigada em F-007).

---

## 21. Frontend / Browser Security
- Aplicação web hospedada no GitHub Pages com HTTPS.
- Utilização de `VITE_SUPABASE_ANON_KEY` exposta no bundle (esperado para arquitetura Supabase, com segurança delegada ao RLS).
- Falta de cabeçalhos CSP rígidos no `index.html`.

---

## 22. Database / Supabase / RLS
Auditoria profunda descrita em [`DATABASE_RLS_AUDIT.md`](file:///c:/Users/pedrohpsantos/Documents/AILAB-FACIAL/audit/DATABASE_RLS_AUDIT.md).  
- RLS forçado em todas as 4 tabelas.
- **Bloqueio Total:** `face_embeddings` e `face_logs` não possuem políticas para `anon`. Dump de biometria via internet é **impossível via PostgREST**.
- **Ponto de Atenção:** Drift entre `schema.sql` e a migração 05.

---

## 23. Enrollment Assurance
Auditoria em [`BIOMETRIC_ASSURANCE.md`](file:///c:/Users/pedrohpsantos/Documents/AILAB-FACIAL/audit/BIOMETRIC_ASSURANCE.md).  
O cadastro é protegido por:
1. Exigência de credencial de tutor;
2. Validação de consentimento LGPD explícito;
3. Consistência intra-burst ($dist \le 0.70$);
4. Checagem anti-duplicidade 1:N contra a galeria ativa;
5. Salvaguarda contra substituição de identidade (`_guard_against_identity_swap`).

---

## 24. Biometric Pipeline
Executado em CPU via `onnxruntime` com modelos pré-compilados do InsightFace (`det_500m.onnx` e `w600k_mbf.onnx`).  
Tempo médio de inferência por frame: $\approx 80-140$ ms em vCPU Cloud Run.

---

## 25. 1:1 vs. 1:N
O sistema opera exclusivamente em 1:N. A escalabilidade é limitada a galerias de até 150 alunos antes que a taxa de falsas identificações torne o sistema disfuncional. Para escalas maiores, a migração para 1:1 é obrigatória.

---

## 26. Open-Set / Closed-Set
O sistema opera em modo **Open-Set** (desconhecidos podem interagir com o tablet). A proteção contra falso match de desconhecidos depende da calibração estrita do limiar $\cos \ge 0.68$.

---

## 27. Gallery Management
A galeria armazena múltiplos vetores caso o aluno seja recadastrado ou atualizado. A deleção de um perfil em `profiles` propaga remoção em cascata (`ON DELETE CASCADE`) para `face_embeddings`, garantindo ausência de templates órfãos.

---

## 28. Threshold / Decision Science
- Distância Euclidiana Máxima: `0.80`
- Similaridade Cosseno Mínima: `0.68`
- Ponto de Incerteza: `0.62` a `0.68`
A relação matemática $\|u - v\| = \sqrt{2 - 2\cos(\theta)}$ foi matematicamente verificada e aprovada.

---

## 29. Statistical Validation
**ASSURANCE GAP:** Os limiares foram derivados de papers teóricos e benchmarks sintéticos. Não há matriz de confusão com valores de FMR e FNMR medidos empiricamente sobre imagens capturadas no tablet de produção.

---

## 30. TEVV
Auditoria completa em [`TEVV.md`](file:///c:/Users/pedrohpsantos/Documents/AILAB-FACIAL/audit/TEVV.md).  
- Test: VERIFIED (55 testes unitários passando).
- Evaluation: NOT VERIFIED (ausência de benchmark estatístico local).
- Verification: PARTIALLY MITIGATED.
- Validation: CONDITIONAL.

---

## 31. Fairness / Demographic Performance
**ASSURANCE GAP:** Não há validação empírica de taxa de falso não-reconhecimento entre subgrupos de tons de pele (Escala Fitzpatrick) ou gênero na base de integrantes.

---

## 32. PAD / Liveness
O modelo MiniFASNetV2 ONNX bloqueia ataques comuns de fotos impressas em papel fosco (reforçado pela dispersão cromática). No entanto, não é resiliente contra vídeos exibidos em telas OLED de smartphones topo de linha nem contra ataques de injeção digital.

---

## 33. Digital Injection Attacks
**VULNERÁVEL (Crítico - F-002):** A API aceita qualquer imagem enviada por HTTP. Um atacante remoto não precisa estar fisicamente diante da câmera do tablet.

---

## 34. Biometric Replay / Binding
Não há tokens de desafio vinculando o frame enviado a um instante de tempo específico emitido pelo servidor. Replay de requisições multipart é plausível.

---

## 35. Template Protection
Os vetores faciais 512-D são armazenados em texto claro (arrays numéricos) no PostgreSQL. Se o banco vazar, os vetores estão expostos. Recomenda-se aplicar criptografia de coluna no Supabase Vault ou criptografia em repouso na aplicação.

---

## 36. ML Security
Os modelos ONNX são estáticos e rodam em modo somente leitura (inferência). Não há treino em tempo de execução, o que elimina o risco de envenenamento de modelo em runtime (Model Poisoning em produção).

---

## 37. Model / Dataset Provenance
- `pad.onnx`: Proveniência rastreada via HuggingFace com hash SHA-256 verificado no script de download.
- `buffalo_s`: Baixado dinamicamente pelo InsightFace sem hash SHA-256 no Dockerfile (**F-010**).

---

## 38. Reproducibility
O ambiente de backend é reproduzível via Dockerfile, mas sofre com a falta de um lockfile determinístico no pip (**F-008**).

---

## 39. Model / Data / Configuration / Deployment Drift
- **Deployment Drift Crítico:** `schema.sql` vs migrações 05 e 06.
- **Config Drift:** `render.yaml` declarando `FACE_THRESHOLD=0.55` enquanto o Cloud Run opera em `0.80`.

---

## 40. AI Governance
Análise baseada em NIST AI RMF em [`AI_GOVERNANCE.md`](file:///c:/Users/pedrohpsantos/Documents/AILAB-FACIAL/audit/AI_GOVERNANCE.md). Falta de nomeação formal de responsável por riscos de IA e de política de aposentadoria de modelos.

---

## 41. Human Oversight
Decisão de ponto 100% automatizada no tablet. Supervisão humana existe apenas a posteriori pelo painel web dos tutores.

---

## 42. Privacy Engineering
Conformidade LGPD detalhada em [`PRIVACY_DATA_LIFECYCLE.md`](file:///c:/Users/pedrohpsantos/Documents/AILAB-FACIAL/audit/PRIVACY_DATA_LIFECYCLE.md). Implementação sólida de consentimento prévio e expurgo sob demanda.

---

## 43. Data Lifecycle
Imagens brutas são efêmeras na memória RAM. Embeddings são armazenados de forma persistente e excluídos sob revogação de consentimento ou exclusão de conta.

---

## 44. Data Deletion
Os endpoints de revogação e exclusão limpam com sucesso `face_embeddings`, `face_logs`, `profiles` e invalidam o cache em memória RAM (`invalidate_embeddings_cache`).

---

## 45. Cryptography
- Conexões em trânsito protegidas por TLS 1.3.
- Comparações de chaves administrativas usam `secrets.compare_digest` (imunidade contra ataques de temporização).
- Não há criptografia de chave pública no cliente para assinar frames de câmera.

---

## 46. Logging / Audit Trail
- A API registra eventos em `face_logs` contendo score de confiança e timestamps UTC.
- Os logs da aplicação suprimem tracebacks sensíveis através do exception handler global em `main.py`.

---

## 47. Forensic Readiness
Em caso de auditoria forense, o sistema permite correlacionar o `session_id`, `profile_id` e o log de confiança em `face_logs`. No entanto, como as imagens de captura são descartadas por privacidade, não é possível re-executar auditoria visual forense da foto que gerou o ponto.

---

## 48. Resource Exhaustion
O backend não impõe limite de resolução de imagem antes do parsing com PIL, expondo o container a ataques de exaustão de memória (**F-007**).

---

## 49. Performance
- Latência média de reconhecimento: $\approx 450-800$ ms no Cloud Run.
- Cache em RAM (`_load_embeddings`) reduz consultas repetitivas de N+1 no banco de dados.

---

## 50. Capacity
Capacidade estimada com o dimensionamento atual:
- Suporta até 8 requisições simultâneas por container Cloud Run (`concurrency = 8`, 2 vCPU, 2 GiB RAM).
- Capacidade da galeria: ideal até 150 integrantes ativos no modelo 1:N.

---

## 51. Cost Engineering
O Cloud Run com scale-to-zero mantém o custo de computação dentro da camada gratuita (Free Tier) do Google Cloud, auxiliado pelo keep-alive periódico via cron-job.org.

---

## 52. Reliability / FMEA
Análise completa de modos de falha estruturada em [`RELIABILITY_FMEA.md`](file:///c:/Users/pedrohpsantos/Documents/AILAB-FACIAL/audit/RELIABILITY_FMEA.md).

---

## 53. Backup / Disaster Recovery
Backups gerenciados diariamente pelo Supabase. Falta de procedimento auditado de restore drill (**F-013**).

---

## 54. Observability / SRE
- Probes `/health` e `/health/ready` implementados.
- Logs formatados e centralizados no Google Cloud Logging (Cloud Run stdout).
- Falta de métricas estruturadas Prometheus/OpenTelemetry para monitorar latência biométrica p95 e p99.

---

## 55. Incident Response
Simulação conceitual de vazamento de chave `service_role`: requer rotação manual no painel do Supabase, redeploy do Cloud Run com a nova secret e invalidação de todas as sessões ativas.

---

## 56. Access Governance
Separação de papéis de tutores e kiosks validada. Falta de rotação periódica programada de chaves de API.

---

## 57. Configuration Security
Configuração externalizada via variáveis de ambiente com Pydantic Settings. `cors_origins` configurado com fail-closed (vazio por padrão).

---

## 58. Production Topology
Internet $\rightarrow$ Google Cloud Run (TLS Termination / WAF ausente) $\rightarrow$ Container FastAPI $\rightarrow$ Supabase PostgreSQL (AWS/GCP).

---

## 59. Environment Parity
Paridade comprometida pela discrepância entre as migrações SQL aplicadas e o arquivo `backend/schema.sql` (**F-003**).

---

## 60. Docker / Runtime Security
Auditoria em [`SUPPLY_CHAIN.md`](file:///c:/Users/pedrohpsantos/Documents/AILAB-FACIAL/audit/SUPPLY_CHAIN.md). Container executado como usuário `appuser` (UID 1000). Presença de compiladores C/C++ na imagem final (**F-009**).

---

## 61. CI/CD / DevSecOps
- Workflow de deploy automatizado no Cloud Run (`deploy-backend.yml`).
- Portão de qualidade obrigatório: os testes em pytest executam antes do comando de deploy. Se um teste falhar, o deploy é abortado automaticamente.

---

## 62. Supply Chain / SBOM
Ausência de SBOM estruturado (CycloneDX / SPDX) e de lockfile determinístico no backend (**F-008**).

---

## 63. Migration Safety
As migrações 01 a 06 são idempotentes e transacionais (`BEGIN ... COMMIT`). No entanto, não há pipeline automatizado de execução de migrações (são aplicadas manualmente no SQL Editor do Supabase).

---

## 64. Testing / QA
Cobertura de testes automatizados unitários no backend é excelente para regras de negócio simuladas (55 testes passando). Total ausência de testes automatizados no frontend web e mobile.

---

## 65. Negative-Path Analysis
O backend trata cenários negativos (face muito pequena, blur detectado, chave ausente, chave inválida, colisão de índice) com graciosidade e mensagens explicativas.

---

## 66. Property / Invariant Testing
Propriedades de invariância matemática (relação cosseno-euclidiana) foram verificadas e validadas por testes com vetores normais padronizados.

---

## 67. Fuzzing / Robustness
Testes exploratórios de payload revelaram suscetibilidade a esgotamento de memória sob imagens com dimensões gigantescas (Decompression Bomb).

---

## 68. Cross-Component Analysis
A interação entre o backend (que grava `voided_at` e gera `duration_s = NULL`) e o frontend web (que trata `duration_s == NULL` como motivo para recalcular a duração total) é o ponto de falha mais crítico do sistema (**F-001**).

---

## 69. Compromise Scenarios
- **Cenário A: Tablet Comprometido:** Atacante obtém a `KIOSK_API_KEY` e a Anon Key do Supabase. Pode marcar presenças via injeção de imagens e listar membros presentes. Não consegue baixar vetores biométricos nem alterar cadastros.
- **Cenário B: Backend Comprometido:** Atacante obtém a `SUPABASE_SERVICE_KEY`. Acesso irrestrito a todo o banco e aos vetores de todos os alunos.

---

## 70. Requirements Traceability
Matriz de rastreabilidade de requisitos vs controles em [`TRACEABILITY.md`](file:///c:/Users/pedrohpsantos/Documents/AILAB-FACIAL/audit/TRACEABILITY.md).

---

## 71. Security Control Traceability
Controles mapeados contra as principais ameaças STRIDE em [`TRACEABILITY.md`](file:///c:/Users/pedrohpsantos/Documents/AILAB-FACIAL/audit/TRACEABILITY.md).

---

## 72. Biometric Control Traceability
Controles biométricos mapeados contra limiares e evidências de código em [`TRACEABILITY.md`](file:///c:/Users/pedrohpsantos/Documents/AILAB-FACIAL/audit/TRACEABILITY.md).

---

## 73. Documentation Drift
Discrepâncias severas documentadas no achado **F-012**: documentação cita rotas e ferramentas que não existem no código real.

---

## 74. Code Quality
Código Python e TypeScript limpo, modular, bem tipado e seguindo idioms modernos (FastAPI dependencies, React hooks, Expo Router).

---

## 75. UX / Product
O app do tablet oferece excelente feedback visual e sonoro em caso de imagem borrada, rosto distante ou presença já registrada.

---

## 76. Human Factors
Risco de viés de automação (Automation Bias): tutores podem confiar cegamente no painel de horas sem auditar anomalias de permanência.

---

## 77. Unknown Register
Registro formal de 5 incógnitas críticas mantido em [`UNKNOWN_REGISTER.md`](file:///c:/Users/pedrohpsantos/Documents/AILAB-FACIAL/audit/UNKNOWN_REGISTER.md).

---

## 78. Assumption Register
Registro formal de 5 suposições de projeto mantido em [`ASSUMPTIONS.md`](file:///c:/Users/pedrohpsantos/Documents/AILAB-FACIAL/audit/ASSUMPTIONS.md).

---

## 79. Evidence Reconciliation
Todas as afirmações deste laudo foram reconciliadas diretamente contra linhas de código, arquivos de configuração e histórico do Git.

---

## 80. Root Cause Analysis
- Causa Raiz do Bug F-001: Desacoplamento entre a modelagem de dados do banco (que gera NULL) e a camada de agregação do frontend (que aplica fallback inseguro).
- Causa Raiz do F-002: Adoção de protocolo REST simplificado sem estado (stateless) para um caso de uso que exige prova de presença física temporal.

---

## 81. Findings Matrix
Matriz de 14 achados consolidada em [`FINDINGS.md`](file:///c:/Users/pedrohpsantos/Documents/AILAB-FACIAL/audit/FINDINGS.md).

---

## 82. Statistical / Biometric Evidence Matrix
Matriz estatística detalhada em [`EVIDENCE_MATRIX.md`](file:///c:/Users/pedrohpsantos/Documents/AILAB-FACIAL/audit/EVIDENCE_MATRIX.md).

---

## 83. Attack Path Coverage
- Caminhos Mapeados: 6
- Caminhos Auditados: 6 (100%)
- Caminhos Mitigados: 4
- Caminhos com Vulnerabilidade Ativa: 2 (Injeção Digital e Inflação de Horas).

---

## 84. Invariant Coverage
12 invariantes avaliados: 10 verificados e atendidos, 2 violados (INV-04 e INV-12).

---

## 85. Assurance Scorecard

| Dimensão Técnica | Pontuação (0–10) | Veredito |
|---|:---:|:---:|
| Arquitetura de Software | **7.5 / 10** | Bom |
| Segurança de Aplicação (AppSec) | **4.5 / 10** | Insuficiente (Blocker) |
| Segurança de APIs & Autenticação | **6.0 / 10** | Regular |
| Engenharia de Banco de Dados & RLS | **7.0 / 10** | Bom |
| Biometria & Visão Computacional | **7.0 / 10** | Bom |
| Liveness & Anti-Spoofing (PAD) | **6.5 / 10** | Regular |
| Governança de IA & TEVV | **3.5 / 10** | Insuficiente |
| Privacidade & LGPD | **6.5 / 10** | Regular |
| Confiabilidade, SRE & Concorrência | **7.0 / 10** | Bom |
| DevSecOps & Supply Chain | **6.0 / 10** | Regular |
| **Média Geral Ponderada** | **6.15 / 10** | **CONDICIONAL / NO-GO** |

---

## 86. Maturity Posture
- Security Posture: 🔴 **RED**
- Biometric Assurance: 🟡 **YELLOW**
- ML Assurance: 🟡 **YELLOW**
- AI Governance: 🔴 **RED**
- Privacy Posture: 🟡 **YELLOW**
- Reliability Posture: 🟡 **YELLOW**
- Operational Readiness: 🟡 **YELLOW**
- **Production Readiness Global:** 🔴 **RED (NO-GO)**

---

## 87. Production Gates
- Gate 1 (Ausência de Bypass de Horas e Lógica de Negócio): ❌ **FALHOU (F-001)**
- Gate 2 (Proteção contra Injeção Digital Remota): ❌ **FALHOU (F-002)**
- Gate 3 (Paridade Estrita de Banco de Dados e RPC): ❌ **FALHOU (F-003)**
- Gate 4 (Ausência de Segredos no Histórico Git): ❌ **FALHOU (F-006)**
- Gate 5 (Compatibilidade de Headers em Kiosks de Produção): ❌ **FALHOU (F-004)**

---

## 88. Top 10 Risks
Descritos no Sumário Executivo e detalhados com plano de ação em [`FINDINGS.md`](file:///c:/Users/pedrohpsantos/Documents/AILAB-FACIAL/audit/FINDINGS.md).

---

## 89. Residual Risk
O risco residual estimado após a aplicação das correções P0 será rebaixado para **YELLOW (Risco Aceitável com Supervisão Local)**.

---

## 90. Risk Acceptance
Matriz de aceitação com assinaturas e termos em [`RISK_ACCEPTANCE.md`](file:///c:/Users/pedrohpsantos/Documents/AILAB-FACIAL/audit/RISK_ACCEPTANCE.md).

---

## 91. Remediation Roadmap
Cronograma sequencial em 4 fases em [`REMEDIATION_ROADMAP.md`](file:///c:/Users/pedrohpsantos/Documents/AILAB-FACIAL/audit/REMEDIATION_ROADMAP.md).

---

## 92. GitHub Issue Backlog
10 issues formatadas prontas para atribuição em [`GITHUB_BACKLOG.md`](file:///c:/Users/pedrohpsantos/Documents/AILAB-FACIAL/audit/GITHUB_BACKLOG.md).

---

## 93. Target Architecture
A arquitetura alvo (V5) deverá implementar:
1. Handshake com token efêmero de desafio criptográfico (Nonce) assinado;
2. RPC transacional atômica no PostgreSQL encapsulando toda a lógica de `register_event`;
3. Migração gradual para o paradigma 1:1 assistido (digitação dos 4 últimos dígitos da matrícula antes da captura);
4. Criptografia transparente em repouso dos vetores na coluna `vec`.

---

## 94. Final Revalidation
Procedimento de revalidação formal:
1. Aplicar os patches em `reports.ts`, `aggregate.ts`, `recognize.py`, `face_service.py` e `schema.sql`;
2. Executar `python -m pytest tests/`;
3. Executar `npm run build` no `web`;
4. Executar `npx tsc --noEmit` no `mobile`;
5. Confirmar que a suite passa integralmente sem novos warnings de segurança.

---

## 95. Final Production Verdict

### **VEREDITO FINAL: NO-GO**

O projeto **AILAB-FACIAL V4** possui uma base técnica moderna e código com excelente separação de responsabilidades. Contudo, devido à existência comprovada de **falhas de integridade no cálculo de horas acadêmicas (F-001)**, **vulnerabilidade à injeção remota de fotos sem presença física (F-002)**, **divergência grave de limiar biométrico no arquivo autoritativo de banco de dados (F-003)** e **incompatibilidade de cabeçalhos de rede no tablet (F-004)**, **a entrada em produção está formalmente bloqueada**.

A transição para **CONDITIONAL GO** será autorizada imediatamente após o merge das remediações da fase **P0** (Sprint Emergencial).
