# Rotacionar segredos

Use este guia quando um segredo for exposto, quando um integrante da equipe sair, ou como rotina. Segredos citados aqui são: chave de serviço do Supabase, chave de administração do backend, segredo de desafio, semente de BioHash, chave do totem compartilhada (a ser removida), senha de conta de tutor e chave JSON do GCP.

**Regra:** rotacione antes de investigar a fundo. Um segredo exposto não volta a ser seguro.

## Ordem geral

1. Gere o novo valor fora do repositório.
2. Atualize o secret manager (Cloud Run) ou o EAS secret, e só depois o consumidor.
3. Invalide o valor antigo no provedor.
4. Verifique com `/health/ready` e com um teste real de cada consumidor.
5. Registre no `CHANGELOG.md` (sem o valor) e na issue de incidente, se houver.

## Por segredo

| Segredo | Onde é usado | Como rotacionar | Cuidado |
|---|---|---|---|
| `SUPABASE_SERVICE_KEY` | Backend | Painel do Supabase: gerar nova chave de serviço | Derruba o backend até a atualização |
| `ADMIN_API_KEY` | Manutenção e agendador | Gerar novo valor no Cloud Run; atualizar o agendador (`nightly-cleanup.yml`, secret `ADMIN_API_KEY`) | Atualize o GitHub Secret antes do próximo cron |
| `CHALLENGE_SECRET` | Assinatura de desafios | Novo valor no Cloud Run | Desafios emitidos com o valor antigo deixam de valer; é esperado |
| `BIOHASHING_SEED` | Rotação dos templates | **Não trocar sem plano.** Trocar invalida todos os templates | Exige reenrolar todos os integrantes (**N-12**) |
| Chave JSON `GCP_SA_KEY` | Deploy | Criar nova chave da conta de serviço; atualizar o secret; apagar a chave antiga | Preferir Workload Identity Federation (**CI-04**) |
| Chave do totem compartilhada | App do tablet | Não rotacionar: **remover** (ver [provision-kiosk.md](provision-kiosk.md)) | A chave atual já está pública no histórico (**AF-02**) |
| Senha de conta de tutor | Painel | Redefinir pelo painel do Supabase | Não reutilize senha |
| Anon key do Supabase | Cliente (público por design) | Não é segredo; rotacionar só se houver abuso | Sem RLS adequada, a anon key expõe dados |

## Depois de uma exposição em repositório público

1. Considere o valor comprometido, mesmo depois de apagar o arquivo: o histórico do Git guarda.
2. Rotacione. Não tente "esconder" o valor só apagando o commit.
3. Reescrever o histórico é decisão do mantenedor, e só ajuda contra quem ainda não viu o valor.
4. Registre a exposição em `audit/REMEDIATION_STATUS.md`.
