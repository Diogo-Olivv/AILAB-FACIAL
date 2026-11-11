# Como contribuir

Obrigado pelo interesse. Este projeto é um sistema de controle de presença com reconhecimento facial para um laboratório de extensão. Mudanças afetam dados biométricos reais, então o processo de revisão é intencionalmente rigoroso.

Leia também o [Código de Conduta](CODE_OF_CONDUCT.md) e a [Política de segurança](SECURITY.md).

## Antes de começar

- Abra uma issue descrevendo o problema ou a proposta antes de mudanças grandes.
- Para vulnerabilidades, **não** use issue pública: siga o [SECURITY.md](SECURITY.md).
- Nunca inclua em issues, PRs, logs, capturas de tela ou fixtures: imagens de rostos, embeddings, tokens, chaves, senhas ou dados pessoais de integrantes.

## Ambiente

| Pacote | Como rodar os testes |
|---|---|
| `backend/` | `pip install -r requirements-dev.txt` e `python -m pytest`. Para os testes de banco: `REQUIRE_DB_TESTS=1 TEST_DATABASE_URL=postgresql://postgres:test@localhost:5432/postgres` com um Postgres 17 com pgvector |
| `web/` | `npm ci --legacy-peer-deps` e `npm run test` |
| `mobile/` | `npm ci --legacy-peer-deps` e `npx tsc --noEmit` |

O guia completo de ambiente local está em `docs/how-to/` (quando publicado) e no README.

## Fluxo de contribuição

1. Crie uma branch a partir de `master` com prefixo do tipo de mudança: `feat/`, `fix/`, `docs/`, `ci/`, `chore/`, `test/`, `security/`.
2. Faça commits pequenos e coerentes, com [Conventional Commits](https://www.conventionalcommits.org/pt-br/v1.0.0/) (`feat(backend): ...`, `fix(web): ...`). O título do PR também segue esse padrão.
3. Abra o PR em draft até o CI passar. Preencha o template de PR por completo.
4. Peça revisão de quem é dono da área (ver [CODEOWNERS](.github/CODEOWNERS)).
5. Mudanças em migrations, RLS, autenticação, biometria, LGPD ou workflows de deploy exigem revisão adicional e descrição de rollback.

## Regras específicas

### Migrations SQL

- Uma migration por mudança, com número sequencial em `backend/migrations/`.
- Idempotente sempre que possível (`IF NOT EXISTS`, `CREATE OR REPLACE`, `REVOKE` seguro de repetir).
- Passar no gate de sintaxe (`backend/tests/test_migration_syntax.py`) e nos testes de banco (`test_db_migrations.py`).
- Nunca aplicar em produção antes de validar localmente. Aplicação em produção é decisão do mantenedor.

### Biometria e limiares

- Mudanças em limiares, PAD ou pipeline de embedding exigem teste com os valores padrão de `backend/app/config.py`, sem patch.
- Não há dataset de validação no repositório. Métricas de acurácia (FAR, FRR, APCER, BPCER) só entram com medição documentada. Veja `docs/ml/`.

### Segredos

- Nunca commitar segredos. Use variáveis de ambiente e secrets do GitHub ou do EAS.
- Credenciais de exemplo devem ser claramente fictícias.

### Testes

- Corrigir um bug exige teste de regressão que falhe antes da correção.
- Não desabilitar, pular ou aumentar timeout de testes para fazer o CI passar.

## Definição de pronto

- CI verde (web, mobile, backend com Postgres 17).
- Testes novos para o comportamento alterado.
- Documentação atualizada quando o comportamento visível mudar (README, `docs/`, CHANGELOG em "Unreleased").
- Nenhum arquivo de ambiente, binário ou artefato gerado no diff.

## Licença das contribuições

Ao enviar uma contribuição, você concorda que ela é licenciada sob a [Apache License 2.0](LICENSE), conforme a seção 5 da licença.
