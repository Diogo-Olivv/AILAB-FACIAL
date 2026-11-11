# Modelo de RIPD (relatório de impacto à proteção de dados)

> Estrutura baseada no guia da ANPD sobre RIPD (art. 38 da LGPD). **Campos marcados como "a preencher" dependem do controlador e do encarregado.** Este modelo não preenche decisões jurídicas.
> Pré-preenchido com fatos do sistema em 2026-11-11 (base `master@5f1d99c`).

## 1. Identificação

- **Controlador:** a preencher (laboratório de extensão).
- **Encarregado:** a preencher (DP-7).
- **Sistema:** AILAB-FACIAL — controle de presença por reconhecimento facial.
- **Responsável técnico:** a preencher.
- **Data de elaboração:** a preencher. **Data desta base:** 2026-11-11.

## 2. Necessidade de elaborar o RIPD

Justificativa: tratamento de **dado biométrico** (dado pessoal sensível, art. 5º, II) por reconhecimento facial automatizado, com risco de dano aos titulares se houver falha de segurança ou de precisão.

## 3. Descrição do tratamento

### 3.1 Dados pessoais tratados

| Dado | Categoria | Sensível? | Origem | Finalidade |
|---|---|---|---|---|
| Vetor facial (embedding, 512 dimensões) | Biométrico | **Sim** | Foto no cadastro e na presença | Reconhecer o integrante |
| Nome | Identificação | Não | Tutor, no cadastro | Exibir presença |
| Matrícula | Identificação | Não | Tutor, no cadastro | Identificar o integrante |
| Avatar (imagem de perfil, 256 px) | Imagem | Pode revelar características | Tutor | Exibir no painel e no totem |
| Horários de entrada e saída | Comportamento | Não | Sistema | Calcular horas |
| Tentativas de reconhecimento (`face_logs`) | Comportamento | Não, mas liga a biometria à ação | Sistema | Auditoria e diagnóstico (90 dias) |
| Justificativas de débito (texto livre) | Pode conter saúde | **Pode ser** | Tutor | Registrar justificativa |
| Consentimento (flag e data) | Registro | Não | Integrante, por aceite | Base do tratamento |

### 3.2 Titulares

Integrantes do laboratório, incluindo menores de idade se houver (DP-8: a preencher).

### 3.3 Volume

A preencher: número de integrantes cadastrados e de registros de presença por período.

### 3.4 Fluxo dos dados

Ver `docs/explanation/architecture.md` e `audit/FLOWS.md`.

### 3.5 Compartilhamento e operadores

| Operador | Papel | Região | Contrato (DPA) |
|---|---|---|---|
| Supabase | Banco e autenticação | `sa-east-1` | a verificar |
| Google Cloud (Cloud Run) | Processamento da API | `southamerica-east1` | a verificar |
| Expo | Distribuição do app | — | a verificar |
| GitHub | Código, páginas e CI (não recebe dados pessoais, desde que o repositório não os contenha) | — | a verificar |

### 3.6 Retenção

Ver `docs/privacy/retention-policy.md`. Prazos pendentes: DP-3, DP-4, DP-5, DP-6.

## 4. Base legal

| Finalidade | Base proposta | Estado |
|---|---|---|
| Reconhecimento facial para presença | Consentimento específico (art. 11, I) ou outra base escolhida pelo controlador | **DP-1: a decidir** |
| Justificativas de débito | A definir | **DP-2** |

## 5. Avaliação de necessidade e proporcionalidade

Perguntas a responder (a preencher):

- Há alternativa sem biometria que atenda à finalidade (lista de assinatura, cartão, QR)?
- O uso de biometria é o mínimo necessário?
- O prazo de retenção é o mínimo necessário?

## 6. Riscos aos titulares

| Risco | Probabilidade | Impacto | Controle atual | Lacuna |
|---|---|---|---|---|
| Vazamento do banco ou do template | Média (I) | Alto | RLS, chave de serviço só no backend, BioHash | Credenciais expostas (AF-01, AF-02); semente padrão pública (N-12) |
| Acesso indevido por totem roubado | Média | Alto | Conta por dispositivo (desejado) | Chave compartilhada ainda ativa (AF-04) |
| Falsa aceitação (pessoa diferente reconhecida) | A medir | Alto | Limiares | Não medido (ml/model-card.md) |
| Falsa rejeição | A medir | Médio | Limiares | Não medido |
| Exposição de nome e matrícula em log | Média (I) | Médio | — | N-16 |
| Impossibilidade de exclusão | Alta (I) | Médio | Revogação | Justificativas bloqueiam exclusão (N-21) |
| Dano por justificativa com dado de saúde | Baixa (I) | Alto | — | Texto livre sem limite nem prazo (DP-5) |
| Viés demográfico | A medir | Alto | — | Não medido (N-25) |

## 7. Medidas, salvaguardas e mecanismos de mitigação

Medidas em vigor (F): RLS, separação de chaves, desafio com validade curta, anti-replay, PAD, validação de upload, auditoria parcial.

Medidas pendentes: ver `audit/REMEDIATION_STATUS.md`. Lista resumida: AF-01, AF-02, AF-03, AF-04, AF-14, AF-25, AF-26, N-03, N-05, N-08, N-13, N-16, N-21.

## 8. Aprovação

- Responsável: a preencher.
- Encarregado: a preencher.
- Data: a preencher.
- Revisão prevista: a cada mudança de modelo, de banco ou de finalidade, e ao menos uma vez por ano.
