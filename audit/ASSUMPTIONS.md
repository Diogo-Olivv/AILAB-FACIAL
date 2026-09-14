# AILAB-FACIAL V4 — REGISTRO DE SUPOSIÇÕES OPERACIONAIS (ASSUMPTIONS)

**Data:** 13 de Setembro de 2026  
**Auditoria:** AILAB-FACIAL V4  
**Status:** AUDITED  

---

## 1. Registro Formal de Suposições

| ID | Suposição Arquitetural / Operacional | Impacto se a Suposição Falhar | Evidência Disponível | Confiança | Status Atual |
|---|---|---|---|:---:|:---:|
| **ASM-01** | **O tablet da entrada opera em ambiente físico seguro e supervisionado por tutores.** | Ataques de apresentação física (fotos impressas, telas de celulares) tornam-se muito mais prováveis sem supervisão visual humana. | O laboratório AILAB possui bancadas e tutores presentes em horário de funcionamento. | ALTA | **ASSUMED** |
| **ASM-02** | **A conexão HTTPS entre clientes e Cloud Run é imune a adulteração em trânsito (TLS íntegro).** | Se o tráfego puder ser interceptado (ex: certificados raiz comprometidos no tablet), credenciais e frames podem ser lidos. | O Google Cloud Run termina TLS com certificados gerenciados oficialmente pela Google Trust Services. | ALTA | **VERIFIED** |
| **ASM-03** | **O relógio dos servidores Cloud Run e Supabase mantém sincronização NTP precisa.** | Desvios de relógio (clock skew) poderiam quebrar tokens JWT do Supabase Auth e janelas de histerese (debounce de 60s). | Ambientes gerenciados do Google Cloud e AWS (onde roda o Supabase) possuem servidores NTP sincronizados com relógios atômicos. | ALTA | **VERIFIED** |
| **ASM-04** | **Nenhum usuário fora do corpo de tutores possui conta no Supabase Auth.** | Se signups públicos estiverem ativados no painel do Supabase, qualquer pessoa da internet pode criar conta e se passar por usuário autenticado. | O `web/README.md` instrui desativar signups públicos no Supabase Studio, mas a configuração não pode ser auditada no repositório de código (depende de configuração em nuvem). | MÉDIA | **ASSUMED (Requer Checagem no Console)** |
| **ASM-05** | **A base de membros do laboratório não ultrapassará 100 a 150 alunos simultâneos no modelo 1:N.** | Se a base crescer para milhares de alunos, a taxa de falsa identificação em conjunto aberto tornará o sistema operacionalmente inviável. | O escopo atual atende a um único laboratório de extensão de makerspace universitário. | ALTA | **VALID FOR V4** |
