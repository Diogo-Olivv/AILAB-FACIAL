# Arquitetura AILAB-FACIAL

Como o reconhecimento facial roda de graca no Google Cloud Run e conversa com o Supabase.

## Visao geral

Sao tres partes independentes:

1. App Expo (tablet Android) que captura frames da camera.
2. API FastAPI empacotada em Docker, rodando no Cloud Run, que faz a inferencia com o modelo InsightFace.
3. Supabase (PostgreSQL) que guarda perfis, embeddings e sessoes.

```
+----------------+        HTTPS + X-API-Key        +-----------------------+
|  App Expo      |  --  POST /api/v1/recognize  --> |  Cloud Run (Docker)   |
|  (tablet)      |  --  POST /api/v1/enroll     --> |  FastAPI + InsightFace|
+----------------+                                  +-----------+-----------+
       |                                                        | service_role
       |  Supabase Realtime (anon key, leitura direta)          v
       +----------------------------------------------->  +-----------------+
                        lista de presenca                 |  Supabase / PG  |
                                                          +-----------------+
```

Ponto importante: o app fala com a API para reconhecer e cadastrar, mas fala **direto** com o Supabase Realtime (sem passar pela API) so para montar a lista de quem esta presente. Sao dois canais distintos com chaves distintas.

## O modelo dentro do Docker

O modelo usado e o `buffalo_s` do InsightFace, que gera um embedding de 512 dimensoes normalizado (L2) por rosto. A inferencia roda em CPU via onnxruntime, sem GPU.

### Como o modelo e salvo na imagem

O truque para o primeiro request nao pagar o custo de download do modelo esta no `Dockerfile`: o modelo e baixado **durante o build** e fica gravado dentro da imagem.

```dockerfile
ENV INSIGHTFACE_ROOT=/app/.insightface

RUN python -c "from insightface.app import FaceAnalysis; \
    FaceAnalysis(name='buffalo_s', root='/app/.insightface', \
    providers=['CPUExecutionProvider'], \
    allowed_modules=['detection','recognition']).prepare(ctx_id=-1, det_size=(320, 320))" \
    && chmod -R a+rX /app/.insightface
```

O que acontece nessa etapa:

- `FaceAnalysis(name='buffalo_s', ...)` baixa os pesos do modelo (arquivos `.onnx`) para `/app/.insightface`.
- `allowed_modules=['detection','recognition']` carrega so o detector de rosto e o extrator de embedding, ignorando os modulos de idade, genero e landmark que nao usamos. Isso reduz memoria e tempo de carga.
- `.prepare(ctx_id=-1, ...)` roda a inicializacao em CPU (`ctx_id=-1`).
- `chmod -R a+rX` garante que o usuario do container consiga ler os pesos em runtime.

Depois desse `RUN`, os pesos ja fazem parte das camadas da imagem Docker. O container sobe sem tocar na internet para buscar modelo.

Referencia: [Docker RUN e camadas de imagem](https://docs.docker.com/reference/dockerfile/#run) e [InsightFace model zoo](https://github.com/deepinsight/insightface/tree/master/python-package).

### Como o modelo e carregado ao subir

Na inicializacao da API, o FastAPI usa um `lifespan` que chama `warmup()`, que forca a carga do modelo na memoria antes do primeiro request de usuario:

```python
# app/main.py
@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        warmup()
    except Exception as exc:
        log.warning("warmup falhou: %s", exc)
    yield
```

O `face_service.py` instancia o `FaceAnalysis` de forma preguicosa (lazy) e reaproveita a mesma instancia. Como os pesos ja estao em `/app/.insightface` (baixados no build), o `warmup()` so le do disco local, sem download.

Referencia: [FastAPI lifespan events](https://fastapi.tiangolo.com/advanced/events/).

## Como o Cloud Run roda o container

O Cloud Run executa a imagem Docker sem servidor gerenciado por nos. Pontos que importam para este projeto:

- **Porta injetada**: o Cloud Run define a variavel de ambiente `PORT` (valor `8080`) e espera que o container escute nela. O `CMD` do Dockerfile respeita isso:

  ```dockerfile
  CMD sh -c "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1 --log-level info"
  ```

  Em Cloud Run vira porta 8080; local, cai no default 8000.

- **Recursos**: o servico foi implantado com 2Gi de memoria e 1 vCPU. O modelo em CPU precisa de mais que os 512MB do plano free do Render, que era a causa dos 502 por OOM.

- **Scale to zero**: quando ninguem usa, o Cloud Run derruba as instancias e nao cobra. No primeiro request depois de ocioso ha um cold start (sobe o container e roda o `warmup()`), que leva alguns segundos.

- **Regiao**: `southamerica-east1` (Sao Paulo), mais perto do usuario.

- **URL do servico**: `https://ailab-facial-api-948162587922.southamerica-east1.run.app`.

Referencias: [Container runtime contract do Cloud Run](https://cloud.google.com/run/docs/container-contract) e [scale to zero e cold start](https://cloud.google.com/run/docs/about-instance-autoscaling).

## Fluxo de reconhecimento (Entrada/Saida)

1. O app tira uma foto com a `CameraView` e faz `POST /api/v1/recognize` com o frame e a acao (`check_in` ou `check_out`), enviando o header `X-API-Key`.
2. A API valida a chave (`verify_api_key`) e o tipo/tamanho da imagem (`validate_image`, ate 5MB, JPEG/PNG/WEBP).
3. `identify()` extrai o embedding do rosto e compara com todos os embeddings cadastrados usando distancia euclidiana. Escolhe o mais proximo (`argmin`) e rejeita se a distancia passar do `FACE_THRESHOLD` (0.55).
4. Se reconhecido, grava um `face_log` e chama `register_event()`, que aplica o debounce (60s) e alterna entre check-in e check-out gravando na tabela `sessions`.
5. A resposta volta com `recognized`, o perfil e o evento.

Se algo falhar, o app **nunca** mostra o codigo de erro cru: todos os hooks e componentes exibem apenas `GENERIC_ERROR_MESSAGE` (`mobile/lib/errors.ts`), e o status/body real fica so no `console.warn` para debug.

## Fluxo de cadastro (Enroll)

1. O app envia `POST /api/v1/enroll` com nome, matricula, consentimento e varias fotos.
2. `enroll_service.py` extrai o embedding de cada foto, descarta as sem rosto valido e tira a media normalizada. Se nenhuma foto tiver rosto valido, retorna 422 (por isso o emulador sem camera real falha aqui).
3. Cria o perfil em `profiles` e grava o embedding medio em `face_embeddings`. Se a gravacao do embedding falhar, o perfil recem-criado e removido (rollback manual).

## Comunicacao com o Supabase

Existem duas chaves, com papeis bem separados:

- **`SUPABASE_SERVICE_KEY` (service_role)**: usada **so no servidor** (`app/db/supabase_client.py`). Ignora RLS e tem acesso total. Nunca vai para o app. Fica como variavel de ambiente/secret no Cloud Run, nunca no git.
- **Chave anon (public)**: usada **so no app**, sujeita a RLS. Serve para o app assinar o Supabase Realtime e ler a lista de presenca direto, sem passar pela API.

Tabelas envolvidas:

- `profiles`: dados do integrante e consentimento LGPD.
- `face_embeddings`: vetor de 512 dimensoes por perfil (o dado biometrico).
- `sessions`: check-in/check-out, base do calculo de horas.
- `face_logs`: historico de reconhecimentos com confianca.

Referencias: [Supabase service_role vs anon key](https://supabase.com/docs/guides/api/api-keys) e [Supabase Realtime](https://supabase.com/docs/guides/realtime).

## Resumo dos ambientes e segredos

| Segredo | Onde vive | Quem usa |
|---|---|---|
| `SUPABASE_SERVICE_KEY` | env/secret do Cloud Run | so a API |
| `API_KEY` | env/secret do Cloud Run + env EAS `preview` | API valida, app envia |
| chave anon do Supabase | build EAS (inline no bundle) | so o app |

Nenhum desses valores deve ser commitado. No app os `EXPO_PUBLIC_*` acabam no bundle do cliente de qualquer forma, entao o cuidado especifico e nao versiona-los no git; as chaves de servidor ficam apenas como secret do Cloud Run.
