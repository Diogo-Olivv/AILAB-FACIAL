# Oportunidades de produto, ranqueadas

> Revisado em 2026-11-11 · base `master@5f1d99c` · **Só documentação e priorização.** Nada aqui foi implementado.
> Método: valor (1–5) × confiança (1–5) ÷ esforço (1–5), o modelo ICE adaptado. Esforço é estimativa de ordem de grandeza, não de prazo.
> Antes de qualquer item virar tarefa, é preciso confirmar o achado de origem (ver `UX_ACCESSIBILITY_AUDIT.md`).

## 1. Visão de produto

Hoje o sistema é um controle de presença de um laboratório, com totem, painel de tutor e reconhecimento facial. Para ser referência, precisa de quatro coisas que ainda não existem: **confiança verificável** (o integrante e o laboratório conseguem ver o que foi feito), **privacidade operável** (direitos do titular atendíveis sem intervenção manual), **operação de frota** (vários totens, vários laboratórios) e **qualidade mensurável** (acurácia e fairness medidas com dados reais).

## 2. Ranking

| # | Oportunidade | Valor | Confiança | Esforço | ICE | Dependências | Achado de origem |
|---|---|---|---|---|---|---|---|
| 1 | **Detecção facial no dispositivo antes de capturar** (fim do Auto-Scan cego) | 5 | 5 | 2 | 12,5 | Biblioteca de detecção no Expo | UX-02, AF-27 |
| 2 | **Autoatendimento de privacidade**: o integrante vê dados, consentimento e histórico, e pode revogar ou excluir | 5 | 4 | 3 | 6,7 | Identificação segura (matrícula + verificação), termo versionado, RPCs de LGPD | LGPD_GAP §4 |
| 3 | **Auditoria completa e visível**: cada ação de tutor e de sistema gera evento; tela de auditoria para o coordenador | 5 | 4 | 3 | 6,7 | `admin_audit_log` com inserção apenas, N-05 | N-04, N-05 |
| 4 | **Fila offline de registro no totem**: reenvio com marca de tempo e indicador "pendente de sincronização" | 4 | 4 | 3 | 5,3 | Idempotência (já existe `recognition_requests`) | F\* em UX-03 e falhas de rede |
| 5 | **Gestão de frota de totens**: lista, versão, último contato, revogação; provisionamento sem chave compartilhada | 5 | 4 | 3 | 6,7 | AF-01 e AF-04 resolvidos; provisionamento do tablet | UX-16, AF-04 |
| 6 | **Regras no servidor**: metas, janelas, horários e fuso por laboratório, com API em vez de constantes no cliente | 4 | 4 | 4 | 4,0 | Modelo multi-laboratório | UX-07, UX-10, F-28 |
| 7 | **Cadastro guiado**: orientação de pose, qualidade por foto, aceite do termo pelo próprio titular | 4 | 4 | 3 | 5,3 | Detecção no dispositivo (item 1) | UX-05, UX-06 |
| 8 | **Painel de qualidade biométrica**: FAR, FRR, APCER e BPCER medidos em dataset rotulado e publicados por versão de modelo | 5 | 3 | 4 | 3,8 | Dataset consentido e rotulado (não existe no repositório) | ML/ `docs/ml/` |
| 9 | **Relatórios exportáveis**: CSV por sessão, PDF com número de relatório emitido pelo servidor e página de verificação | 3 | 4 | 2 | 6,0 | Número sequencial no servidor | UX-31, UX-32 |
| 10 | **Notificações**: sessão aberta além do limite, débito semanal, falha de totem | 3 | 3 | 3 | 3,0 | Canal (e-mail ou push) e preferências | N-18, N-19 |
| 11 | **Papéis de acesso**: tutor, coordenador (somente leitura), auditor | 4 | 4 | 3 | 5,3 | Autorização por papel na RLS | AF-03, UX-33 |
| 12 | **Migração de avatares para Storage** com miniaturas | 3 | 4 | 2 | 6,0 | Política de retenção de imagens | UX-09 |
| 13 | **Internacionalização** (pt-BR com en e es): tabelas de texto, datas por `tz.ts` | 2 | 3 | 2 | 3,0 | Nenhuma | UX-29 |
| 14 | **Onboarding de laboratório**: assistente de configuração (totem, tutores, metas, termo) | 3 | 3 | 4 | 2,3 | Itens 5, 6 e 11 | — |
| 15 | **Modo de manutenção de totem**: tela de diagnóstico (câmera, rede, relógio, versão) | 3 | 4 | 2 | 6,0 | — | UX-19 |

## 3. Ordem recomendada

**Fase A — confiança (antes de voltar a operar com dados reais):** itens 1, 3, 5 e os bloqueadores de segurança de `REMEDIATION_STATUS.md`.

**Fase B — privacidade operável:** itens 2, 7 e 12. Só depois do RIPD (ver `LGPD_GAP_ANALYSIS.md`).

**Fase C — escala:** itens 6, 11, 14 e 4.

**Fase D — qualidade e transparência:** itens 8, 9, 10 e 13.

## 4. Visão de referência (o que um produto de mercado tem)

| Característica | Estado atual | Referência de mercado |
|---|---|---|
| Documentação do usuário e do operador | Parcial (README e ARQUITETURA desatualizados) | Tutoriais, how-to, referência e explicação separados (Diátaxis) |
| Decisões registradas | Ausente | ADR (MADR) com índice |
| Segurança reportável | Ausente | Política, relato privado, prazos e reconhecimento |
| Privacidade verificável | Documento de dados desatualizado | RIPD, aviso de privacidade, canal do titular, retenção publicada |
| Versão e changelog | Sem tags nem releases | SemVer, Keep a Changelog, releases com notas |
| Métricas biométricas | Sem medição com dados reais | Relatório de avaliação por versão (ISO/IEC 30107-3 para PAD, FMR/FNMR para reconhecimento) |
| Frota | Sem gestão | Inventário com versão, status e revogação |
| Acessibilidade | Não documentada | Declaração de acessibilidade e meta WCAG 2.2 AA |

## 5. O que não recomendo fazer agora

- Reconhecimento em dispositivo (on-device) como substituto do servidor: muda o modelo de ameaça e não é necessário para os problemas atuais (ver ADR 0001 em `docs/adr/`).
- Multi-laboratório antes de fechar a segurança: amplia a superfície de dados biométricos de forma irreversível.
- Expansão para catracas ou controle de acesso físico: exige certificação de PAD e de segurança física que o projeto não tem.
