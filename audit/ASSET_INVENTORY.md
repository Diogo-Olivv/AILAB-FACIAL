# AILAB-FACIAL V4 — INVENTÁRIO & CLASSIFICAÇÃO DE ATIVOS

**Data:** 13 de Setembro de 2026  
**Auditoria:** AILAB-FACIAL V4  
**Status:** AUDITED  

---

## 1. Classificação de Ativos Críticos

| ID do Ativo | Descrição do Ativo | Classificação de Confidencialidade | Classificação de Integridade | Classificação de Disponibilidade | Impacto em Privacidade (LGPD) | Impacto em Fraude | Blast Radius (Raio de Destruição) |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **AST-01** | **Vetores Biométricos Faciais (Embeddings 512-D)** | **CONFIDENCIAL** | **CRÍTICO** | **ALTO** | **CRÍTICO (Dado Biométrico Sensível Art. 5º II)** | ALTO (Permite autenticação forjada) | **Total:** Comprometimento irreversível da identidade biométrica dos integrantes cadastrados. |
| **AST-02** | **Chave Privada `SUPABASE_SERVICE_KEY`** | **RESTRITO / SEGREDO** | **CRÍTICO** | **CRÍTICO** | **CRÍTICO** | CRÍTICO (Bypass de todo o controle de acesso) | **Catastrófico:** Acesso de leitura e escrita irrestrito a todas as tabelas, bypass de RLS e expurgo do banco. |
| **AST-03** | **Chave de Inferência `KIOSK_API_KEY`** | **INTERNO / SEGREDO** | **MÉDIO** | **ALTO** | BAIXO | ALTO (Injeção de presenças forjadas) | **Parcial:** Permite que atacantes com a chave enviem frames diretamente para a API de reconhecimento. |
| **AST-04** | **Tokens JWT de Tutor (Supabase Auth)** | **CONFIDENCIAL** | **ALTO** | **MÉDIO** | ALTO (Permite revogação e cadastro não autorizado) | ALTO | **Alto:** Permite cadastrar novos alunos, sobrescrever vetores ou apagar registros de presença. |
| **AST-05** | **Registros de Presença e Sessões (`sessions`)** | **CONFIDENCIAL** | **CRÍTICO** | **ALTO** | MÉDIO (Dados de rotina física e horários) | CRÍTICO (Adulteração de horas acadêmicas) | **Médio:** Distorção de relatórios e certificações acadêmicas de extensão. |
| **AST-06** | **Pesos dos Modelos ONNX (`pad.onnx` / `buffalo_s`)** | **PÚBLICO / INTERNO** | **CRÍTICO** | **ALTO** | BAIXO | ALTO (Possibilidade de evasão adversarial direcionada) | **Médio:** Corrupção de artefatos impede o startup do container ou causa bypass generalizado de PAD. |
| **AST-07** | **Metadados dos Perfis (`profiles`)** | **CONFIDENCIAL** | **ALTO** | **MÉDIO** | ALTO (Nome, Matrícula, Status de Consentimento) | MÉDIO | **Médio:** Vazamento de lista de estudantes ativos do laboratório e matrículas institucionais. |
| **AST-08** | **Logs de Auditoria de Reconhecimento (`face_logs`)** | **CONFIDENCIAL** | **MÉDIO** | **BAIXO** | BAIXO | MÉDIO (Destruição de trilha de auditoria) | **Baixo:** Perda de rastreabilidade forense sobre reconhecimentos passados. |

---

## 2. Matriz de Controles por Ativo

### AST-01: Vetores Biométricos Faciais (`face_embeddings`)
- **Controles em Trânsito:** TLS 1.3 obrigatório em conexões Cloud Run e Supabase SSL.
- **Controles em Repouso:** Criptografia transparente em disco no PostgreSQL (Supabase AES-256).
- **Controles de Acesso:** Row Level Security (RLS) sem nenhuma policy para roles `anon` ou `authenticated`; acessível exclusivamente pela role `service_role`.
- **Gaps Identificados:** Os vetores em ponto flutuante são armazenados em texto claro dentro da coluna `embedding` (float array) e `vec` (pgvector). Se um backup do banco de dados for exfiltrado ou a chave service role for comprometida, todos os vetores ficam expostos em formato bruto. Não há criptografia de aplicação nem aplicação de biometria cancelável / hashing bio-criptográfico.

### AST-02: Chave Privada `SUPABASE_SERVICE_KEY`
- **Controles em Trânsito:** Injetada diretamente como variável de ambiente no Google Cloud Run via Secret Manager.
- **Controles no Código:** Utilizada apenas no singleton `backend/app/db/supabase_client.py`. Nunca enviada para clientes frontend.
- **Gaps Identificados:** O histórico de commits do repositório continha variáveis com formatos de chave. Requer validação periódica via Secret Scanning automatizado no GitHub.

### AST-03: Chave de Inferência `KIOSK_API_KEY`
- **Controles:** Validação timing-safe via `secrets.compare_digest` no backend (`deps.py`).
- **Gaps Identificados:** A chave é embutida em texto claro no aplicativo compilado do tablet (`EXPO_PUBLIC_KIOSK_KEY`). Por definição de arquitetura mobile, qualquer chave embutida em cliente público é considerada pública / comprometida por atacantes determinados.
