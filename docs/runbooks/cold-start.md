# Primeira requisição lenta (cold start)

O backend roda no Cloud Run e **escala para zero** quando não há tráfego (ADR [0004](../adr/0004-cloud-run-over-render.md)). A primeira requisição depois de ociosidade sobe o contêiner e carrega o modelo, e demora.

## Sintomas

- O totem mostra "Registro não confirmado" ou demora a responder na primeira marcação do dia.
- `GET /health/ready` demora e depois responde `ready`.

## Quanto demora

O README antigo registrava cerca de 17 segundos (F\*, não medido nesta revisão). Em 2026-11-11, `GET /health` respondeu em 0,7 s com a instância aquecida (F, medição pontual).

O app tenta de novo até 2 vezes, com espera de 1 s e 2 s, mas o prazo de cada tentativa é de 12 s (25 s para envio de quadros), portanto um cold start longo pode estourar uma tentativa (F\*, `mobile/lib/api.ts`).

## Opções para reduzir

| Opção | Custo | Efeito |
|---|---|---|
| Manter uma instância mínima (`min-instances=1`) | Paga instância ociosa | Elimina o cold start |
| Ping periódico em `/health` no horário de uso | Pode sair da faixa gratuita conforme a frequência | Mantém a instância viva; o README antigo descrevia um ping a cada 15 min das 7h às 21h em um serviço externo (se ainda existe: **NV**) |
| Aceitar o cold start | Nenhum | A primeira marcação do dia pode falhar; o integrante repete |

Decisão do mantenedor. O monitoramento externo é o que sobra de um alerta hoje: o repositório não tem alerta de indisponibilidade (**N-17**).

## Como conferir

```bash
curl -s -o /dev/null -w "%{http_code} em %{time_total}s\n" https://<URL-DO-SERVICO>/health
gcloud run services describe ailab-facial-api --region=southamerica-east1 --format="value(spec.template.metadata.annotations)"
```

A segunda linha mostra as anotações de escala (inclui `autoscaling.knative.dev/minScale`, se definido).

## Se a primeira marcação do dia falhar

1. Peça para tentar de novo depois de alguns segundos.
2. Se continuar, siga [../how-to/rollback.md](../how-to/rollback.md) e [incident-response.md](incident-response.md).
