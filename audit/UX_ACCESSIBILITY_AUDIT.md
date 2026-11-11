# Auditoria de UX, acessibilidade e desempenho

> Revisado em 2026-11-11 · base `master@5f1d99c` · fonte: leitura de `web/src`, `mobile/app`, `mobile/components`, `mobile/hooks`, `mobile/lib`.
> Legenda: **F** reconfirmado no código nesta revisão · **F\*** relatado por leitura, não reconfirmado linha a linha · **NV** não medido (contraste, bundle gzip, desempenho em tablet real).
> Escopo desta revisão: **documentar e priorizar.** Nenhuma tela foi alterada.

## 1. Jornadas

| Jornada | Atores | Estado do fluxo | Lacunas principais |
|---|---|---|---|
| Check-in e check-out no totem | Integrante | Entrada, saída ou Auto-Scan; quatro estados de badge; cooldown de 4,5 s | Auto-Scan sem detecção de rosto (UX-02, F); badge sem live region (UX-14); header "Totem Ativo" mesmo quando não ativado (F\*) |
| Ativação do totem | Tutor | Cartão de ativação, PIN, rótulo, token em memória por 10 min | Sem lista de dispositivos nem revogação na UI (UX-16); token expira sem aviso (UX-18) |
| Cadastro com rajada | Tutor | Nome, matrícula (9 dígitos), 5 fotos a 500 ms, consentimento por `Switch` | Sem orientação de pose; cinco fotos em 2 s são pouco variadas (UX-05); consentimento operado pelo tutor no tablet compartilhado (UX-06); texto diz que fotos são descartadas, mas não há `deleteAsync` (F\*) |
| Atualização de template | Tutor (ou totem na janela) | Escolhe membro na lista e tira 5 fotos | Lista de membros visível no totem (UX-08, F\*); dentro da janela, qualquer aluno pode escolher outro (N-03) |
| Login do tutor (web) | Tutor | E-mail e senha, mensagem de erro | Sem recuperação de senha nem feedback de bloqueio (UX-20); caminho de senha mestra (**AF-03**, F) |
| Painel do tutor | Tutor | Três abas, período, busca com atalhos, CSV, relatório oficial, drawer de membro | Ver seções 3 e 4 |
| Lançamento manual, void e justificativa | Tutor | Modais e drawer | Justificativa grava só local em caso de erro de permissão (**AF-28**, F); `window.confirm` para remover avatar (UX-22, F) |
| Revogação LGPD | Tutor | Só pelo painel web | Não há caminho pelo totem nem pelo titular (UX-23) |
| Modo offline / PWA | Tutor | Shell em cache, assets em cache-first | Atualização só gera log, sem aviso ao usuário (UX-25, F); sem banner offline (F\*) |

## 2. Achados por severidade

Severidade: **Alta** impede ou engana o uso, ou tem efeito de privacidade · **Média** degrada a experiência · **Baixa** polimento.

### Alta

| ID | Achado | Evidência | Recomendação |
|---|---|---|---|
| UX-02 | Auto-Scan dispara captura e upload a cada 2 s sem detectar rosto. Fotos de pessoas que passam são enviadas ao backend. | F: `mobile/components/RecognitionPanel.tsx:318-331` | Detecção facial no dispositivo antes da captura (ML Kit ou `onFacesDetected`); sem rosto, nenhuma captura |
| UX-08 | Totem lista nome, matrícula e avatar de todos os membros, com busca e 8 primeiros visíveis. | F\*: `mobile/hooks/useProfiles.ts:21-35` e `RefreshCapture.tsx` | Identificar por matrícula digitada ou QR; não listar o diretório |
| UX-09 | Avatares em base64 de 256 px gravados na tabela `profiles` e reenviados a cada 10 s por kiosk em `kiosk_presence`. | F: `web/src/lib/reports.ts:197`, `MemberDetailDrawer.tsx:118-120`; F\*: polling em `usePresence.ts` | Storage com URL assinada e miniatura; não incluir imagem na presença |
| UX-05 | Cadastro com cinco fotos em uma pose, em cerca de 2 s. Pouca diversidade de embedding e sem orientação. | F\*: `SequentialCamera.tsx` (intervalo de 500 ms) | Guia de pose (esquerda, direita, frente), contagem e nova tentativa por foto |
| UX-06 | Consentimento é um `Switch` ativado pelo tutor, em tablet compartilhado. A pessoa cadastrada não lê nem aceita o termo. | F\*: `EnrollCapture.tsx` | Termo com versão, leitura pelo titular e aceite próprio (ver LGPD_GAP_ANALYSIS) |
| UX-04 | Fallback de escrita direta no cliente web quando a RPC falha, incluindo `DELETE` em `face_embeddings`. | F: `web/src/lib/reports.ts:73-573` (`.from("sessions"\|"profiles"\|"face_embeddings")`) | Remover os fallbacks e mostrar erro (**AF-28**) |
| UX-03 | Permissão negada em justificativa é tratada como "RPC ausente" e grava local com sucesso aparente. | F: `web/src/lib/compliance.ts:238`, commit `cbe481d` | Erro visível; nada de sucesso sem persistência (**AF-28**) |

### Média

| ID | Achado | Evidência | Recomendação |
|---|---|---|---|
| UX-07 | Regras de horas e dia útil usam o fuso do navegador, não `America/Sao_Paulo` (`tz.ts`), exceto na justificativa. Um dispositivo em outro fuso desloca a semana. | F\*: `aggregate.ts:8-12`, `period.ts:47` | Mover regras para o backend ou usar `tz.ts` em todo o cálculo |
| UX-10 | Escolha de janela de cadastro com data fixa e vencida, e relógio do dispositivo como referência. | F: `mobile/lib/enrollmentWindow.ts` | Servidor publica a janela; app mostra contagem regressiva |
| UX-11 | `usePresence` é chamado em mais de um componente: dois ou três pollers e canais realtime no mesmo dispositivo. | F\*: `index.tsx:54`, `PresenceSidebar.tsx:44` | Contexto ou store único |
| UX-12 | Relógio do painel atualiza a cada segundo no componente de 1574 linhas; todos os valores memoizados dependem dele. | F\*: `Dashboard.tsx:208-214` | Subcomponente para duração ao vivo |
| UX-13 | Painel consulta a cada 30 s mesmo com a aba oculta. | F\*: `Dashboard.tsx:385-390` | Pausar em `visibilitychange`; usar realtime como o mobile |
| UX-14 | Resultado do registro não é anunciado a leitores de tela (sem `accessibilityLiveRegion`). Único live region está no modal de ativação. | F\*: `FeedbackBadge.tsx`, `KioskProvisionModal.tsx:107` | `accessibilityLiveRegion="polite"` e `announceForAccessibility` |
| UX-15 | Botões do cabeçalho com 40 px (abaixo de 44–48 pt). Textos de 8 a 11 px em muitos pontos. | F\*: `index.tsx:611-614`; 78 usos de `text-[9–11px]` | Alvos de 48 px; mínimo de 12 px |
| UX-16 | Sem lista de totens, status de versão ou revogação na interface. | F\* | Tela de frota (ver PRODUCT_OPPORTUNITIES) |
| UX-17 | Abas do painel sem papel de tablist, sem `aria-controls`, sem setas, com `tabIndex` fixo. | F\*: `Dashboard.tsx:693-706` | Padrão WAI-ARIA Tabs |
| UX-18 | Token de tutor expira em 10 min sem aviso, e pode interromper cadastro em lote. | F\*: `tutorSession.ts`, `enroll.tsx:37-41` | Contagem regressiva e pedido de novo PIN |
| UX-19 | Sem `useKeepAwake`: o tablet pode dormir no meio de uma sessão. | F\* | `expo-keep-awake` na tela inicial do totem |
| UX-20 | Sem recuperação de senha nem feedback de bloqueio no login web. | F\*: `Login.tsx` | Fluxo de recuperação do Supabase; mensagem de limite de tentativas |
| UX-21 | Três paletas (terracota, teal, slate) e tokens não usados; `manifest.webmanifest` e `index.html` com cores de tema diferentes. | F\*: `tailwind.config.js:140-169`, `index.css:5-66`, `index.html:37-38` | CSS variables como fonte única |
| UX-22 | `window.confirm` para remover avatar, fora do padrão de confirmação do restante. | F: `MemberDetailDrawer.tsx:134` | Modal de confirmação com ação destrutiva explícita |
| UX-23 | Revogação de consentimento não é alcançável pelo totem nem pelo próprio titular. | F\*: `api.ts:319-340` (funções existem, sem chamador) | Caminho de autoatendimento (ver LGPD_GAP_ANALYSIS, seção 4) |
| UX-24 | Tema claro forçado no app (`userInterfaceStyle: "light"`), orientação landscape travada, e há layouts de celular no código. | F\*: `app.json:4,6`, `index.tsx:40-41` | Decidir: tablet landscape ou suporte a retrato |
| UX-25 | Atualização do PWA só gera log. Não há aviso nem botão. | F: `web/src/main.tsx:41-43` | Toast "Nova versão — atualizar" |

### Baixa

| ID | Achado | Recomendação |
|---|---|---|
| UX-26 | Fontes do Google carregadas por link bloqueante (Inter, JetBrains Mono, Newsreader, Plus Jakarta Sans). | Fontes próprias com `font-display: swap` |
| UX-27 | Logo JPEG de 104 KB importado em quatro lugares. | WebP ou SVG |
| UX-28 | Bundle principal de 790 KB sem code splitting (`vite.config.ts` sem `manualChunks` nem `React.lazy`). | Carregar sob demanda: painel, relatório oficial, avisos, gráfico (F\*, NV em gzip) |
| UX-29 | Componentes sem uso: `Hero`, `PrivacySection`, `RequireTutorAuth`, `WebcamCapture`, `ImageUploader`, `AnalysisProgress`, `ResultPanel`, `recognitionService`, `mobile/App.tsx` (boilerplate). Cerca de 900 linhas. | Remover (**AF-18**) |
| UX-30 | Login anexa `@ailab.com` ao e-mail. Caminho morto, pois o campo é `type=email required`. | Remover |
| UX-31 | Exportação CSV engole erros (`catch {}`) e só exporta o agregado, não as sessões. | Erro visível; exportação por sessão |
| UX-32 | Relatório oficial com "hash anti-fraude" calculado no navegador e não verificável. | Número de relatório emitido pelo servidor e página de verificação, ou remover a alegação |
| UX-33 | Guarda `/dashboard` sem `RequireTutorAuth`; a visão de tutor é escolhida por `?mode=student`. | Rotas separadas: público e `/tutor/*` com guarda (a autoridade real continua na RLS; severidade média para a interface) |

## 3. Desempenho

| Item | Estado | Medição |
|---|---|---|
| Bundle inicial | ~790 KB sem gzip (F\*) | NV em gzip |
| Requisições do painel | Polling de 30 s com aba oculta (UX-13) | NV |
| Presença no totem | Polling de 10 s por kiosk + realtime (F\*) | NV |
| Captura | `quality: 0.82` e `0.75`, sem `pictureSize` (F\*) | NV em tablet real |
| Inferência no backend | Semáforo de 10 e flash que reexecuta detecção (**N-14**) | NV |

Nenhum número de desempenho foi medido nesta revisão. Medir antes de otimizar.

## 4. Mapa WCAG 2.2 AA (resumo)

| Critério | Situação | Achado |
|---|---|---|
| 1.4.3 contraste mínimo | NV: não calculado | — |
| 1.4.4 redimensionamento | NV | — |
| 2.1.1 teclado | Painel com abas sem setas | UX-17 |
| 2.4.7 foco visível | NV | — |
| 2.5.5 tamanho do alvo | 40 px no totem | UX-15 |
| 4.1.3 mensagens de status | Sem live region no resultado | UX-14 |
| 2.3.3 movimento | Sem tratamento de reduce-motion | F\*, UX-14 |
| 3.3.7 entrada redundante | Cadastro pede dados já informados em outras telas | NV |

## 5. Oportunidades de design

Ver `PRODUCT_OPPORTUNITIES.md`. Resumo: uma fonte de verdade para tokens; sistema de componentes compartilhado entre web e mobile (ex.: `packages/design-tokens`); estados vazio, carregando, erro, sem permissão e offline em todas as telas (hoje ausentes em várias, F\*).

## 6. Limites

- Não há teste de usabilidade com pessoas reais.
- Não foram medidos contraste, tamanho de fonte renderizado nem desempenho.
- Itens marcados F\* vêm de leitura de agente e precisam de confirmação antes de virarem tarefa.
