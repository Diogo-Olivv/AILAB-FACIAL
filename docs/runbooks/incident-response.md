# Resposta a incidentes

> Procedimento de referência. Preencha os nomes e canais marcados como "a definir" antes de precisar dele.

## 1. Detectar e classificar (primeiros 30 minutos)

Sinais que pedem atenção: credencial exposta; acesso de conta que não deveria existir; dado pessoal visível fora do sistema; totem roubado; falha em massa de reconhecimento (503); purga que não roda.

Classifique:

| Nível | Critério | Exemplo |
|---|---|---|
| 1 — crítico | Dado biométrico ou pessoal exposto, ou acesso administrativo indevido | Chave de serviço em repositório público |
| 2 — alto | Serviço indisponível para a entrada, ou integridade de horas em risco | Totens param; sessões anuladas em massa |
| 3 — médio | Degradação sem exposição | Lentidão; alertas de purga |

## 2. Conter

- **Credencial exposta:** rotacione (ver [how-to/rotate-secrets.md](../how-to/rotate-secrets.md)). Não espere confirmar o uso.
- **Totem roubado:** revogue a conta do totem (ver [how-to/provision-kiosk.md](../how-to/provision-kiosk.md)).
- **Conta de tutor comprometida:** redefina a senha e desative a conta.
- **Serviço indisponível:** reverta a revisão (ver [how-to/rollback.md](../how-to/rollback.md)).

Registre cada ação com horário, sem dados pessoais.

## 3. Avaliar impacto

Responda por escrito:

- Quais dados foram afetados? (tipo, não conteúdo)
- Quantos titulares?
- Por quanto tempo o acesso indevido durou?
- Havia cifragem ou controle que reduz o risco?

## 4. Comunicar

- **Encarregado:** imediatamente para nível 1 e 2. Canal: a definir (DP-7).
- **ANPD e titulares:** o controlador decide, com base no art. 48 da LGPD, em prazo razoável. Não comunique sem o encarregado.
- **Mantenedores do projeto:** pelo canal privado de segurança ([SECURITY.md](../../SECURITY.md)).

Não publique detalhes do incidente em issue pública antes da contenção.

## 5. Recuperar e aprender

- Restaure o serviço com verificação (`/health/ready` e um reconhecimento de teste em ambiente de homologação).
- Escreva uma revisão sem culpa: linha do tempo, causa raiz, o que faltou para detectar mais cedo.
- Abra achados em `audit/REMEDIATION_STATUS.md` e issues para cada ação.

## Contatos

| Papel | Nome | Canal |
|---|---|---|
| Mantenedor | a definir | a definir |
| Encarregado | a definir (DP-7) | a definir |
| Operação de nuvem | a definir | a definir |
