# Estratégia de testes: estado e lacunas

> Revisado em 2026-11-11 · base `master@5f1d99c` · consolida a auditoria de testes de 2026-11-10/11 (PRs #76 e #77).
> Legenda: **F** contado ou lido nesta revisão · **F\*** relatado · **NV** não executado localmente.

## 1. Inventário (F)

| Camada | Arquivos | Casos | Onde roda | Banco real |
|---|---|---|---|---|
| Backend (pytest) | 14 arquivos em `backend/tests/` | 180 definições estáticas (`def test_`) | CI (`backend-tests`) | Sim, Postgres 17 com pgvector, no CI |
| Backend, banco | `test_db_migrations.py` (41 testes, mais 30 de privilégio) | — | CI com `REQUIRE_DB_TESTS=1` | Sim |
| Backend, sintaxe | `test_migration_syntax.py` (32 casos) | — | CI | Não precisa (parser `pglast`) |
| Web (node --test) | 8 arquivos `*.test.ts` | 61 casos | CI (`web-tests`) | Não |
| Mobile | **nenhum** | 0 | — | — |

Resultado no CI do PR #76 (run verificado): **254 passed, 23 xfailed, 0 skipped** no backend (F). A diferença entre a contagem estática (180) e a coletada (277 com parametrização) vem de testes parametrizados.

## 2. Qualidade dos testes

### 2.1 Falsos seguros (passam sem validar o comportamento real)

| Local | O que é substituído | O que deixa de ser detectado |
|---|---|---|
| `test_biometrics.py:256-275` | `identify` mockado; passa pelo fail-open do flash | Fluxo de flash inteiro; com policy `reject` o teste quebraria (**AF-11**) |
| `test_biometrics.py:384-444` | `_load_embeddings`, PAD e extração; `use_pgvector=False`; limiares 0,68/0,62 | Caminho de produção (pgvector, limiares padrão) (**AF-12**) |
| `test_biometrics.py:472-547`, `test_infra_performance.py:196-212` | RPC `match_face` com MagicMock; asserts ecoam o mock | Ordenação, operador, filtro de revogação (verificado só no PG) |
| `test_biometrics.py:185-207` | `_load_embeddings` mockado | Filtros embutidos e paginação; **fail-open de carregamento (N-13) não é testado** |
| `test_capture_challenge.py:166-283` | `persistent_replay_guard=False` | Replay em banco e sua resposta idempotente |
| `test_sessions_concurrency.py:26-99` | `presence_via_rpc=False` | Presença em produção (RPC `register_presence_event`) |
| `test_sessions_concurrency.py:85-104` | exceção 23505 injetada | Concorrência real (coberta só no PG) |
| `test_security_lgpd.py:449-491` | `refresh_embedding` e `validate_image` mockados; `assert res == expected` | Wiring de validação de imagem |
| `test_maintenance_and_fairness.py:12-56` | cadeia Supabase mockada | Nome de coluna real (`created_at` vs `captured_at`) |
| `test_rpc_security_hardening.py` | leitura de texto de migrations 14 e 20 | Comportamento; é teste estático de migrations superadas |
| `web/src/lib/e2e_all_flows.test.ts` | simulações próprias, sem importar código da app; embedding constante | Qualquer regressão real dos fluxos 2–5 |

### 2.2 Testes que deveriam falhar hoje e não falham

- Nenhum teste verifica o **login legado** em produção (AF-14). A verificação é de catálogo, em `PROD_STATE_SNAPSHOT.md`.
- Nenhum teste verifica **ausência** de credenciais compartilhadas, exceto o xfail de AF-01 (que falha hoje, corretamente).
- O teste de fairness (`test_evaluate_biometric_fairness_passes_criteria`) passa com dados aleatórios e não mede demografia (**N-25**).

## 3. Lacunas priorizadas

| Prioridade | Lacuna | Como fechar | Estado |
|---|---|---|---|
| P0 | Fail-open na checagem de duplicidade (N-13) | Teste que faz `_load_embeddings` falhar e exige 503 | Aberto |
| P0 | Remoção de credenciais compartilhadas (AF-01) | Desmarcar xfail no PR-3 | Aguarda tablet |
| P0 | Replay e presença com configuração de produção (AF-10) | Testes de banco sem patch de `persistent_replay_guard` e `presence_via_rpc` | Aberto |
| P1 | Cadeia de migrations 01→29 do zero (AF-07) | Baseline histórico + aplicação completa + comparação de catálogo | Aberto |
| P1 | Validação de imagem em todas as rotas (wiring) | Envio de bytes inválidos com autenticação válida para `/recognize`, `/enroll`, `refresh-embedding` | Aberto |
| P1 | Upload chunked e `Content-Length` inválido | Testes do `UploadGuard` | Aberto |
| P1 | Consentimento obrigatório (INV-05) | `consent=False` → 4xx e nada gravado | Aberto |
| P1 | Refresh não troca identidade (INV-10) | Template de outra pessoa → recusado | Aberto |
| P1 | Mobile: lógica pura (retry, identidade, janela, captura) | `node --test` em `mobile/lib/` (sem dependência nova) | Aberto (**AF-19**) |
| P2 | Web: decisões de auth, justificativa e câmera | Extrair para `web/src/lib/` e testar | Aberto |
| P2 | Contrato OpenAPI | Snapshot versionado (API-01…) | Aberto |
| P2 | Fairness e PAD com dados reais | Dataset consentido e rotulado | Bloqueado por dados |

## 4. Mocks aceitáveis (sem problema)

- Supabase Auth e chamadas de rede a serviços externos, quando o teste foca na regra da aplicação.
- InsightFace e ONNX em testes unitários de regra de decisão, desde que haja ao menos um teste de integração com modelo real (ausente hoje, **F\***).
- Relógio, quando o teste de janela e de sessão precisa de tempo controlado.

## 5. Padrão proposto

1. Toda correção de bug começa com teste que falha no `master` (regressão).
2. Testes de banco obrigatórios no CI, sem patch de flags de produção.
3. Nenhum teste novo com `MagicMock` para regra de banco ou de segurança.
4. Contagem de testes gerada por script e registrada no `CHANGELOG`, não digitada.
5. Limpeza de testes de texto (`test_rpc_security_hardening.py`) quando a migração correspondente for superada.

## 6. Como reproduzir

```bash
cd backend && python -m pytest -q                       # sem banco: testes de banco pulados
REQUIRE_DB_TESTS=1 TEST_DATABASE_URL=postgresql://postgres:test@localhost:5432/postgres python -m pytest -q
cd ../web && npm run test
```

Requer Postgres 17 com pgvector para o segundo comando. Sem isso, ele falha por design (AF-06).
