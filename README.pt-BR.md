# AILAB-FACIAL — Controle de presença por reconhecimento facial

Substitui a lista de assinatura de um laboratório de extensão. Um tablet na entrada identifica o integrante pela câmera e registra entrada e saída. Os tutores acompanham as horas por um painel web.

> **Estado:** em remediação. O sistema foi construído para ser usado em produção, mas a auditoria de 2026-11-11 encontrou problemas de segurança e de privacidade ainda abertos. Leia [audit/REMEDIATION_STATUS.md](audit/REMEDIATION_STATUS.md) antes de operar.

[English version](README.md) · [Documentação](docs/README.md) · [Segurança](SECURITY.md) · [Contribuir](CONTRIBUTING.md) · [Licença: Apache-2.0](LICENSE)

## Como funciona

O tablet captura até cinco fotos, com um desafio temporal emitido pelo servidor. O backend calcula o embedding facial, verifica se a foto é de uma pessoa real, compara com os cadastros e grava a presença. A biometria não sai do servidor.

```
Tablet (app Expo, kiosk) ── frames + desafio ──► API FastAPI (Cloud Run)
                                                   │  InsightFace · PAD · pgvector
                                                   ▼
Painel web (tutores) ── JWT de tutor ──────────► Supabase (Postgres, RLS, Auth)
```

Detalhes em [docs/explanation/architecture.md](docs/explanation/architecture.md).

## Estrutura do repositório

| Pasta | Conteúdo |
|---|---|
| `backend/` | API FastAPI, migrations SQL (`backend/migrations/`), testes, Dockerfile |
| `web/` | Painel dos tutores (React, Vite, PWA) |
| `mobile/` | App do totem (Expo, expo-router) |
| `audit/` | Auditoria de segurança, privacidade, testes e produto |
| `docs/` | Documentação (tutoriais, how-tos, referência, explicações, ADRs) |
| `.github/` | CI, deploy, templates e governança |

## Rodando localmente

Passo a passo completo em [docs/tutorials/first-run-local.md](docs/tutorials/first-run-local.md).

```bash
cd backend && pip install -r requirements-dev.txt && python -m pytest -q
cd web && npm ci --legacy-peer-deps && npm run test
```

Variáveis de ambiente: [docs/reference/env-vars.md](docs/reference/env-vars.md). Não use `.env.example` como valor de produção: alguns valores divergem do código (ver [audit/DOCUMENTATION_AUDIT.md](audit/DOCUMENTATION_AUDIT.md)).

## Testes de banco

Exigem Postgres 17 com pgvector. Sem banco, são pulados. Com `REQUIRE_DB_TESTS=1`, a ausência vira falha. Ver [docs/how-to/run-db-tests.md](docs/how-to/run-db-tests.md).

## Deploy

- **Backend:** Cloud Run, pelo workflow `deploy-backend.yml`. Ainda não exige CI verde (ver [audit/CI_CD_AUDIT.md](audit/CI_CD_AUDIT.md)). Passos em [docs/how-to/deploy-backend.md](docs/how-to/deploy-backend.md).
- **Painel:** GitHub Pages, pelo workflow `deploy-pages.yml`.
- **App do totem:** APK gerado com EAS (`eas build -p android --profile preview`). Atualizações de JavaScript por OTA.

Os workflows de deploy não definem todas as variáveis de produção. Confira antes de implantar (**N-11** em `audit/FINDINGS.md`).

## Privacidade e segurança

O rosto é dado biométrico sensível. O sistema:

1. pede consentimento antes do cadastro (o aceite ainda não tem versão gravada);
2. não guarda a foto: converte em embedding de 512 dimensões;
3. guarda o embedding em tabela protegida por RLS, acessível pelo backend;
4. faz a comparação no servidor, e o tablet nunca recebe o vetor.

Estes controles têm lacunas abertas, listadas em [audit/LGPD_GAP_ANALYSIS.md](audit/LGPD_GAP_ANALYSIS.md) e [audit/REMEDIATION_STATUS.md](audit/REMEDIATION_STATUS.md). **Este projeto não declara conformidade com a LGPD.** Vulnerabilidades: [SECURITY.md](SECURITY.md).

## Limites conhecidos

- Os limiares de reconhecimento não foram medidos com dados reais ([docs/ml/model-card.md](docs/ml/model-card.md)).
- O tablet do laboratório ainda usa uma credencial compartilhada, que está pública no histórico do repositório (**AF-01**, **AF-02**).
- A janela de cadastro está fixa no código e já venceu.

## Licença

Apache License 2.0. Ver [LICENSE](LICENSE) e [NOTICE](NOTICE). O diretório `mobile/` contém um arquivo `LICENSE` de template MIT do Expo, de terceiros.
