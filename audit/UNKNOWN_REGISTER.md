# AILAB-FACIAL V4 — REGISTRO DE INCÓGNITAS (UNKNOWN REGISTER)

**Data:** 13 de Setembro de 2026  
**Auditoria:** AILAB-FACIAL V4  
**Regra Operacional:** *Ausência de evidência não é evidência de segurança. Nunca transforme UNKNOWN em VERIFIED.*  

---

## 1. Registro Formal de Incógnitas

| ID | Incógnita / Comportamento Não Comprovado | Impacto Técnico e de Negócio | Por que é Desconhecido (Why Unknown) | Como Verificar / Comprovar | Responsável / Dependência |
|---|---|---|---|---|---|
| **UNK-01** | **Taxa Real de Falsos Rejeites (FNMR) sob Iluminação Noturna do Laboratório** | Alunos legítimos não conseguem bater ponto à noite, gerando atrito e reclamações. | O teste foi realizado com imagens sintéticas e mocks; não há medições de iluminação em lumens/lux do laboratório real. | Coletar 200 capturas voluntárias durante o horário noturno real e calcular a taxa de rejeição observada. | Equipe de Validação Local / Hardware Tablet |
| **UNK-02** | **Taxa de Evasão do MiniFASNetV2 contra Telas OLED de Alta Resolução em Ângulos Oblíquos** | Possibilidade de fraude física com smartphone avançado driblando o anti-spoofing. | Não há dataset local com ataques de apresentação controlados (PAI) gerados com displays OLED modernos. | Executar benchmark com 50 vídeos de ataque em 3 aparelhos distintos (iPhone, Galaxy S, Xiaomi) conforme ISO 30107. | Engenheiro de Visão Computacional |
| **UNK-03** | **Tempo Real de Recuperação de Desastre (RTO) do Supabase via Backups Gerenciados** | Indisponibilidade prolongada do sistema em caso de corrupção ou exclusão acidental do banco. | A equipe nunca realizou uma simulação de restore a partir de snapshot do Supabase em um projeto novo. | Realizar exercício de disaster recovery em ambiente de homologação e cronometrar o RTO. | Engenheiro de SRE / Infraestrutura |
| **UNK-04** | **Comportamento da Latência de Consulta HNSW com Galeria Superior a 5.000 Membros** | Degradação de desempenho e aumento de tempo de resposta em caso de expansão para toda a universidade. | A galeria atual é dimensionada para menos de 100 integrantes; testes de estresse com 5.000 vetores não foram rodados no Postgres real. | Script de carga gerando 5.000 vetores 512-D sintéticos no Supabase e medindo a latência p95 da RPC `match_face`. | Database Engineer / DBA |
| **UNK-05** | **Disparidade de Falso Rejeite entre Tons de Pele (Escala Fitzpatrick I a VI)** | Possibilidade de viés algorítmico demográfico no modelo MobileFaceNet. | Ausência de dataset anotado por atributos demográficos no escopo acadêmico do laboratório. | Conduzir estudo de fairness demográfico com consentimento ético dos participantes. | AI Governance / AI Ethics Lead |
