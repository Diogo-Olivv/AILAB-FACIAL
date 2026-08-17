import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY, OWNER_EMAIL } from "./config.js";

// Sessao persiste em localStorage e renova sozinha: o owner loga uma vez e o
// tablet segue autenticado 24/7.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});

export async function getUsuario() {
  const { data } = await supabase.auth.getUser();
  return data.user || null;
}

export function ehOwner(user) {
  return !!user && user.email === OWNER_EMAIL;
}

export async function entrar(email, senha) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) throw error;
  return data.user;
}

export async function sair() {
  await supabase.auth.signOut();
}
