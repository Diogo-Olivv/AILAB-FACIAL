# Política de retenção

> **Status:** proposta. Os prazos marcados como "decidir" dependem do controlador (DP-3 a DP-6, em `audit/LGPD_GAP_ANALYSIS.md`). Este documento descreve o que existe hoje e o que precisa ser decidido. Não é uma política aprovada.

## Quadro

| Dado | Onde | Prazo hoje | Mecanismo hoje | Situação | Proposta |
|---|---|---|---|---|---|
| Vetor facial (embedding) | `face_embeddings` | Até revogação ou exclusão | Remoção pelo tutor ou por RPC de exclusão | Revogação não apaga quando há falha (N-08) | Apagar na revogação e na exclusão; **decidir** prazo após desligamento (DP-3) |
| Tentativas de reconhecimento | `face_logs` | 90 dias | Purga no job de manutenção | Purga engole erro e devolve 0 (N-18) | Manter 90 dias, com falha visível |
| Desafios e replay | `recognition_requests` | 300 segundos | Purga por pg_cron (não verificado) ou por código (não chamado) | Sem chamador (N-18) | Manter, com agendamento confirmado |
| Sessões (entrada e saída) | `sessions` | Sem prazo | Nenhum | Sem política (DP-4) | **Decidir** (ex.: período letivo, mais X anos para horas) |
| Justificativas | `attendance_justifications` | Sem prazo | Nenhum | Texto livre pode conter saúde (DP-5) | **Decidir**; limitar texto; permitir eliminação do texto |
| Registro administrativo | `admin_audit_log` | Sem prazo | Nenhum | Editável por `service_role` (N-05) | **Decidir** (DP-6); tornar só inserção |
| Nome, matrícula, avatar | `profiles` | Até exclusão | Exclusão pelo tutor | Revogação mantém os dados (N-21) | Apagar ou anonimizar na revogação, se o controlador decidir |
| Logs da aplicação | Cloud Logging | Prazo da plataforma (NV) | Nenhum | Contém nomes em alguns casos (N-16) | Remover dado pessoal dos logs; **decidir** prazo |
| Backups do banco | Supabase | Prazo da plataforma (NV) | — | Não documentado | Confirmar com o provedor e registrar |

## Regras gerais propostas

1. Dado biométrico tem o prazo mais curto que a finalidade permitir.
2. Revogação do consentimento tem efeito imediato sobre o reconhecimento, e não depende de exclusão.
3. Exclusão e anonimização são registradas no `admin_audit_log`, sem o dado apagado.
4. Nenhuma purga pode falhar em silêncio. Falha deve gerar alerta.

## Pendências

DP-3, DP-4, DP-5 e DP-6 em `audit/LGPD_GAP_ANALYSIS.md`.
