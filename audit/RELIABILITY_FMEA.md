# AILAB-FACIAL V4 — ANÁLISE DE MODOS DE FALHA & CONFIABILIDADE (FMEA)

**Data:** 13 de Setembro de 2026  
**Auditoria:** AILAB-FACIAL V4  
**Padrão:** FMEA (Failure Mode and Effects Analysis) / SRE Principles  
**Status:** AUDITED  

---

## 1. Matriz FMEA de Componentes Críticos

| Componente | Modo de Falha | Efeito do Modo de Falha no Sistema | Severidade (1-10) | Ocorrência (1-10) | Detecção (1-10) | RPN (Score de Risco) | Mitigação Implementada | Ação Recomendada |
|---|---|---|:---:|:---:|:---:|:---:|---|---|
| **Google Cloud Run** | Cold Start após ociosidade ($\approx 17$ s) | Tablet sofre timeout de requisição no primeiro aluno da manhã. | 6 | 7 | 2 | **84** | Ping periódico externo a cada 15 min via `cron-job.org` para `/health`. | Configurar `min-instances = 1` no Cloud Run durante os turnos do laboratório. |
| **Google Cloud Run** | OOM (Out of Memory Crash) por inferência concorrente | Container reinicia bruscamente; requisições em voo retornam HTTP 502/503. | 8 | 5 | 3 | **120** | Imagem alocada com 2 GiB de RAM e `--workers 1`. | Adicionar rate-limiting de concorrência (`--concurrency 8`) e validação de resolução máxima de imagem. |
| **Supabase (Postgres)** | Indisponibilidade de rede ou manutenção do cluster | Erro 500 em todas as chamadas de reconhecimento e cadastro. | 9 | 3 | 2 | **54** | Exception handler global intercepta e retorna JSON genérico. | Implementar buffer local offline no tablet com sync diferido (caso viável) ou mensagem explicativa clara na UI. |
| **pgvector RPC** | Falha na extensão ou timeout da RPC `match_face` | Falha ao buscar no banco via pgvector. | 5 | 3 | 2 | **30** | Fallback gracioso automático para busca de embeddings na memória RAM do container. | Mantido como controle exemplar de resiliência. |
| **Câmera do Tablet** | Travamento do hardware ou sensor ocupado | Erro ao disparar `takePictureAsync`. | 6 | 5 | 3 | **90** | Tentativa secundária com qualidade reduzida (0.80) e uso de `useCameraFocus` para reinicializar sensor. | Excelente tratamento defensivo no componente React Native. |
| **Cômputo de Presença** | Sessão esquecida em aberto (> 10h) | Distorção contábil das horas do aluno. | 7 | 8 | 5 | **280 (Crítico)** | Backend marca `voided_at` no sweep, mas o frontend ignora e credita as horas. | **P0 Imediato:** Corrigir `reports.ts` e `aggregate.ts` no frontend web. |
| **Rede Local Wi-Fi** | Queda momentânea da conexão do tablet | Aluno tenta bater ponto e app não conclui. | 6 | 6 | 3 | **108** | Exibição de alerta amigável com mensagem genérica em `RecognitionPanel`. | Adicionar retry exponencial automático com limite de 2 tentativas. |

---

## 2. Indicadores e Metas Operacionais (SLI / SLO)

| Indicador (SLI) | Definição Métrica | Meta Recomendada (SLO) | Situação Observada Atual |
|---|---|:---:|---|
| **Disponibilidade da API (`/health`)** | $\frac{\text{Requests com sucesso (2xx)}}{\text{Total de requests}} \times 100$ | **$\ge 99.5\%$** durante horário útil | Atingível com o keep-alive do cron-job.org, sujeito a cold starts esporádicos. |
| **Latência de Reconhecimento (p95)** | Tempo total de resposta do endpoint `/api/v1/recognize` | **$< 1.2$ segundos** | $\approx 450-800$ ms com instâncias quentes no Cloud Run São Paulo. |
| **Taxa de Erro de Inferência (5xx)** | Percentual de falhas não tratadas na inferência | **$< 0.1\%$** | Quase nulo para imagens padrão; risco com imagens desproporcionais. |
| **Taxa de Saídas Esquecidas Anuladas** | Percentual de sessões que sofrem auto-close pelo sweep | Meta pedagógica: **$< 5\%$** | Depende do treinamento comportamental dos alunos ao deixarem o laboratório. |

---

## 3. Política de Backup & Recuperação de Desastres (DR / RPO / RTO)

- **Backups do Banco de Dados:** Gerenciados nativamente pela plataforma Supabase (PostgreSQL WAL archiving diário no plano Pro / backups diários automáticos).
- **RPO (Recovery Point Objective):** Estimado em 24 horas (ou minutos com Point-in-Time Recovery - PITR).
- **RTO (Recovery Time Objective):** Estimado em 1 a 2 horas para restauração de novo projeto Supabase e atualização das variáveis no Cloud Run.
- **GAP DE SRE:** **Não há registro de simulação de restauração (Restore Testing)** no histórico do projeto. Conforme a regra operacional: *Backup não testado = recuperação não comprovada*.
