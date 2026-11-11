# Sequência: cadastro de integrante

Mostra o caminho de um cadastro novo, feito por um tutor no tablet. Baseado em `backend/app/routers/enroll.py` e `backend/app/services/enroll_service.py`. Falhas e lacunas em `audit/FLOWS.md`, seção 3.

```mermaid
sequenceDiagram
    autonumber
    actor Tu as Tutor
    actor I as Integrante
    participant T as App (tablet)
    participant A as API (FastAPI)
    participant D as Postgres

    Tu->>T: entra com e-mail e senha (Supabase Auth)
    T->>T: guarda o token do tutor só em memória (10 min)
    Tu->>T: informa nome e matrícula
    I->>T: aceita o termo de consentimento
    T->>T: captura 5 fotos (intervalo de 500 ms)
    T->>A: POST /enroll (nome, matrícula, consentimento, fotos) com JWT do tutor
    A->>A: autentica o tutor e aplica o limite de 20/min
    A->>A: valida cada imagem (bytes, dimensões, tamanho)
    A->>A: extrai por foto: qualidade, prova de vida e embedding
    alt menos de 3 fotos válidas
        A-->>T: 422
    end
    A->>A: compara as fotos entre si (distância máxima 0,82)
    alt fotos divergentes
        A-->>T: 422
    end
    A->>D: lê os templates ativos para checar duplicidade (1:N)
    alt já existe rosto parecido
        A-->>T: 409
    end
    A->>D: INSERT profiles
    A->>D: INSERT face_embeddings (vetor transformado por BioHash)
    alt falha ao gravar o embedding
        A->>D: DELETE do perfil recém-criado (compensação)
    end
    A-->>T: 200 perfil criado
    T->>T: descarta o token do tutor
```

## Pontos que valem atenção

- **Consentimento:** é validado no backend como campo obrigatório, mas o aceite hoje é um interruptor operado pelo tutor, e a versão do termo não é gravada (`audit/LGPD_GAP_ANALYSIS.md`).
- **Falha aberta na checagem de duplicidade (N-13):** se a leitura dos templates falhar, o código segue como se ninguém estivesse cadastrado. Uma falha transitória do banco pode permitir cadastrar a mesma pessoa duas vezes.
- **Sem trava entre a checagem e a inserção:** dois cadastros simultâneos da mesma pessoa podem passar.
- **Compensação não atômica:** se o segundo `INSERT` falhar, o perfil é apagado por um comando separado.
- **Fotos:** não são gravadas. O texto "descartadas imediatamente" depende da coleta de lixo do dispositivo e do servidor (**N-27**).
