# AILAB-FACIAL — Presença por Reconhecimento Facial

Controle de presença para o laboratório de extensão. Substitui a lista de assinatura manual por reconhecimento facial: um tablet na entrada identifica o integrante pela câmera e registra entrada/saída. Tutores acompanham as horas por um painel web.

> Projeto didático e prático. O objetivo é tanto entregar o sistema com boa experiência de uso quanto aprender os fundamentos de inteligência artificial por trás do reconhecimento facial.

## Arquitetura

Reconhecimento server-side. Os clientes (tablet e web) capturam frames da câmera e enviam ao backend, que faz detecção, gera o embedding, compara com os cadastrados e registra a sessão. A biometria nunca sai do servidor.

```
Tablet (app Expo)  ─frames→  Backend FastAPI  ─service_role→  Supabase (Postgres)
Web (React kiosk)  ─frames→   InsightFace 512-D                 ↑ leitura anon
                                                          Dashboard web (tutores)
```

- **Backend (FastAPI + InsightFace):** recebe os frames, gera o embedding facial de 512 dimensões (buffalo_s, L2-normalizado, ONNX CPU), faz o match, aplica debounce e escreve a sessão no Supabase usando a `service_role` key. É o único componente que acessa a biometria.
- **Supabase (PostgreSQL):** banco único do sistema. `profiles`, `sessions`, `face_embeddings`, `face_logs`, com RLS. Clientes leem com a chave `anon`; `face_embeddings` é acessível somente pela `service_role`.
- **App Expo (tablet):** APK Android instalado no tablet da entrada. Lê presença/histórico e faz o cadastro de novos integrantes (captura as fotos e envia ao backend).
- **Web (React + Vite):** painel dos tutores (dashboard de horas) e modo kiosk de reconhecimento no navegador. Publicado no GitHub Pages.

## Estrutura do repositório

| Pasta | O que vive aqui |
|---|---|
| `backend/` | API FastAPI. `app/routers` (recognize, enroll, health), `app/services` (face, enroll, session), `app/db`. Deploy via Docker. |
| `web/` | SPA React + Vite + Tailwind. Login, dashboard, cadastro e kiosk. |
| `mobile/` | App Expo (React Native, expo-router). Tabs: Presença, Histórico, Câmera, Cadastro. |
| `supabase/` | `schema.sql` (tabelas, RPCs, RLS). Aplicar no SQL Editor ou `supabase db push`. |
| `pwa/`, `python/`, `enrollment/` | Legado das fases anteriores (PWA offline e scripts de estudo). Não fazem parte do fluxo atual. |

## Rodando localmente

### Backend

```bash
cd backend
cp .env.example .env   # SUPABASE_URL, SUPABASE_SERVICE_KEY, API_KEY, FACE_THRESHOLD, DEBOUNCE_SECONDS
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Web

```bash
cd web
cp .env.example .env   # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_BASE_URL, VITE_API_KEY, VITE_OWNER_EMAIL
npm install
npm run dev
```

### Mobile (Expo)

```bash
cd mobile
cp .env.example .env   # EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, EXPO_PUBLIC_API_BASE_URL, EXPO_PUBLIC_API_KEY
npm install
npx expo start
```

## Deploy

### Backend (Render)

`render.yaml` define o serviço Docker `ailab-facial-api`. As variáveis `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` e `API_KEY` entram como secrets no painel do Render (`sync: false`); `FACE_THRESHOLD` e `DEBOUNCE_SECONDS` têm default no arquivo.

### Web (GitHub Pages)

O workflow `.github/workflows/deploy-pages.yml` builda `web/` com base `/AILAB-FACIAL/` e publica no GitHub Pages a cada push na `master`. As `VITE_*` são secrets do repositório. O SPA usa fallback `404.html` para as rotas do react-router.

### Tablet (APK Android via EAS)

O tablet roda o app Expo empacotado como APK. O perfil `preview` do `eas.json` já produz um APK apontando para o backend em produção.

```bash
cd mobile
npm install -g eas-cli
eas login
eas build -p android --profile preview
```

Ao terminar, o EAS devolve um link do APK. Baixe no tablet e instale (ativar "fontes desconhecidas" nas configurações do Android). O backend que o app consome vem de `EXPO_PUBLIC_API_BASE_URL` (definido em `eas.json` no perfil `preview`); o Supabase vem de `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Não é preciso rebuildar para trocar o tablet: o mesmo APK serve para qualquer dispositivo, pois fala com o backend pela rede.

## Privacidade e Segurança (LGPD)

O rosto é um dado biométrico sensível. O sistema trata isso da seguinte forma:

1. O cadastro exige consentimento explícito (checkbox obrigatório no fluxo do app e da web); sem aceite não há cadastro. O `profiles` guarda `consent_given` e `consent_at`.
2. As fotos não são armazenadas: são processadas em embedding (vetor de 512 dimensões) e a imagem é descartada.
3. O embedding fica apenas em `face_embeddings`, tabela sem policy de RLS, acessível somente pela `service_role` do backend. Nenhum cliente autenticado (web ou app) lê a biometria.
4. O match acontece no servidor; o vetor facial nunca chega ao browser nem ao tablet.
