# Termo de Consentimento — Uso de Dados Biométricos Faciais

> **Base legal: Lei Geral de Proteção de Dados (LGPD), Lei 13.709/2018, Art. 11**
> (dados sensíveis exigem consentimento específico e destacado).

## Modelo de termo a entregar para cada participante

---

**TERMO DE CONSENTIMENTO PARA TRATAMENTO DE DADOS BIOMÉTRICOS**

Eu, **[nome completo]**, CPF **[___________]**, estudante/colaborador do
laboratório **[nome do laboratório]**, autorizo o tratamento dos meus dados
faciais (fotografias e vetores de características extraídos delas) pelo projeto
de extensão **AILAB**, nos termos descritos abaixo:

1. **Finalidade**: registrar automaticamente meus horários de entrada e saída no
   laboratório, substituindo a lista de presença manuscrita.
2. **Dados coletados**: até 10 fotografias do meu rosto e o vetor numérico
   (embedding de 128 dimensões) derivado delas.
3. **Onde os dados ficam**: armazenados localmente no tablet do laboratório
   (Samsung Galaxy Tab S6 Lite) e em planilha Google compartilhada apenas com
   tutores do projeto.
4. **Quem acessa**: tutores e coordenadores do projeto AILAB.
5. **Retenção**: enquanto eu participar do projeto. Ao sair, posso solicitar a
   exclusão imediata.
6. **Direitos**: a qualquer momento posso solicitar acesso, correção ou exclusão
   dos meus dados, sem prejuízo da minha participação no projeto (volto à lista
   manuscrita).
7. **Não compartilhamento**: meus dados não serão compartilhados com terceiros,
   nem usados para treinar modelos públicos.

**Local e data**: ___________________

**Assinatura**: ___________________

**Tutor responsável**: ___________________

---

## Checklist operacional para os tutores

- [ ] Termo assinado **antes** de qualquer cadastro.
- [ ] Cópia digitalizada arquivada (pasta do projeto).
- [ ] Cadastro feito **na presença** do participante.
- [ ] Ao sair do projeto: remover a pessoa do `database.json` (PWA → tela de
      cadastro → excluir) e da planilha.
- [ ] Backup dos embeddings: criptografado, fora do tablet, acessível só pelo
      coordenador.
