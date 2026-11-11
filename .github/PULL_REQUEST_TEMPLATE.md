## Resumo

<!-- O que muda e por quê. Uma ou duas frases. -->

## Tipo de mudança

- [ ] fix (correção)
- [ ] feat (funcionalidade)
- [ ] docs (documentação)
- [ ] ci / chore (infraestrutura, dependências)
- [ ] test (testes)
- [ ] security (segurança)

## Checklist

- [ ] Título do PR no padrão Conventional Commits.
- [ ] CI verde (web, mobile e backend com Postgres 17).
- [ ] Teste que falharia sem esta mudança (regressão), quando for correção.
- [ ] Documentação atualizada (README, `docs/`, CHANGELOG "Unreleased"), quando o comportamento visível mudou.
- [ ] Nenhum segredo, token, chave, imagem de rosto, embedding ou dado pessoal no diff, nos logs ou nas capturas.

## Áreas sensíveis (preencher se aplicável)

- [ ] Migration SQL: sintaxe validada (`test_migration_syntax.py`), idempotente, testes de banco passando.
- [ ] RLS, grants, funções `SECURITY DEFINER`: quais papéis mudam de acesso? ______
- [ ] Autenticação ou autorização: quais rotas mudam? ______
- [ ] Biometria, limiares ou PAD: testes com os valores padrão, sem patch.
- [ ] LGPD (coleta, retenção, exclusão, consentimento): impacto descrito abaixo.
- [ ] Workflow de deploy: gate de CI continua obrigatório?

## Rollback

<!-- Como reverter com segurança. Para migrations, o SQL de reversão ou o motivo de ser irreversível. -->

## Evidência

<!-- Comandos executados, saídas relevantes e links de runs de CI. -->

## Impacto em produção

<!-- O que acontece quando isto for implantado? Algum passo manual do mantenedor? -->
