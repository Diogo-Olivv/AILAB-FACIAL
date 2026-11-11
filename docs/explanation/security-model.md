# Modelo de segurança

> Explica as camadas e as premissas. O inventário de achados está em `audit/FINDINGS.md`; o estado de cada um, em `audit/REMEDIATION_STATUS.md`.

## Ativos que importam

1. **Dados biométricos** (embeddings de rostos): a proteção mais alta, porque não podem ser trocados como uma senha.
2. **Dados pessoais** de integrantes: nome, matrícula, avatar, histórico de presença.
3. **Justificativas** com texto livre, que podem conter dados de saúde.
4. **Acesso administrativo**: contas de tutor, de kiosk e chaves de serviço.
5. **Integridade do registro de horas**: é o que o laboratório usa para decisões.

## Atores e confiança

| Ator | Confiança | Pode fazer |
|---|---|---|
| Integrante | Nenhuma | Ser reconhecido. Nada mais |
| Totem (conta kiosk) | Parcial: é um dispositivo físico, que pode ser roubado | Registrar presença e pedir desafio. Não pode cadastrar nem ler biometria |
| Tutor | Alta, mas limitada ao papel | Cadastrar, ativar totens, acompanhar horas, justificar |
| Backend (`service_role`) | Total: contorna RLS | Tudo, por isso é o ponto de maior impacto |
| Cliente com chave anon | Nenhuma | Ler o que as políticas permitirem |

## Camadas

1. **Identidade.** Cada totem tem conta própria (desejado). Tutor autentica por Supabase Auth. Hoje a chave compartilhada ainda existe (**AF-01**).
2. **Autorização.** RLS no banco e dependências FastAPI (`deps.py`). A autoridade é do servidor, nunca da interface (a guarda de rota do web é só usabilidade).
3. **Desafio.** Token assinado, de 30 segundos, vinculado ao dispositivo. Prova frescor e origem da requisição. **Não prova** que a imagem veio de um rosto real (**AF-15**, risco aceito).
4. **Anti-replay.** Reenvio com o mesmo desafio devolve o resultado guardado, em vez de registrar de novo. Em produção, a guarda fica no banco.
5. **Prova de vida (PAD).** Modelo que tenta separar rosto real de foto ou tela. Obrigatório em produção. Não há medição com dados reais (`ml/model-card.md`).
6. **Validação de upload.** Tipo real pelos bytes, dimensões e tamanho. Aplicada no corpo da requisição antes de ler o formulário.
7. **Registro.** Tabelas de auditoria (`admin_audit_log`) com inserção restrita. Cobertura incompleta (**N-05**).

## Premissas

- O totem pode ser roubado ou clonado. Por isso a credencial de cada um deve ser revogável.
- O banco é a única fonte de verdade para permissões. A interface não concede acesso.
- Segredos não ficam no repositório. Isso não vale para o histórico, que já tem valores expostos (**AF-02**).
- Logs não devem conter dados pessoais. Hoje há exceções (**N-16**, a confirmar).

## Lacunas abertas (resumo)

| Lacuna | Referência |
|---|---|
| Credencial mestra e chave compartilhada | AF-01, AF-04 |
| Login legado com credencial literal ainda em produção | AF-14 |
| Leitura anon de perfis e sessões | AF-25 |
| Fail-open na checagem de duplicidade | N-13 |
| Proteção contra senhas vazadas desligada | AF-26 |
| Deploy sem gate de CI | CI-01 |

## O que este modelo não cobre

- Ameaças físicas ao tablet (furto, acesso ao sistema operacional).
- Ataque à infraestrutura do fornecedor (Supabase, Google Cloud).
- Coerção de um tutor.
- Ataques contra o modelo de reconhecimento (ex.: adversarial) sem teste dedicado.
