# Documentação do AILAB-FACIAL

Organizada pelo modelo [Diátaxis](https://diataxis.fr/): cada documento serve a uma necessidade. Se você não sabe onde procurar, comece pela tabela.

| Você quer... | Vá para |
|---|---|
| Rodar o sistema pela primeira vez, no seu computador | [tutorials/first-run-local.md](tutorials/first-run-local.md) |
| Resolver uma tarefa específica (deploy, rotação, migration) | [how-to/](how-to/) |
| Consultar uma variável, uma rota ou um código de erro | [reference/](reference/) |
| Entender por que o sistema é assim | [explanation/](explanation/) e [adr/](adr/) |
| Responder a um incidente | [runbooks/](runbooks/) |
| Saber o que a lei exige e o que está pendente | [privacy/](privacy/) e [audit/LGPD_GAP_ANALYSIS.md](../audit/LGPD_GAP_ANALYSIS.md) |
| Entender a qualidade do reconhecimento | [ml/model-card.md](ml/model-card.md) |
| Ver o que está aberto e quem decide | [audit/REMEDIATION_STATUS.md](../audit/REMEDIATION_STATUS.md) e [ROADMAP.md](ROADMAP.md) |

## Mapa

```
docs/
├── tutorials/      aprender fazendo (passo a passo com resultado conhecido)
├── how-to/         resolver uma tarefa (assume que você conhece o sistema)
├── reference/      consulta exata: variáveis, rotas, erros, banco, workflows
├── explanation/    arquitetura, segurança, biometria, privacidade
├── adr/            decisões de arquitetura registradas (MADR)
├── privacy/        RIPD, retenção, direitos do titular, aviso de privacidade
├── ml/             ficha do modelo e avaliação de qualidade
├── runbooks/       operação em situação de incidente ou rotina
├── accessibility.md
├── glossary.md
├── faq.md
└── ROADMAP.md
```

## Estado desta documentação

- Revisada em 2026-11-11 contra `master@5f1d99c`.
- Quando um documento afirma algo sobre produção, a data da captura está no próprio documento. Produção muda; reconfirme antes de agir.
- Lacunas conhecidas estão marcadas com **pendente** e listadas em [ROADMAP.md](ROADMAP.md).
- Este documento **não declara conformidade** com a LGPD nem prontidão para produção. Descreve controles e lacunas.
