import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { VIEWER_EMAIL } from "../lib/config";
import { AuthContext, type AuthState } from "./auth-context";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Obtém a sessão real gerenciada pelo Supabase Auth
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error || !data.session) {
          setSession(null);
        } else {
          // Validação fail-closed: verifica se papel de tutor consta estritamente em app_metadata
          const role = data.session.user?.app_metadata?.role;
          if (role === "tutor") {
            setSession(data.session);
          } else {
            setSession(null);
          }
        }
        setLoading(false);
      })
      .catch(() => {
        setSession(null);
        setLoading(false);
      });

    // 2. Ouve eventos de autenticação do Supabase Auth (refresh de token, sign in, sign out)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (nextSession) {
        const role = nextSession.user?.app_metadata?.role;
        if (role === "tutor") {
          setSession(nextSession);
        } else {
          setSession(null);
        }
      } else {
        setSession(null);
      }
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      signIn: async (password: string, email?: string) => {
        const cleanEmail = (
          email && email.trim().length > 0 ? email.trim() : VIEWER_EMAIL
        ).toLowerCase();

        if (!cleanEmail.includes("@")) {
          throw new Error("Informe o e-mail completo com domínio institucional.");
        }

        // Autenticação oficial no Supabase Auth (GoTrue)
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (error) {
          throw new Error("E-mail ou senha de tutor incorretos.");
        }

        if (!data?.session) {
          throw new Error("Não foi possível iniciar a sessão.");
        }

        // Validação rigorosa: role deve estar em app_metadata (imutável pelo cliente)
        const role = data.session.user?.app_metadata?.role;
        if (role !== "tutor") {
          await supabase.auth.signOut().catch(() => {});
          setSession(null);
          throw new Error("Acesso negado. Esta conta não possui privilégios de tutor.");
        }

        setSession(data.session);
      },
      signOut: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
          console.warn("Falha ao invalidar sessão no servidor:", error.message);
          throw new Error("Não foi possível encerrar a sessão. Verifique a conexão.");
        }
        setSession(null);
      },
      updateTutorCredentials: async (newEmail: string, newPassword: string) => {
        const cleanEmail = newEmail.trim().toLowerCase();
        if (!cleanEmail.includes("@")) {
          throw new Error("Informe um e-mail válido.");
        }
        if (!newPassword || newPassword.length < 6) {
          throw new Error("A nova senha deve possuir pelo menos 6 caracteres.");
        }

        // Atualização oficial no Supabase Auth via GoTrue
        const { error } = await supabase.auth.updateUser({
          email: cleanEmail,
          password: newPassword,
        });

        if (error) {
          throw new Error(error.message || "Falha ao atualizar credenciais.");
        }
      },
      updateTutorAvatar: async (avatarUrl: string | null) => {
        const { error } = await supabase.auth.updateUser({
          data: { avatar_url: avatarUrl },
        });
        if (error) {
          throw new Error(error.message || "Falha ao atualizar foto de perfil.");
        }
      },
    }),
    [session, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
