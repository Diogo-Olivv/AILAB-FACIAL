# AILAB-FACIAL V4 — MATRIZ DE EVIDÊNCIAS & CLASSIFICAÇÃO

**Data:** 13 de Setembro de 2026  
**Auditoria:** AILAB-FACIAL V4  
**Escala de Evidência:**  
- **E0:** Não avaliado / Sem dados  
- **E1:** Hipótese teórica / Dedução arquitetural  
- **E2:** Evidência estática direta (código, config, migração)  
- **E3:** Cadeia de execução correlacionada (chamadas entre módulos)  
- **E4:** Reprodução executável local (script, teste unitário)  
- **E5:** Validação de runtime integrado ou monitoramento de produção  

---

## 1. Matriz de Evidências por Finding

| ID da Finding | Título Sintético | Tipo de Finding | Severidade | Prioridade | Grau de Evidência | Status da Finding | Fonte Primária da Evidência |
|---|---|:---:|:---:|:---:|:---:|:---:|---|
| **F-001** | Inflação de Horas no Dashboard Web | BUG | CRITICAL | P0 | **E2 & E4** | VULNERABLE | `web/src/lib/aggregate.ts:L13-L23` |
| **F-002** | Ausência de Desafio/Nonce e Injeção Digital | DESIGN FLAW | CRITICAL | P0 | **E3** | VULNERABLE | `backend/app/routers/recognize.py:L22-L67` |
| **F-003** | Inversão de Parâmetro na RPC `match_face` | BUG | HIGH | P0 | **E2** | VULNERABLE | `backend/schema.sql` vs. `06_recalibrate...sql` |
| **F-004** | Incompatibilidade de Header em Stats | BUG | MEDIUM | P1 | **E2** | VULNERABLE | `backend/app/routers/recognize.py:L89` |
| **F-005** | Vazamento de Identidade em Zona Incerta | PRIVACY GAP | MEDIUM | P1 | **E2** | VULNERABLE | `backend/app/services/face_service.py:L373` |
| **F-006** | Exposição Histórica de Chave Anon no Git | VULNERABILITY | HIGH | P0 | **E2** | VULNERABLE | Commit `6c4f975` em `mobile/eas.json` |
| **F-007** | Decompression Bomb (Resource Exhaustion) | VULNERABILITY | MEDIUM | P1 | **E2** | VULNERABLE | `backend/app/deps.py:L215-L221` |
| **F-008** | Falta de Lockfile com Hashes no Backend | SUPPLY CHAIN GAP | LOW | P2 | **E2** | VULNERABLE | `backend/requirements.txt` |
| **F-009** | Ferramentas de Build na Imagem Final | DESIGN FLAW | LOW | P2 | **E2** | VULNERABLE | `backend/Dockerfile:L4-L8` |
| **F-010** | Falta de Hash SHA-256 no Modelo `buffalo_s` | SUPPLY CHAIN GAP | MEDIUM | P1 | **E2** | VULNERABLE | `backend/Dockerfile:L30-L31` |
| **F-011** | Variável `max_session_cap_hours` Inoperante | CODE QUALITY | INFO | P3 | **E2** | VULNERABLE | `backend/app/config.py:L26` |
| **F-012** | Drift de Documentação (Kiosk/Cadastro Web) | DOCUMENTATION DRIFT | INFO | P3 | **E2** | VULNERABLE | `README.md` vs. `web/src/App.tsx` |
| **F-013** | Falta de Teste de Restauração de Banco | ASSURANCE GAP | MEDIUM | P2 | **E2** | UNKNOWN | Políticas operacionais do Supabase |
| **F-014** | Ausência de Validação de Viés Demográfico | ASSURANCE GAP | MEDIUM | P2 | **E1** | UNKNOWN | Literatura NIST FRVT sobre MobileFaceNet |

---

## 2. Métricas de Cobertura de Investigação

| Categoria Auditada | Itens Auditados | Itens Totais Mapeados | Cobertura Percentual | Grau Predominante |
|---|:---:|:---:|:---:|:---:|
| **Arquivos de Código Fonte** | 33 | 33 | **100.0%** | E2 |
| **Módulos do Backend** | 12 | 12 | **100.0%** | E2 |
| **Endpoints REST da API** | 10 | 10 | **100.0%** | E2 / E3 |
| **Tabelas do Banco de Dados** | 4 | 4 | **100.0%** | E2 |
| **Fluxos Críticos de Negócio** | 6 | 6 | **100.0%** | E3 |
| **Testes Automatizados Unitários** | 55 | 55 | **100.0%** | E4 |
| **Runtime / Execução Real em Nuvem** | 0 | 1 | **0.0% (Simulado Local)** | E0 (Limitação declarada de ambiente) |
