# Gerar um APK e publicar uma atualização OTA

O app do totem é um app Expo (SDK 57) distribuído como APK e atualizado por OTA (EAS Update). Este guia diz quando basta uma atualização OTA e quando é preciso um APK novo.

> Documentação oficial do SDK usado: <https://docs.expo.dev/versions/v57.0.0/>. O comando exato pode variar com a versão do `eas-cli`; confira lá se algum passo falhar.

## Qual dos dois eu preciso?

| Mudança | Caminho |
|---|---|
| Só código TypeScript/JavaScript, textos, regras de tela (a maioria) | **OTA** |
| Nova biblioteca nativa, mudança de permissão do Android, atualização do Expo SDK, mudança em `app.json` que afeta o nativo | **APK novo** |
| Mudança da versão do app (`version` em `app.json`) | **APK novo**, porque `runtimeVersion` usa a política `appVersion` e a OTA só chega a APKs com a mesma versão |

O que está configurado hoje (F, `mobile/app.json` e `mobile/eas.json`): `runtimeVersion = { policy: "appVersion" }` (versão 1.0.0), `updates.url` do EAS, plugin `expo-updates`, canal `preview` no perfil `preview`.

Uma OTA só chega a um tablet cujo APK foi construído **com `expo-updates` e no mesmo canal**. Se o APK instalado é mais antigo que a configuração de canal, nenhuma OTA vai chegar; nesse caso instale um APK novo.

## Publicar uma atualização OTA

Pré-requisito: conta Expo com acesso ao projeto (`eas login`).

```bash
cd mobile
npm ci --legacy-peer-deps
npm run test
npx tsc --noEmit
eas update --branch preview --message "Descreva a mudança em uma frase"
```

Os dois comandos antes de `eas update` são os mesmos do CI; não publique uma OTA que não passa neles.

No tablet:

1. Feche o app por completo (remova da lista de apps recentes).
2. Abra de novo. A atualização é baixada nessa abertura.
3. Feche e abra mais uma vez. A atualização é aplicada na abertura seguinte à do download.

Se a mudança é visível, ela aparece na segunda abertura.

## Gerar um APK novo

```bash
cd mobile
npm ci --legacy-peer-deps
eas build -p android --profile preview
```

O EAS devolve um link para o APK. No tablet: baixar, instalar (permitir a instalação de fontes desconhecidas se o Android pedir). Reinstalar o app **apaga a sessão do totem**: o dispositivo precisa ser ativado de novo (ver [provision-kiosk.md](provision-kiosk.md)).

Antes de gerar um APK, aumente `android.versionCode` em `mobile/app.json` (hoje 6). O EAS usa `appVersionSource: local`, ou seja, o número vem do arquivo.

## Variáveis de ambiente da build

O perfil `preview` embute `EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY` no pacote. Valores `EXPO_PUBLIC_*` **ficam visíveis a quem tem o APK**: nunca coloque neles um segredo. A chave anon do Supabase é pública por desenho, desde que a RLS esteja correta (ver `docs/adr/0003-supabase-rls-service-role.md`).

`EXPO_PUBLIC_KIOSK_KEY` foi removida de `mobile/eas.json`. O código não a lê mais.

### E a OTA, precisa dessas variáveis?

As variáveis `EXPO_PUBLIC_*` são embutidas **quando o pacote é gerado**, e `eas update` roda na sua máquina, onde as variáveis do perfil `preview` de `eas.json` não existem. Isso não quebra a atualização: o app tem valores padrão para a URL da API (`mobile/lib/api.ts`, linhas 5 a 9) e para a URL e a chave anon do Supabase (`mobile/lib/supabase.ts`, linhas 6 a 8), que apontam para o projeto atual.

A exceção: se você mudar de projeto Supabase ou de URL da API, defina as variáveis no terminal **antes** de rodar `eas update`, senão a OTA continuaria apontando para o projeto antigo.

## Depois de publicar

- Conferir no tablet que a versão nova chegou.
- Se algo quebrou: ver [rollback.md](rollback.md), seção do app.
- Registrar a mudança em `CHANGELOG.md` ("Unreleased").
