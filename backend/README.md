# AILAB-FACIAL API

Backend de reconhecimento facial e controle de presença do AILAB.
FastAPI + InsightFace (buffalo_s, CPU) + Supabase, servido em container Docker.

## Endpoints

- `GET /health` - checagem de disponibilidade
- `POST /recognize` - identifica um integrante a partir de um frame
- `POST /enroll` - cadastra um novo integrante a partir de varios frames

As rotas de reconhecimento e cadastro exigem o header `X-API-Key`.

## Variaveis de ambiente

- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `API_KEY`
- `FACE_THRESHOLD` (opcional, padrao 0.55)
- `DEBOUNCE_SECONDS` (opcional, padrao 60)

## Notas de memoria

Para caber em instancias de 512MB o servico carrega apenas os modelos de
deteccao e reconhecimento, limita threads (`OMP_NUM_THREADS=1`) e reduz as
arenas do malloc (`MALLOC_ARENA_MAX=2`). O buffalo_s e baixado no build da
imagem e carregado no startup (`warmup`), evitando latencia no primeiro request.
