# Governança

Este documento descreve quem decide o quê no projeto e como as decisões são tomadas.

## Papéis

| Papel | Responsabilidade | Quem |
|---|---|---|
| Mantenedor (owner) | Decisões finais, acesso administrativo, implantação, resposta a segurança, aplicação do Código de Conduta | Conta `@Diogo-Olivv` (dono do repositório) |
| Mantenedor de área | Revisão e aprovação de mudanças na área (ver CODEOWNERS) | A definir por área |
| Contribuidor | Abre issues, propõe e envia mudanças | Qualquer pessoa, pelo fluxo de [CONTRIBUTING.md](CONTRIBUTING.md) |
| Encarregado (DPO, LGPD) | Canal com titulares de dados e ANPD | **A definir pelo controlador (laboratório)** |

## Como as decisões são tomadas

- **Mudanças pequenas** (correções, docs, testes): um revisor de área aprova.
- **Mudanças de arquitetura, API pública ou banco**: exigem um ADR em `docs/adr/` e aprovação do mantenedor.
- **Mudanças em biometria, limiares, RLS, autenticação, LGPD ou deploy**: exigem revisão do mantenedor e descrição de rollback no PR.
- Em caso de empate ou falta de consenso, o mantenedor decide e registra o motivo no ADR ou na issue.

## Direitos e deveres dos mantenedores

- Revisar PRs com prazo razoável e explicar recusas.
- Não aprovar mudanças no próprio PR sem revisão de outra pessoa, quando houver mais de um mantenedor.
- Proteger dados de integrantes: nenhum dado biométrico ou pessoal entra em issues, PRs ou logs públicos.
- Registrar decisões de segurança e privacidade em `audit/` ou `docs/`.

## Como alguém se torna mantenedor

Contribuidores com histórico consistente de revisões de qualidade podem ser convidados pelo mantenedor. A nomeação é registrada em CODEOWNERS e neste arquivo.

## Canais

| Assunto | Canal |
|---|---|
| Dúvidas de uso | Issues com o template "Dúvida / suporte" ou discussões, quando habilitadas |
| Bugs | Issue com o template de bug |
| Propostas | Issue com o template de funcionalidade |
| Vulnerabilidades | [SECURITY.md](SECURITY.md) (canal privado) |
| Conduta | **A definir pelo mantenedor** (ver [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)) |
| Dados pessoais e LGPD | **A definir pelo encarregado** |

## Mudanças nesta governança

Alterações neste documento são feitas por PR com aprovação do mantenedor e registro no CHANGELOG.
