# AILAB Facial - Web

Site de cadastro (owner) e dashboard de horas (estudantes), com Supabase Auth.

## Rotas

- `/login` - login por email e senha (Supabase Auth).
- `/dashboard` - horas acumuladas por integrante. Requer autenticacao.
- `/cadastro` - cadastro de integrante com captura facial. Apenas owner.
- `/kiosk` - tela do tablet (proximo passo). Apenas owner.

Owner e definido por `VITE_OWNER_EMAIL`. Estudantes usam uma conta compartilhada
que so enxerga o dashboard.

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
