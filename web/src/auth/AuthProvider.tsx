import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { VIEWER_EMAIL } from "../lib/config";
import { isTutorSession, normalizeCredentials, purgeLegacyAuthStorage } from "../lib/authDecision";
import { AuthContext, type AuthState } from "./auth-context";

function tutorOrNull(session: Session | null): Session | null {
  return session && isTutorSession(session) ? session : null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Versões antigas gravavam sessão forjada e senha em texto claro: apaga.
    try {
      purgeLegacyAuthStorage(window.localStorage);
    } catch {
      // localStorage indisponível
    }

    // A única fonte de sessão é o Supabase Auth.
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        setSession(error ? null : tutorOrNull(data.session));
        setLoading(false);
      })
      .catch(() => {
        setSession(null);
        setLoading(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(tutorOrNull(nextSession));
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
      signIn: async (arg1: string, arg2?: string) => {
        const { email, password } = normalizeCredentials(arg1, arg2, VIEWER_EMAIL);

        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error || !data?.session) {
          throw new Error("E-mail ou senha de tutor incorretos.");
        }
        if (!isTutorSession(data.session)) {
          await supabase.auth.signOut().catch(() => {});
          throw new Error("E-mail ou senha de tutor incorretos.");
        }
        setSession(data.session);
      },
      signOut: async () => {
        await supabase.auth.signOut().catch(() => {});
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
