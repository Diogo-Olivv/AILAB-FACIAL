import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Guarda de configuração: sem as variáveis VITE_SUPABASE_* o createClient lança
// "supabaseUrl is required." no carregamento do módulo e derruba todo o app
// (tela branca). Em vez de quebrar, avisamos claramente e seguimos com um
// cliente placeholder — a UI carrega e as chamadas de dados falham de forma
// tratável. Em produção as variáveis existem, então o placeholder nunca é usado.
if (!url || !anonKey) {
  console.error(
    "[AILAB] Variáveis de ambiente ausentes: crie o arquivo web/.env com " +
      "VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (veja o README). " +
      "Sem elas os dados do dashboard não carregam."
  );
}

export const supabase = createClient(
  url || "https://placeholder.supabase.co",
  anonKey || "placeholder-anon-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  }
);
