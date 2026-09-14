# AILAB-FACIAL V4 — MATRIZ DE ACEITAÇÃO DE RISCOS (RISK ACCEPTANCE)

**Data:** 13 de Setembro de 2026  
**Auditoria:** AILAB-FACIAL V4  
**Regra:** *Não assuma que risco residual simplesmente desaparece. Todo risco não corrigido deve possuir owner, justificativa de negócio e data de revisão.*  

---

## 1. Matriz de Riscos Residuais e Aceitação

| Risco Residual | Severidade | Risco Residual Estimado | Mitigação Provisória / Controle Compensatório | Decisão de Aceitação | Justificativa de Negócio | Owner Responsável | Data de Revisão |
|---|:---:|:---:|---|:---:|---|---|:---:|
| **Injeção Digital HTTP sem Nonce (F-002)** | CRITICAL | **MÉDIO / ALTO** | Restrição de IP do Cloud Run para a rede Wi-Fi do laboratório; supervisão presencial do tablet por tutores. | ⚠️ **CONDICIONAL** | Requer desenvolvimento de módulo de nonce e novo deploy de APK. Aceito provisoriamente apenas com whitelisting de IP no Cloud Run. | Tech Lead / Security Lead | 15/10/2026 |
| **Ausência de Sensor de Profundidade 3D (PAD)** | HIGH | **BAIXO / MÉDIO** | Rede neural MiniFASNetV2 e presença física de monitores/tutores no balcão de entrada do laboratório. | ✅ **ACEITO** | Custo proibitivo de aquisição de tablets corporativos com câmera TrueDepth/IR para o laboratório acadêmico. | Coordenador do AILAB | 01/03/2027 |
| **Limitação Matemática de 1:N Open-Set ($N < 150$)** | HIGH | **BAIXO** | O laboratório possui atualmente menos de 80 alunos ativos. Threshold estrito mantido em $\cos \ge 0.68$. | ✅ **ACEITO** | O tamanho da população atual é pequeno o suficiente para manter a taxa de falsa identificação sob controle ($\text{FPIR} < 8\%$). | Biometrics Lead | 01/12/2026 |
| **Cold Start de 17s no Primeiro Request** | MEDIUM | **BAIXO** | Ping periódico a cada 15 minutos pelo `cron-job.org` entre 07h e 21h mantendo o container aquecido. | ✅ **ACEITO** | Restrição orçamentária do projeto de extensão (manter instâncias mínimas 24/7 geraria custos no Google Cloud). | SRE / DevOps Lead | 01/11/2026 |
| **Exposição de Lista de Membros Ativos via Supabase Anon** | MEDIUM | **BAIXO** | RLS restringe dados expostos estritamente a `id`, `name` e `avatar_url`. Nenhum dado biométrico ou de contato é exposto. | ✅ **ACEITO** | Necessário para exibir a barra lateral pública de integrantes presentes no tablet da entrada. | Privacy Lead | 01/02/2027 |
