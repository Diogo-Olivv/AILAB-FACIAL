# 0007 — Totem em Expo, APK Android

- **Status:** aceito
- **Data:** 2026-06 (registrada retroativamente em 2026-11-11)
- **Decisores:** mantenedor do projeto

## Contexto e problema

Precisa de um app para tablet com câmera frontal, que rode em Android e seja atualizável sem loja de aplicativos.

## Opções consideradas

1. **App nativo Android** (Kotlin): controle total, mas dois códigos (web e mobile) para manter.
2. **Expo (React Native)** com APK e EAS Update: um código, atualização por OTA, reuso de TypeScript com o web.
3. **PWA no navegador do tablet**: sem instalação, mas controle limitado da câmera e do modo kiosk.

## Decisão

Expo com APK. Atualizações de JavaScript pelo EAS Update; mudanças nativas exigem novo APK.

## Consequências

- Positivas: uma linguagem; OTA; `expo-router`.
- Negativas: dependência do ecossistema Expo (SDK fixo, atualização periódica); `mobile/AGENTS.md` pede a documentação versionada do Expo 57.
- Pendência: sem testes do mobile (AF-19); sem `useKeepAwake` (UX-19).

## Como verificar

`eas build -p android --profile preview` gera o APK. `npx tsc --noEmit` e `expo-doctor` rodam no CI.
