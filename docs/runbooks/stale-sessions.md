# Sessões esquecidas e anuladas

Uma sessão fica **aberta** quando alguém registra entrada e não registra saída. O sistema a **anula** (não conta horas) quando passa do limite. Este runbook explica quando isso acontece e como investigar.

## Regra (F, `backend/migrations/24_register_presence_event.sql`)

Ao receber uma marcação, `register_presence_event` considera uma sessão aberta **vencida** se:

- foi aberta há **10 horas ou mais** (`MAX_SESSION_HOURS`), **ou**
- foi aberta em um **dia anterior** ao de hoje, no fuso de Brasília.

Uma sessão vencida é anulada (`voided_at` preenchido, `auto_closed = true`, horas = 0), e a nova marcação é tratada como entrada.

**Consequência (N-19, F\*):** quem entra às 23h50 e sai às 00h10 perde a sessão inteira, porque a virada de dia a torna vencida. O mesmo vale para quem passa de 10 horas.

## Varreduras

| Mecanismo | Quando | Observação |
|---|---|---|
| Na própria marcação | A cada registro do integrante | Resolve o caso do dia seguinte |
| `nightly-cleanup.yml` → `POST /api/v1/maintenance/cleanup` | Horário e diário | Anula sessões antigas e apaga `face_logs` com mais de 90 dias; falha de purga pode passar sem erro (N-18) |
| `POST /api/v1/sessions/close-stale` | Manual (admin) | Mesma regra em Python, com implementação separada (N-18) |

O agendamento do GitHub Actions é best-effort e pode ser pausado em repositórios sem atividade por 60 dias.

## Como investigar (somente leitura)

Sessões abertas há mais de 10 horas:

```sql
select id, profile_id, check_in, now() - check_in as aberta_ha
from public.sessions
where check_out is null and voided_at is null and check_in < now() - interval '10 hours'
order by check_in;
```

Sessões anuladas nas últimas 48 horas:

```sql
select id, profile_id, check_in, check_out, voided_at
from public.sessions
where voided_at > now() - interval '48 hours'
order by voided_at desc;
```

Evite colar `profile_id` ou nomes em issues e chats.

## Como corrigir um caso legítimo

No painel do tutor, **reativar a sessão anulada** (`tutor_unvoid_session`) ou **fechar com o horário correto**. Prefira registrar uma justificativa quando o caso for recorrente.

## Quando abrir uma issue

- Sessões vencendo na meia-noite com frequência: é o comportamento descrito (N-19), mas pode justificar mudar a regra.
- Varredura que não roda por dias: verificar o histórico do workflow `nightly-cleanup.yml`.
