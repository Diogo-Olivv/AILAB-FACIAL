# Reverter uma implantação

Há três coisas que podem ser revertidas, e cada uma tem um caminho diferente. Antes de qualquer reversão, registre o horário e o motivo.

## 1. Backend (Cloud Run)

Cada deploy cria uma revisão nova. A revisão anterior continua disponível.

```bash
gcloud run revisions list --service=ailab-facial-api --region=southamerica-east1
gcloud run services update-traffic ailab-facial-api \
  --region=southamerica-east1 --to-revisions=<REVISAO-ANTERIOR>=100
```

**Resultado esperado:** `/health/ready` responde `ready` e o tráfego vai para a revisão escolhida.

Limitação: a reversão **não** desfaz migrations de banco. Se a revisão nova dependia de uma migration, a anterior pode não funcionar com o banco atual. Verifique a compatibilidade antes.

## 2. Migration de banco

Migrations não têm reversão automática. Cada migration deve ter o SQL de reversão no PR (campo "Rollback" do template). Se não tiver, a reversão é uma migration nova, idempotente, que desfaz o efeito.

Antes de aplicar a reversão em produção:

1. capture o estado atual (ver `audit/PROD_STATE_SNAPSHOT.md`, seção 7);
2. teste a reversão em banco local com o mesmo SQL;
3. peça aprovação do mantenedor.

## 3. App do tablet (OTA)

O app é atualizado por canais do EAS Update. Para voltar, publique a atualização anterior no mesmo canal:

```bash
cd mobile
eas update:list --branch <CANAL>
eas update:republish --group <ID-DO-GRUPO-ANTERIOR>
```

Atenção: uma OTA não pode mudar código nativo. Se a versão anterior dependia de outra versão do APK, reinstale o APK.

## Depois

- Registre no `CHANGELOG.md` (seção "Unreleased") o que foi revertido e por quê.
- Abra uma issue com o tipo "Bug" e vincule ao PR revertido.
