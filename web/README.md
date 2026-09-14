# AILAB Facial - Web

Dashboard de acompanhamento de horas e permanência no laboratório com Supabase Auth.

## Rotas

- `/login` - Autenticação por e-mail e senha (Supabase Auth).
- `/dashboard` - Visualização de horas acumuladas por integrante, totais do período e histórico diário.

> Nota: O modo Totem Kiosk e o cadastro biométrico facial são operados exclusivamente através do aplicativo móvel para tablet (`mobile/`), preservando a separação de privilégios.

## Setup local

```bash
cp .env.example .env   # preencha as chaves
npm install
npm run dev
```

## Variaveis de ambiente

Ver `.env.example`. As chaves `VITE_API_KEY` ficam embutidas no bundle e por isso
o cadastro e o kiosk sao restritos ao owner.

## Supabase

1. Aplique `../supabase/schema.sql` no projeto (SQL Editor).
2. Em Authentication, desative signups publicos.
3. Crie a conta do owner com o email de `VITE_OWNER_EMAIL`.
4. Crie a conta compartilhada dos estudantes.

As politicas RLS liberam leitura de `profiles` e `sessions` para usuarios
autenticados. Biometria (`face_embeddings`) e acessivel apenas via service_role
no backend.
