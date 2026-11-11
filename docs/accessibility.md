# Acessibilidade

> **Status:** declaração em construção. O projeto ainda não foi avaliado contra WCAG 2.2 AA com medição. Este documento lista o que foi verificado no código e o que falta.

## Compromisso

O painel web e o app do totem devem ser usáveis por pessoas com deficiência visual, auditiva, motora e cognitiva, na meta WCAG 2.2 nível AA.

## O que já foi verificado (no código)

- O cabeçalho do totem tem rótulos de acessibilidade em alguns botões (F: `mobile/app/index.tsx`, `accessibilityLabel` no cartão de ativação).
- A tela de login do painel tem mensagem de erro com papel de alerta (F\*: relatado por leitura, não reconfirmado).

## Lacunas conhecidas

Lista completa com severidade em [audit/UX_ACCESSIBILITY_AUDIT.md](../audit/UX_ACCESSIBILITY_AUDIT.md):

| ID | Lacuna | Critério WCAG |
|---|---|---|
| UX-14 | Resultado do registro não é anunciado a leitores de tela | 4.1.3 |
| UX-15 | Alvos de toque com 40 px; textos de 8 a 11 px | 2.5.5 |
| UX-17 | Abas do painel sem navegação por setas | 2.1.1 |
| UX-02 | Captura automática sem detecção de rosto nem aviso claro ao integrante | 3.2.2 (a validar) |

Contraste de cores: **não medido**.

## Como avaliar

1. Navegação somente por teclado no painel.
2. Leitor de tela (NVDA no Windows ou TalkBack no Android) no fluxo de login e de presença.
3. Ferramenta automática (axe) nas páginas do painel.
4. Contraste medido com ferramenta de contraste sobre as cores de `web/src/index.css`.
5. Teste com pelo menos uma pessoa usuária com deficiência.

## Contato

Relato de barreira de acesso: abra uma issue com o template "Documentação", ou use o canal de suporte em [SUPPORT.md](../SUPPORT.md).
