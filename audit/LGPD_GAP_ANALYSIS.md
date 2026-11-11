# Análise de lacunas LGPD (Lei 13.709/2018)

> Revisado em 2026-11-11 · base `master@5f1d99c` · **Não é parecer jurídico.** Mapeia controles técnicos e lacunas contra artigos da LGPD. Decisões de base legal, retenção e encarregado são do controlador (laboratório) e de seu encarregado.
> Legenda: **F** fato no código ou no banco · **F\*** relatado, não reconfirmado · **I** inferência · **NV** não verificado · **DP-n** decisão do controlador pendente.

## 1. Enquadramento

- **Dado biométrico é dado pessoal sensível** (art. 5º, II). O sistema trata: imagem facial (transitória), vetor de embedding (`face_embeddings`), nome, matrícula, avatar, horários de presença, justificativas de débito (podem conter texto livre sensível, como saúde).
- **Tratamento em escala pequena, em ambiente educacional/laboratório**, mas com reconhecimento facial automatizado: o guia da ANPD sobre RIPD (`gov.br/anpd`) indica elaboração quando há risco alto, e biometria é citada pela própria ANPD como tema prioritário da Agenda Regulatória (F\*, pesquisa web de 2026-11-11).
- **Recomendação:** elaborar RIPD (art. 38) antes de retomar o uso em produção. Modelo em `docs/privacy/RIPD.md` (a criar).

## 2. Bases legais e finalidade

| Tratamento | Base legal possível | Estado | Lacuna |
|---|---|---|---|
| Cadastro biométrico de integrante | Consentimento específico e destacado (art. 11, I) | Checkbox obrigatório no app e no web (F, README) | Consentimento não tem versão gravada (`terms_version` não é persistido, **N-21** F\*). Não há prova de texto mostrado. |
| Registro de presença por reconhecimento | Consentimento (art. 11, I) ou obrigação/execução de política pública conforme enquadramento do controlador | Não definido formalmente | **DP-1**: escolher a base e documentar |
| Justificativas de débito | Legítimo interesse ou execução de contrato/regulamento do laboratório | Sem registro de base | **DP-2**; o texto livre pode conter dado de saúde (art. 11), que exige base própria |
| Avisos disciplinares | Idem | Só em `localStorage` (**AF-29**, F) | Sem registro seguro nem trilha |
| Horas e relatórios | Execução de atividade do laboratório | — | Relatórios oficiais com SHA-256 calculado no cliente, sem verificabilidade (F\*) |

## 3. Princípios (art. 6º) e controles

| Princípio | Controle existente (F) | Lacuna |
|---|---|---|
| Necessidade e minimização | Imagens não são persistidas (F, README); vetor de 512 dimensões | `avatar_url` em base64 no banco (F\*, ver `UX_ACCESSIBILITY_AUDIT.md`, achado UX-09); listagem de membros no totem com nome e matrícula (F\*, UX-08) |
| Finalidade | Presença e horas | Justificativas com texto livre sem limite de uso |
| Adequação | — | — |
| Livre acesso e transparência | Painel do tutor | Titular não tem tela para ver os próprios dados (F\*) |
| Qualidade | Limiares com defaults e documentação divergente (**N-15**, F) | Sem medição de FAR/FRR com dados reais (F) |
| Segurança | RLS, JWT, RPCs, chaves de sistema por serviço | Credencial mestra (**AF-01**), segredos públicos (**AF-02**), anon com SELECT em perfis (**AF-25**), proteção contra senha vazada desligada (**AF-26**) |
| Prevenção | Rate limit; PAD; replay guard | Rate limit por processo (**N-23**); falhas de detecção sem alerta (**N-17**) |
| Não discriminação | Teste de fairness com dados sintéticos | `fairness_audit.py` sempre passa e não mede demografia (**N-25**, F) |
| Responsabilização e prestação de contas | `admin_audit_log` (migração 26) | Auditoria incompleta (**N-05**, F\*); auditoria pode falhar em silêncio (**N-04**, F\*) |

## 4. Direitos do titular (art. 18)

| Direito | Controle | Estado | Lacuna |
|---|---|---|---|
| Confirmação e acesso (I, II) | — | **Não existe** canal para o titular | Criar fluxo de solicitação (`docs/how-to/handle-dsar.md`) e resposta com dados do próprio titular |
| Correção (III) | Tutor edita perfil e refaz template | Parcial | Sem trilha ao titular |
| Anonimização, bloqueio ou eliminação (IV) | `revoke-consent` e `delete` (migração 26) | Revogação não limpa nome, matrícula, avatar nem fecha sessão (**N-08, N-21**, F\*) | Erasure bloqueada por justificativas (409) |
| Portabilidade (V) | — | Não existe | Exportação do próprio histórico |
| Informação sobre compartilhamento (VII) | — | Não documentado | Listar operadores: Supabase, Google Cloud (Cloud Run), Expo (distribuição), GitHub (Pages/CI) |
| Revogação do consentimento (IX) | `revoke-consent` | Só pelo tutor; não pelo titular | Fluxo de autoatendimento ou canal formal |

## 5. Operadores e transferência

- **Supabase** (banco, autenticação, região `sa-east-1`, São Paulo): operador. Contrato de tratamento e DPA a verificar (NV).
- **Google Cloud Run** (API, região `southamerica-east1`): operador. Logs de requisição podem conter dados (ver **N-16**). Retenção de logs da plataforma: NV.
- **Expo / EAS** (builds e atualizações OTA): distribui código; não recebe dados de integrantes (F\*).
- **GitHub** (repositório público, Pages, Actions): **nenhum dado pessoal pode estar no repositório.** Hoje há uma credencial de totem e seed com e-mail de tutor no histórico (**AF-02**, **N-01**).

Transferência internacional: não identificada por este mapeamento (F\* com base na região); confirmar com os contratos (NV).

## 6. Retenção (art. 15 e 16)

| Dado | Retenção atual (F) | Problema |
|---|---|---|
| Imagens faciais | Não persistidas (F\*) | Mantidas na memória do chamador até coleta de lixo (**N-27**) |
| Embeddings | Até revogação ou exclusão do perfil | Política formal não existe (**DP-3**) |
| `face_logs` (tentativas) | 90 dias (`maintenance.py:18`) | Purga falha em silêncio (**N-18**) |
| `recognition_requests` (replay) | 300 s (`config.py` e migração 25) | Purga sem chamador (**N-18**) |
| `sessions` (presença e horas) | Sem prazo | Política necessária (**DP-4**) |
| Justificativas | Sem prazo; RESTRICT impede erasure | Texto livre sensível (**DP-5**, **N-21**) |
| `admin_audit_log` | Sem prazo | Política necessária (**DP-6**) |
| Logs da aplicação | Cloud Logging: prazo da plataforma (NV) | Nomes em log (**N-16**) |

## 7. Incidentes (arts. 46–49)

- **Comunicação à ANPD e aos titulares em prazo razoável** (art. 48): sem procedimento documentado. Criar `docs/runbooks/incident-response.md`.
- **Detecção:** insuficiente (**N-17**). Sem alarme para falha de autenticação em massa, nem para acesso anômalo a `face_embeddings`.
- **Encarregado:** não designado (**DP-7**). Art. 41 exige canal público.

## 8. Decisões pendentes do controlador

| ID | Decisão | Quem |
|---|---|---|
| DP-1 | Base legal do reconhecimento para presença | Controlador + encarregado |
| DP-2 | Base legal das justificativas e tratamento de texto de saúde | Controlador + encarregado |
| DP-3 | Prazo de retenção de embeddings após desligamento do integrante | Controlador |
| DP-4 | Prazo de retenção de sessões e horas | Controlador |
| DP-5 | Política de texto livre em justificativas (limite, eliminação) | Controlador |
| DP-6 | Retenção de `admin_audit_log` | Controlador |
| DP-7 | Designação do encarregado e canal público | Controlador |
| DP-8 | Enquadramento de menores (há integrantes menores de 18 anos?) | Controlador. Exige proteção reforçada (art. 14) se houver |
| DP-9 | Contratos com operadores (DPA) | Controlador |

## 9. Lacunas técnicas priorizadas

1. Remover segredos e credenciais do repositório e do histórico (**AF-01, AF-02, N-01**). Bloqueante.
2. Fechar fail-open na checagem de duplicidade (**N-13**). Bloqueante para biometria.
3. Corrigir revogação e exclusão para limpar dados pessoais e encerrar sessões (**N-08, N-21**).
4. Completar auditoria de ações administrativas (**N-05**) e tornar falha de auditoria visível (**N-04**).
5. Parar de logar nomes e IDs de candidatos (**N-16**).
6. Canal do titular para acesso e portabilidade.
7. RIPD e registro de operações de tratamento (art. 37).

## 10. Limites deste documento

- Não avalia contratos com operadores, políticas da plataforma de hospedagem nem o aviso de privacidade publicado (não localizado no repositório).
- Não substitui parecer de advogado ou do encarregado.
- Afirmações de conformidade só podem ser feitas com evidência: este documento lista controles e lacunas, não declara conformidade.
