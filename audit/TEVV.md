# AILAB-FACIAL V4 — TESTE, AVALIAÇÃO, VERIFICAÇÃO E VALIDAÇÃO (TEVV)

**Data:** 13 de Setembro de 2026  
**Auditoria:** AILAB-FACIAL V4  
**Framework:** NIST AI RMF 1.0 (TEVV Profile) / ISO/IEC 19795  
**Status:** AUDITED  

---

## 1. As Quatro Dimensões do TEVV

```
┌─────────────────┐       ┌─────────────────┐
│     1. TEST     │       │  2. EVALUATION  │
│ O código roda   │       │ As métricas     │
│ conforme o      │       │ medem o         │
│ especificado?   │       │ relevante?      │
└────────┬────────┘       └────────┬────────┘
         │                         │
         ▼                         ▼
┌─────────────────┐       ┌─────────────────┐
│ 3. VERIFICATION │       │  4. VALIDATION  │
│ A implementação │       │ O sistema       │
│ satisfaz os     │       │ resolve o       │
│ requisitos?     │       │ problema real?  │
└─────────────────┘       └─────────────────┘
```

---

## 2. Avaliação Separada por Dimensão

| Dimensão TEVV | Escopo Analisado | Evidência Disponível | Resultado Técnico | Limitação Crítica |
|---|---|---|:---:|---|
| **1. Test (Teste)** | Testes unitários do backend (`test_biometrics.py`, `test_security_lgpd.py`, `test_sessions_concurrency.py`, `test_infra_performance.py`). | 55 testes automatizados em pytest passando em 0.98s no ambiente local. | **VERIFIED** | 100% dos testes biométricos e de banco utilizam mocks; **nenhum teste executa inferência real de modelos ONNX contra um dataset de imagens reais**. |
| **2. Evaluation (Avaliação)** | Métricas estatísticas de acurácia (FMR, FNMR, EER, APCER, BPCER). | Relação teórica de limiares baseada em benchmarks públicos do InsightFace (LFW/AgeDB). | **NOT VERIFIED** | **Não existe benchmark formal executado sobre a população demográfica específica do AILAB**. FMR/FNMR operacionais são desconhecidos em condições reais de iluminação e câmeras de tablet. |
| **3. Verification (Verificação)** | Conformidade entre requisitos de negócio (LGPD, sessões únicas, bloqueio de anon) e código. | Inspeção estática de rotas, middlewares, migrações SQL e funções de serviço. | **PARTIALLY MITIGATED** | Requisitos de RLS e segregação implementados, mas há violação de integridade no cômputo de horas do frontend web e divergência de limiares na RPC do banco. |
| **4. Validation (Validação)** | Adequação do sistema para substituir a lista de assinatura manual no laboratório de forma segura. | Uso assistido em ambiente controlado de laboratório universitário. | **CONDITIONAL** | O sistema melhora a conveniência, mas não atende aos critérios de auditabilidade forense estrita e resistência a injeção digital remota. |

---

## 3. Matriz de Cobertura de Testes Automatizados vs. Riscos Reais

| Cenário Crítico de Falha / Ataque | Teste Automatizado Existente? | Tipo de Teste | Eficácia da Detecção |
|---|:---:|:---:|:---:|
| Colisão concorrente no índice único de sessões | ✅ Sim (`test_register_event_handles_concurrent_insert_collision`) | Mock unitário (Exception 23505) | Alta para a regra do backend; não valida o banco real. |
| Rejeição de chave vazia ou inválida (Fail-closed) | ✅ Sim (`test_verify_api_key_fail_closed_when_key_empty`) | Unitário FastAPI | Total. |
| Rejeição de token OIDC com assinatura falsa | ✅ Sim (`test_verify_cron_or_api_key_rejects_unverified_oidc_signature`) | Unitário com fake JWT | Total. |
| Rejeição de fotos com pessoas diferentes no cadastro | ✅ Sim (`test_intra_burst_consistency_rejects_divergent_faces`) | Vetores sintéticos NumPy | Total para o algoritmo; não testa a etapa do detector SCRFD. |
| Injeção de frame JPEG estático via HTTP | ❌ Não | Nenhum | Nula (o sistema aceita a requisição normalmente). |
| Descarte de horas em sessões anuladas no frontend | ❌ Não | Nenhum | Nula (a falha existe e não possui teste no frontend). |
| Ataque de apresentação com vídeo em tela OLED | ❌ Não | Nenhum | Nula (sem suite de testes físicos PAD). |
| Decompressão de imagem JPEG com bomba de memória | ❌ Não | Nenhum | Nula (PIL processa o payload sem restrição de dimensão). |

---

## 4. Gaps de Garantia TEVV (Assurance Gaps)

1. **GAP-TEVV-01: Ausência de Testes Integrados com o Banco de Dados Real (Supabase):**
   - Todos os testes utilizam `unittest.mock.MagicMock` para substituir o cliente Supabase. Nenhuma migração SQL, índice HNSW ou política de RLS é exercitada durante a execução do `pytest`.
2. **GAP-TEVV-02: Inexistência de Suite de Testes Automatizados no Frontend (Web e Mobile):**
   - Nem o projeto `web/` nem o `mobile/` possuem frameworks de teste (Vitest, Jest, Cypress ou Playwright). A compilação TypeScript garante sanidade de tipos, mas não testa renderização, estado nem regras de negócio como o cálculo de `sessionSeconds`.
3. **GAP-TEVV-03: Falta de Dataset de Calibração e Teste de Viés Demográfico:**
   - Não há registro de dados de teste representando a diversidade de tons de pele (Escala de Fitzpatrick), faixas etárias ou uso de acessórios (óculos, franjas) no laboratório.
