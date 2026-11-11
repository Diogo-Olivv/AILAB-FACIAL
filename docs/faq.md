# Perguntas frequentes

## Geral

**O sistema guarda fotos dos integrantes?**
Não guarda imagens faciais de forma intencional: a foto é convertida em embedding e descartada. Mas o descarte depende de coleta de lixo da memória (**N-27**, ver `audit/FINDINGS.md`), e não há inventário de armazenamento de imagens. Não afirme "zero armazenamento" sem essa ressalva.

**O reconhecimento roda no tablet?**
Não. As fotos vão ao backend, que calcula o embedding e compara. Ver [adr/0001](adr/0001-server-side-recognition.md).

**Por que o reconhecimento não é 100%?**
Nenhum sistema biométrico é. Há falsa rejeição (pessoa real não reconhecida) e falsa aceitação (pessoa diferente reconhecida). Os limiares controlam o equilíbrio. Ver [ml/model-card.md](ml/model-card.md).

## Operação

**O tablet diz "Não ativado". O que faço?**
A conta de totem não existe. Um tutor precisa ativar o dispositivo pelo app. Ver [how-to/provision-kiosk.md](how-to/provision-kiosk.md). Enquanto isso, o sistema usa a chave compartilhada, que é uma falha de segurança (**AF-01**, **AF-04**).

**Esqueci de registrar a saída. O que acontece?**
A sessão fica aberta. Depois de 10 horas, o sistema a anula: ela não conta horas. Se você tiver um checkout legítimo depois do limite, o tutor pode revisar pelo painel.

**Por que a janela de cadastro não abre?**
A janela está fixa no código e já venceu, em 2 de outubro de 2026. Para reabrir, é preciso mudar código e publicar. Isso é uma limitação conhecida (**N-03**, **UX-10**).

**O cadastro pede consentimento. Onde fica o texto que a pessoa leu?**
Hoje o aceite é um campo marcado pelo tutor, sem versão do texto gravada. Esse é um ponto pendente da LGPD (ver `audit/LGPD_GAP_ANALYSIS.md`).

**Como excluo um integrante?**
Pelo painel do tutor. Se o integrante tiver justificativa de débito, a exclusão é recusada (409), por decisão de integridade do histórico. Essa regra exige decisão de retenção (DP-5).

## Desenvolvimento

**Por que os testes de banco pulam na minha máquina?**
Porque não há Postgres com pgvector rodando. No CI eles rodam sempre. Para rodar localmente, ver [how-to/run-db-tests.md](how-to/run-db-tests.md).

**Por que `npm ci --legacy-peer-deps`?**
O projeto tem conflitos de peer dependencies entre pacotes do Expo e do React. A flag é usada no CI; sem ela, a instalação pode falhar.

**Posso usar `.env.example` como está?**
Não. Os limiares e a chave de segurança do exemplo divergem do código (**DOC-07**). Use [reference/env-vars.md](reference/env-vars.md) como fonte.

**Qual versão do Python?**
Produção usa 3.11 (imagem Docker). O CI roda 3.12. A divergência está registrada em **CI-02** e será corrigida.

## Dados e privacidade

**Como um integrante pede os próprios dados?**
Hoje não há canal próprio. O pedido passa pelo encarregado do laboratório. Ver [privacy/data-subject-requests.md](privacy/data-subject-requests.md) (a criar, dependente de DP-7).

**Quanto tempo os dados ficam guardados?**
Depende do tipo. Tentativas de reconhecimento: 90 dias, com purga que pode falhar em silêncio (**N-18**). Demais dados: prazo ainda não definido (DP-3, DP-4). Ver `audit/LGPD_GAP_ANALYSIS.md`.

**Encontrei um dado pessoal no repositório. O que faço?**
Não publique o dado em issue nem em PR. Siga [SECURITY.md](../SECURITY.md) se for credencial, e avise o mantenedor pelo canal privado.
