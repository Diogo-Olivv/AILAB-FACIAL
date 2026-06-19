# Auditoria Técnica Completa — AILAB-FACIAL

## Identidade e Autoridade
Esta auditoria foi conduzida com a perspectiva de um **Principal Engineer**, com autoridade de decisão técnica. As constatações aqui descritas são baseadas em evidências do código-fonte e servem de guia para decisões de roadmap, evolução da arquitetura e liberação para produção do sistema AILAB-FACIAL.

---

## Métricas Quantitativas

| Métrica                              | Valor | Observação                        |
|--------------------------------------|-------|-----------------------------------|
| Total de arquivos                    | ~35   | Excluindo `.git` e `node_modules` |
| LOC (excl. blanks/comentários)       | ~1.2k | Principal massa em JS (PWA)       |
| Linguagens (por % de LOC)            | JS (70%), HTML/CSS (15%), Python (15%) | Python é legado/estudo |
| Módulos/serviços identificados       | 5     | Capture, AI/Matching, Storage, Sync, UI |
| Dependências diretas                 | 1     | `face-api.js` (embutido no vendor)|
| Dependências com CVE ativo           | 0     | [Não encontrado]                  |
| Testes unitários                     | 1     | `storage.test.js`                 |
| Testes E2E                           | 1     | `presenca.cy.js` (Cypress)        |
| Cobertura estimada                   | ~15%  | Focada apenas em Storage local    |
| Endpoints de API                     | 0     | Sistema Serverless (PWA Client)   |
| Workflows CI/CD                      | 1     | `deploy-pages.yml`                |
| Modelos de IA encontrados            | 3     | TinyFace, Landmark68, Recognition |
| Possíveis secrets expostos           | 0     | [Não encontrado] Nenhum credential exposto |

---

## 1. Arquitetura e Design

> **O design atual suporta os requisitos com custo de mudança aceitável?**
Sim. A transição de um backend Python para uma arquitetura PWA (Offline-First) delegou a carga computacional para a borda (Edge/Browser) e simplificou drasticamente o custo de infraestrutura.

### 1.1 Visão Geral
A arquitetura é baseada no padrão **Offline-First PWA Serverless**. O cliente navegador assume a responsabilidade total pelo pipeline de IA, persistência de dados local e sincronização assíncrona.
O fluxo de dados: Câmera → Tensor (WASM/WebGL) → Extração Biométrica → Matching Euclidiano → IndexedDB (Local) → Background Sync (Fetch) → Google Apps Script (Webhook).

### 1.2 Achados Arquiteturais

| ID      | Arquivo/Módulo | Anti-pattern | Impacto no Negócio | Severidade | Recomendação |
|---------|---------------|-------------|-------------------|------------|-------------|
| ARQ-001 | `app.js`      | God Object Parcial | Manutenção dificultada a longo prazo | BAIXO | Extrair o orquestrador do loop de câmera para uma classe de Controller específica. |
| ARQ-002 | `sheets-sync.js`| Retry Polling | Bateria do tablet pode ser drenada | MÉDIO | Mudar de `setInterval` fixo de 30s para Backoff Exponencial. |

---

## 2. Qualidade do Código

> **Um desenvolvedor novo consegue entender, modificar e testar o código com segurança?**
Parcialmente. O código é altamente acoplado ao DOM e à API do navegador, mas os módulos de persistência e sync estão isolados.

### 2.1 Achados de Qualidade

| ID      | Arquivo | Problema | Severidade | Refatoração Sugerida |
|---------|---------|---------|------------|---------------------|
| COD-001 | `app.js`| Loop de inferência preso ao loop principal de UI | ALTO | Deslocar a inferência pesada do `face-api.js` para um Web Worker nativo para destravar o FPS da tela. |
| COD-002 | `storage.js`| Ausência de paginação no IndexedDB | MÉDIO | Limitar a leitura de `listarPessoas()` apenas aos embeddings em memória, em vez de carregar tudo a cada iteração de loop, o que hoje não afeta por termos poucos usuários, mas não escala para >10.000 usuários. |

---

## 3. Inteligência Artificial e Visão Computacional

> **O pipeline de IA é confiável, justo e performático para produção?**
O pipeline é confiável para grupos pequenos a médios, com performance satisfatória (WASM/WebGL) em tablets.

### 3.1 Mapa do Pipeline

```
[Captura: getUserMedia] → [Pré-processamento: face-api.js / tf.js] → [Detecção Facial: TinyFaceDetector] → [Alinhamento: FaceLandmark68Net] → [Extração de Embedding: FaceRecognitionNet (128D)] → [Classificação: Distância Euclidiana < 0.55]
```

### 3.2 Avaliação por Componente e Otimização

| ID      | Componente      | Gargalo Identificado | Otimização Sugerida | Impacto Estimado |
|---------|----------------|--------------------|--------------------|--------------------|
| AI-001  | Detecção        | Processar frames sequenciais redundantes | **Frame Skipping:** Detectar faces a cada 5 frames em vez de todo frame. | Redução de 60% do uso de CPU. |
| AI-002  | Classificação   | Distância euclidiana O(n) | Substituir cálculo linear por HNSW (Hierarchical Navigable Small World) ou KD-Tree se a base passar de 1.000 pessoas. | Escala O(log N). |
| AI-003  | Fairness        | Viés em iluminação baixa e tons de pele escuros | Avaliar implementação de correção de gama/contraste antes do tensor e testar modelo de reconhecimento alternativo (ArcFace). | [MÉDIA] Redução de falsos negativos. |

### 3.3 Conformidade com Dados Biométricos — LGPD Art. 11

| Requisito                              | Implementado | Ação Necessária |
|----------------------------------------|-------------|----------------|
| Consentimento do titular               | ✅ `termos.html` com checkbox explícito no fluxo. | Nenhum. |
| Medidas de segurança específicas       | ✅ Embeddings não saem do dispositivo. | Criptografar IndexedDB (hoje em clear text no disco local). |
| Retenção mínima de dados               | ❌ | Implementar script de expiração e wipe-out semestral dos dados biométricos. |

---

## 4. Segurança

> **O sistema pode ser comprometido por um atacante externo ou interno com risco real?**
Como sistema Offline-First, o vetor de ataque primário é físico (acesso ao tablet).

### 4.1 Vulnerabilidades Encontradas

| ID      | Vulnerabilidade | Vetor de Ataque | Severidade | Remediação |
|---------|----------------|----------------|------------|------------|
| SEC-001 | PIN armazenado localmente em HASH SHA-256 (sem Salt) | Atacante com acesso físico extrai hash via DevTools e usa Rainbow Tables. | ALTO | Usar PBKDF2 ou bcrypt/argon2 no PWA (disponíveis via WASM ou WebCrypto iterativo com Salt). |
| SEC-002 | Token do Webhook do Google Apps Script visível via DevTools | Atacante forja chamadas na planilha. | MÉDIO | Como não há backend próprio, o token deve ser o mais restrito possível no Apps Script. |

---

## 5. DevOps, Infraestrutura e Testes

> **O time consegue entregar mudanças com segurança, velocidade e rastreabilidade?**
A infraestrutura é baseada puramente em repositório GitHub e GitHub Actions.

| Área                    | Status | Gap Principal | Próximo Passo |
|-------------------------|--------|--------------|--------------|
| Build reproduzível      | ✅ | | |
| Deploy automatizado     | ✅ | Via `deploy-pages.yml` | |
| Testes automatizados em CI | ❌ | Cypress local, sem rodar em Pipeline | Integrar Cypress no workflow do Actions bloqueando merge. |
| Dependências            | ✅ | Sem CVEs expostos em run-time. | Adicionar Renovate Bot. |

---

## 6. Escalabilidade e Prontidão para Produção

### 6.1 Projeção de Escala

| Escala           | Status | Gargalo Principal | Ação Recomendada |
|------------------|--------|-----------------|-----------------|
| 100 usuários     | ✅ Suportado | Nenhum | - |
| 1.000 usuários   | ⚠️ Parcial | Custo O(n) da Distância Euclidiana a cada frame | Cache de embeddings; Frame Skipping; Web Worker. |
| 10.000 usuários  | ❌ Quebra | Limite de tamanho IndexedDB / Memória do navegador (RAM) | Migrar matching O(n) para backend externo ou DB vetorial no WASM. |

---

## 7. Roadmap Técnico (Top 5 Prioridades)

Ranqueadas por: **Segurança > IA > Estabilidade > Escalabilidade**

1. **[SEC-001]** Implementar Salt Aleatório + Múltiplas interações no Hashing do PIN de Admin. (Prazo: 1 Sprint)
2. **[AI-001]** Mover a inferência do TensorFlow.js para um Web Worker nativo, impedindo travamento de UI/UX em dispositivos antigos. (Prazo: 2 Sprints)
3. **[AI-002]** Adicionar Frame Skipping (analisar apenas 1 frame a cada 500ms) para economizar bateria e dissipação térmica no tablet do laboratório. (Prazo: 1 Sprint)
4. **[ARQ-002]** Refatorar `setInterval` de sincronização no `sheets-sync.js` para usar Background Sync nativo do Service Worker ou Exponential Backoff. (Prazo: 2 Sprints)
5. **[OPS-001]** Ligar os testes unitários (`storage.test.js`) e E2E (`presenca.cy.js`) na pipeline de Integração Contínua (CI) do GitHub Actions. (Prazo: 1 Sprint)

---

## Conclusão Executiva

### TL;DR
O AILAB-FACIAL atingiu a estabilidade funcional como uma aplicação Offline-First Serverless. A solução é brilhante por seu baixo custo operacional (Zero-Backend), delegando IA e storage para o edge (tablet). Entretanto, a escalabilidade acima de 1.000 alunos e a proteção física avançada exigem atenção.

### Veredito de Produção

```
[x] APROVADO COM RESSALVAS — condicionado a: Implementar Web Workers para IA (FPS estável) e adicionar Salt ao PIN.
```

O sistema está apto para implantação no laboratório universitário para a rodada inicial de testes em ambiente real (Sprint 6).
