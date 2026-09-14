# AILAB-FACIAL V4 — GOVERNANÇA DE INTELIGÊNCIA ARTIFICIAL & GESTÃO DE RISCOS

**Data:** 13 de Setembro de 2026  
**Auditoria:** AILAB-FACIAL V4  
**Framework de Análise:** NIST AI RMF 1.0 (GOVERN, MAP, MEASURE, MANAGE) / OECD AI Principles  
**Status:** AUDITED  

---

## 1. Estrutura NIST AI RMF

```
   ┌─────────────────────────────────────────────────────────┐
   │                         GOVERN                          │
   │  Cultura de responsabilidade, políticas e conformidade  │
   └────────────────────────────┬────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
   ┌─────────┐             ┌─────────┐             ┌─────────┐
   │   MAP   │  ───────>   │ MEASURE │  ───────>   │ MANAGE  │
   │ Contexto│             │ Métricas│             │ Mitigação│
   │ Riscos  │             │ Impacto │             │ Monitor. │
   └─────────┘             └─────────┘             └─────────┘
```

---

## 2. Auditoria por Pilar NIST AI RMF

### 2.1 GOVERN (Governança & Políticas Organizacionais)
- **Propósito Declarado (Intended Use):** Controle automatizado de frequência e registro de permanência de alunos vinculados a projetos de extensão universitária no AILAB Makers.
- **Usos Proibidos (Prohibited Uses):** Vigilância ostensiva contínua, rastreamento de comportamento, identificação em massa sem consentimento, comercialização de dados ou compartilhamento com órgãos externos de segurança pública.
- **Accountability & Responsáveis:** O repositório não documenta com clareza o comitê ou responsável formal de IA (AI Risk Owner).
- **Gaps Identificados:** Inexistência de política formal de desativação/aposentadoria de modelos (Model Retirement Policy) e ausência de processo de revisão ética de IA.

### 2.2 MAP (Mapeamento de Contexto & Riscos de IA)
- **Atores Afetados:** Estudantes universitários, tutores de laboratório, coordenadores de extensão acadêmica e visitantes eventuais do laboratório.
- **Riscos Sociais e de Direitos:**
  - *Falso Rejeite Crítico:* Aluno tem sua presença recusada sistematicamente devido a iluminação ou viés algorítmico e perde horas de bolsa acadêmica.
  - *Falso Aceite de Terceiro:* Aluno tem horas computadas no nome de colega por proximidade biométrica indevida.
  - *Function Creep (Desvio de Finalidade):* Possibilidade de coordenadores utilizarem os registros de timestamps para fins disciplinares punitivos não previstos no termo de consentimento inicial.

### 2.3 MEASURE (Medição, Métricas & Avaliação de Impacto)
- **Métricas Documentadas:** Nenhuma documentação formal de matriz de confusão local ou cálculo de Disparate Impact Ratio.
- **Auditoria de Viés Demográfico (Fairness):**
  - O modelo `buffalo_s` (InsightFace MobileFaceNet) foi treinado primariamente no dataset WebFace600K. Estudos da literatura (NIST FRVT) apontam variações mensuráveis de taxa de falso match/falso não-match entre subgrupos de gênero e tons de pele em arquiteturas MobileFaceNet quando comparadas a redes ResNet-100 mais profundas.
  - O AILAB-FACIAL não possui testes empíricos de taxa de aceitação desproporcional entre grupos demográficos locais.

### 2.4 MANAGE (Gestão de Riscos & Supervisão Humana)
- **Supervisão Humana (Human-in-the-Loop):**
  - No fluxo de reconhecimento em tempo real no tablet, a decisão de bater ponto é **100% automatizada** e imediata. Não há aprovação prévia de um tutor para validar o match biométrico.
  - A supervisão humana opera apenas **ex-post (a posteriori)**: tutores podem acessar o dashboard web, auditar horas e identificar registros incoerentes.
- **Tratamento da Incerteza:**
  - O código implementa uma "Zona Incerta" ($0.62 \le \cos < 0.68$).
  - **Falha de Implementação:** Embora o status retornado seja `uncertain`, a interface móvel apenas emite um aviso genérico de "Não Reconhecido: Similaridade insuficiente para reconhecimento automático", sem oferecer um mecanismo imediato de fallback assistido (ex: digitação de PIN ou verificação manual pelo tutor na hora).

---

## 3. Matriz de Salvaguardas contra Mau Uso (Anti-Misuse Safeguards)

| Risco de Mau Uso / Abuso | Salvaguarda Técnica Implementada | Eficácia Atual | Requisito Pendente |
|---|---|:---:|---|
| **Vigilância Massiva / Varredura Contínua** | A câmera do tablet opera apenas sob demanda do aluno (botões "Entrada" / "Saída"). Não há loop contínuo de background escaneando passantes. | **ALTA** | Manter a política estrita de não filmagem contínua. |
| **Rastreamento de Transeuntes** | `select_primary_face` descarta faces distantes e prioriza o centro da imagem. | **MÉDIA** | Limitar campo de visão físico da câmera para focar exclusivamente no ponto de captura. |
| **Vazamento e Proliferação de Vetores** | Supabase RLS sem política de SELECT para clientes; acesso exclusivo via `service_role`. | **ALTA** | Criptografia na camada de aplicação antes da persistência no banco de dados. |
| **Override Arbitrário por Tutores** | O painel web atual não possui botão direto de edição manual de timestamps em `sessions`. | **MÉDIA** | Implementar auditoria imutável caso seja criada interface de ajuste manual de horas. |
