# Ativar um totem (kiosk)

Cada tablet da entrada precisa de uma conta própria de kiosk. Hoje o totem ainda usa uma chave compartilhada (**AF-04**), e o plano é remover essa chave somente depois que todos os totens estiverem ativados.

## Pré-requisitos

- Um tutor com conta própria, com `app_metadata.role = 'tutor'` (não use senhas compartilhadas).
- O APK instalado no tablet com a tela de ativação. Confirme a versão antes de contar com ela.

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
