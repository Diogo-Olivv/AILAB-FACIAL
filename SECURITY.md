# Política de segurança

Este projeto trata dados biométricos (imagens e vetores faciais) e dados pessoais de integrantes de um laboratório. Vulnerabilidades têm impacto real sobre pessoas e são tratadas com prioridade.

## Versões com suporte

Apenas a branch `master` recebe correções de segurança. Não há versões LTS.

| Versão | Suporte |
|---|---|
| `master` (implantação atual) | Sim |
| Tags e builds antigos | Não |

## Como reportar

**Não abra issue pública** com detalhes de vulnerabilidade, PoC, chaves, tokens, imagens ou dados de pessoas.

Use o relato privado do GitHub (Security → Report a vulnerability), quando estiver habilitado para este repositório. Se ainda não estiver disponível, entre em contato com o mantenedor pelo perfil do GitHub `@Diogo-Olivv`, sem enviar detalhes técnicos no canal público.

Inclua, se possível:

- componente afetado (arquivo e linha, rota ou migration);
- passos de reprodução e impacto esperado;
- versão ou commit testado;
- sugestão de correção, se houver.

## O que esperamos de você

- Teste apenas contra ambientes que você controla. Não acesse dados de integrantes reais.
- Não execute ataques de negação de serviço nem tente acessar dados de terceiros.
- Não publique a vulnerabilidade antes da correção ser disponibilizada.

## Prazos (alvo, não garantia)

| Etapa | Alvo |
|---|---|
| Confirmação de recebimento | 5 dias úteis |
| Triagem e classificação de severidade | 10 dias úteis |
| Correção para severidade alta ou crítica | 30 dias |
| Divulgação coordenada | Após correção, em acordo com quem reportou |

## Escopo

Dentro do escopo: backend FastAPI, migrations e RLS do Supabase, aplicativo web, aplicativo mobile do totem, workflows de CI/CD e configuração de implantação.

Fora do escopo: serviços de terceiros (Supabase, Google Cloud, Expo, GitHub) — reporte diretamente a eles.

## Segredos expostos

Se você encontrar credenciais, tokens ou chaves no repositório ou no histórico git, reporte imediatamente pelo canal privado. Não reutilize o valor encontrado. Consulte também `docs/runbooks/key-rotation.md` quando existir.

## Reconhecimento

Quem reportar uma vulnerabilidade válida pode ser citado nas notas de versão, se assim desejar.
