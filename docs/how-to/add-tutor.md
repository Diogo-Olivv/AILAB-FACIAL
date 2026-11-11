# Criar a conta de um tutor

Cada tutor deve ter **uma conta individual**, com senha própria. Contas compartilhadas impedem saber quem fez cada ação e não podem ser revogadas por pessoa.

> Esta tarefa escreve em produção (cria um usuário no Supabase Auth). Só o mantenedor a executa.

## O que define um tutor

O backend e as políticas de banco reconhecem tutor apenas por `app_metadata.role = 'tutor'` do JWT (`backend/app/deps.py`, políticas `tutor_*`). **Não** use `user_metadata`: o próprio usuário pode editá-lo, e as migrations 18 e 20 removeram esse caminho justamente por isso.

## Passos (painel do Supabase)

1. **Authentication → Users → Add user.** Informe o e-mail da pessoa e uma senha forte e única. Marque o e-mail como confirmado.
2. No **SQL Editor**, defina o papel (substitua o e-mail):

   ```sql
   update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role": "tutor"}'::jsonb
   where email = '<e-mail-do-tutor>';
   ```

3. Entregue a senha por um canal privado e peça que a pessoa a troque no primeiro acesso.

## Conferir (somente leitura)

```sql
select count(*) filter (where raw_app_meta_data ->> 'role' = 'tutor') as tutores,
       count(*) filter (where raw_app_meta_data ->> 'role' = 'tutor'
                        and (banned_until is null or banned_until < now())) as ativos
from auth.users;
```

Para conferir uma pessoa específica sem expor dados em chat, use o painel e confira `app_metadata`.

## Desativar um tutor

Defina `banned_until` para uma data futura. O acesso é recusado pela verificação de banimento em `_resolve_identity`. Apagar a conta remove também o vínculo com ações anteriores, então prefira desativar.

## Proteções que valem ligar

- **Proteção contra senhas vazadas** (HaveIBeenPwned) em *Authentication → Policies*. Está **desativada** hoje (advisor do Supabase, `audit/PROD_STATE_SNAPSHOT.md`).
- Comprimento mínimo de senha adequado.
- Verificação em duas etapas, quando o plano do Supabase permitir (decisão do mantenedor).

## Não faça

- Não compartilhe uma única conta entre tutores.
- Não registre senhas em issue, PR, chat ou planilha.
- Não use o login "padrão do laboratório" antigo: a conta semeada pela migration 19 tem uma senha pública (**N-01**, **AF-14**) e deve ser desativada depois que cada tutor tiver a sua.
