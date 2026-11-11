# Sequência: reconhecimento (check-in e check-out)

Mostra, em ordem, o que acontece entre o integrante olhar para o totem e a presença ser registrada. Baseado em `backend/app/routers/recognize.py` e nas migrations 24 e 25. Caminhos de falha completos em `audit/FLOWS.md`, seção 2.

> **Estado em produção (2026-11-11):** o desenho abaixo é o do código atual. As funções `register_presence_event` e `claim_recognition_request` ainda **não existem** no banco de produção (`audit/CODE_DB_DRIFT.md`, D-01 e D-02). Este diagrama descreve o comportamento alvo.

```mermaid
sequenceDiagram
    autonumber
    actor P as Integrante
    participant T as Totem (app Expo)
    participant A as API (FastAPI)
    participant D as Postgres (RPCs)

    P->>T: aproxima-se do tablet
    T->>A: GET /recognize/challenge (JWT de kiosk)
    A-->>T: challenge_id assinado (validade curta, ligado ao dispositivo)
    T->>T: captura 1 a 5 quadros (o 2º com flash de tela)
    T->>A: POST /recognize (quadros + challenge_id + ação)
    A->>A: autentica o kiosk e aplica o limite de 60/min
    A->>A: valida o desafio e cada imagem (bytes, dimensões)
    A->>D: claim_recognition_request(cid, impressão digital)
    alt resultado já guardado
        D-->>A: completed
        A-->>T: 200 com o mesmo resultado (X-Idempotent-Replayed)
    else já em processamento
        D-->>A: processing
        A-->>T: 409 + Retry-After
    else novo
        D-->>A: claimed
        A->>A: verifica qualidade, prova de vida e calcula o embedding
        A->>D: match_face(vetor, limiar)
        D-->>A: perfil mais próximo e similaridade
        alt reconhecido
            A->>D: complete_recognition_request(...)
            Note over D: na mesma transação: grava face_logs,<br/>chama register_presence_event e guarda o resultado
            D-->>A: ação (check_in, check_out, already_in, not_in, debounced)
            A-->>T: 200 reconhecido + ação + nome
        else não reconhecido, incerto ou spoof
            A->>D: complete_recognition_request(sem perfil)
            A-->>T: 200 não reconhecido (sem dados pessoais)
        end
    end
    T-->>P: mostra o resultado e inicia o intervalo de espera
```

## Pontos que valem atenção

- **Idempotência:** repetir o mesmo desafio com as mesmas imagens devolve o mesmo resultado, sem registrar duas vezes. Se o conteúdo mudar, é conflito (409).
- **Atomicidade:** o registro de log, a mudança de presença e a guarda de replay acontecem na mesma transação do banco.
- **Debounce:** um novo registro do mesmo integrante em menos de 60 segundos devolve `debounced` e não altera a sessão.
- **Sessão que atravessa a meia-noite ou passa de 10 horas** é anulada e a nova marcação vira uma entrada (**N-19**).
- **Resultado negativo não grava nada** em `face_logs` nem em `sessions`. Tentativas de fraude não geram evento de segurança (**N-17**).
