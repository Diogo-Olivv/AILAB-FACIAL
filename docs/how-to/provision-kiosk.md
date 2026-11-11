# Ativar um totem (kiosk)

Cada tablet da entrada precisa de uma conta própria de kiosk. O totem usava uma chave compartilhada (**AF-04**); ela só é removida do backend depois que todos os totens estiverem ativados.

## Por que um APK antigo não mostra a tela de ativação

Builds feitas com `EXPO_PUBLIC_KIOSK_KEY` (perfil `preview` de `mobile/eas.json` antes de 2026-11-11) embutiam a chave compartilhada. Nelas, o app se considerava "ativado" sempre, então o cartão **"Totem não ativado"** nunca aparecia e nenhuma conta de kiosk era criada. A correção está em `mobile/lib/kioskAuth.ts`: só uma sessão com papel `kiosk` conta como ativação.

Se o tablet roda uma build antiga, faça primeiro a atualização abaixo.

## Atualizar o tablet (OTA, sem instalar APK novo)

A mudança é só de JavaScript, e o app usa `runtimeVersion` do tipo `appVersion` (hoje 1.0.0) e o canal `preview`. Se o APK instalado foi construído com `expo-updates` e esse canal, a atualização chega por OTA:

```bash
cd mobile
npm ci --legacy-peer-deps
eas update --branch preview --message "Remove chave compartilhada; exige ativação do totem"
```

Confira na documentação do EAS Update a forma de carregar as variáveis do ambiente `preview` na sua versão do CLI. O código novo não lê `EXPO_PUBLIC_KIOSK_KEY`, então mesmo que a variável exista no ambiente, ela não é usada.

No tablet: feche o app por completo e abra de novo. A atualização é baixada na primeira abertura e aplicada na seguinte; pode ser preciso abrir duas vezes. O sinal de que chegou é aparecer **"Totem não ativado"**.

Se nada mudar depois de abrir duas vezes, o APK instalado provavelmente não tem `expo-updates` ou usa outro canal. Nesse caso é preciso instalar um APK novo (`eas build -p android --profile preview`).

Avise as pessoas que o tablet fica sem registrar presença entre receber a atualização e ser ativado. Faça isso fora do horário de uso.

## Pré-requisitos

- Um tutor com conta própria, com `app_metadata.role = 'tutor'` (não use senhas compartilhadas).
- O tablet exibindo **"Totem não ativado"** (ver seções acima).

## Passos

1. Abra o app no tablet. Se aparecer **"Totem não ativado"**, toque em **"Sou tutor — ativar totem"**.
2. Entre com a conta de tutor.
3. Dê um nome ao totem, por exemplo `Totem da entrada`.
4. Confirme.

**Resultado esperado:** o cartão de ativação some e aparece o estado "ativo". O backend cria a conta de kiosk e grava a ação em `admin_audit_log` (quando a migration 26 estiver aplicada em produção — hoje **não está**, ver `audit/CODE_DB_DRIFT.md`).

## Verificar

Pelo painel do tutor, ou pela API com um token de tutor:

```bash
curl -s -H "Authorization: Bearer <TOKEN-DO-TUTOR>" https://<URL-DO-SERVICO>/api/v1/kiosks
```

**Resultado esperado:** uma lista com o totem. Atenção: a listagem lê só as primeiras 2000 contas (**N-22**).

## Revogar um totem

```bash
curl -s -X DELETE -H "Authorization: Bearer <TOKEN-DO-TUTOR>" \
  https://<URL-DO-SERVICO>/api/v1/kiosks/<ID-DO-KIOSK>
```

A revogação apaga a conta. O totem perde acesso em até 60 segundos neste processo, e mais em outros processos (**N-22**).

## Se não ativar

- Confirme que a conta de tutor não está banida e tem o role certo.
- Se a tela não aparecer, o APK pode ser antigo. Não contorne com chave compartilhada: registre o problema.
