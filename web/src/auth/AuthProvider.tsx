import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { VIEWER_EMAIL } from "../lib/config";
import { AuthContext, type AuthState } from "./auth-context";

const TUTOR_STORAGE_KEY = "ailab_tutor_session";
const CUSTOM_CREDENTIALS_KEY = "ailab_custom_tutor_credentials";
const MASTER_PASSWORDS = [
  "ailab_makers",
  "admin123",
  "tutor_makers",
  "ailab2026",
  "presenca_makers",
  "noPromptEngAllowed@42",
];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 0. Verifica se há sessão local persistida do tutor
    try {
      const local = localStorage.getItem(TUTOR_STORAGE_KEY);
      if (local) {
        const parsed = JSON.parse(local);
        if (parsed?.user?.app_metadata?.role === "tutor") {
          setSession(parsed);
          setLoading(false);
          return;
        }
      }
    } catch {}

    // 1. Obtém a sessão real gerenciada pelo Supabase Auth
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error || !data.session) {
          setSession(null);
        } else {
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
        // Se houver sessão local mestre, não zera por deslog do Supabase
        const local = localStorage.getItem(TUTOR_STORAGE_KEY);
        if (!local) {
          setSession(null);
        }
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
      signIn: async (arg1: string, arg2?: string) => {
        let cleanEmail: string;
        let cleanPassword: string;

        if (arg1.includes("@")) {
          cleanEmail = arg1.trim().toLowerCase();
          cleanPassword = arg2 ?? "";
        } else if (arg2 && arg2.includes("@")) {
          cleanEmail = arg2.trim().toLowerCase();
          cleanPassword = arg1;
        } else {
          cleanEmail = VIEWER_EMAIL.toLowerCase();
          cleanPassword = arg1;
        }

        // 1. Tenta autenticação nativa no Supabase Auth (GoTrue)
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password: cleanPassword,
          });

          if (!error && data?.session) {
            const role =
              data.session.user?.app_metadata?.role ||
              data.session.user?.user_metadata?.role;
            if (role === "tutor") {
              setSession(data.session);
              try {
                localStorage.setItem(TUTOR_STORAGE_KEY, JSON.stringify(data.session));
              } catch {}
              return;
            }
          }
        } catch {
          // Fallback para checagem de senhas mestras de tutoria
        }

        // 2. Fallback de contingência: senhas mestras e credenciais locais do tutor
        const trimmedPass = cleanPassword.trim();
        let storedCustomPass: string | null = null;
        try {
          const stored = localStorage.getItem(CUSTOM_CREDENTIALS_KEY);
          if (stored) storedCustomPass = JSON.parse(stored)?.password;
        } catch {}

        const isMaster =
          MASTER_PASSWORDS.includes(trimmedPass) ||
          (storedCustomPass && trimmedPass === storedCustomPass);

        if (isMaster) {
          const tutorEmail = cleanEmail.includes("@") ? cleanEmail : VIEWER_EMAIL.toLowerCase();
          const masterSession: any = {
            access_token: "tutor-master-local-session",
            token_type: "bearer",
            user: {
              id: "tutor-master-id",
              aud: "authenticated",
              role: "authenticated",
              email: tutorEmail,
              app_metadata: { role: "tutor", provider: "email" },
              user_metadata: { role: "tutor", name: tutorEmail.split("@")[0] || "Tutor" },
              created_at: new Date().toISOString(),
            },
            expires_in: 3600 * 24 * 7,
            expires_at: Math.floor(Date.now() / 1000) + 3600 * 24 * 7,
            refresh_token: "tutor-refresh-token",
          };
          setSession(masterSession);
          try {
            localStorage.setItem(TUTOR_STORAGE_KEY, JSON.stringify(masterSession));
          } catch {}
          return;
        }

        throw new Error("E-mail ou senha de tutor incorretos.");
      },
      signOut: async () => {
        try {
          localStorage.removeItem(TUTOR_STORAGE_KEY);
        } catch {}
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

        try {
          localStorage.setItem(
            CUSTOM_CREDENTIALS_KEY,
            JSON.stringify({ email: cleanEmail, password: newPassword })
          );
        } catch {}

        // Atualização oficial no Supabase Auth via GoTrue
        await supabase.auth.updateUser({
          email: cleanEmail,
          password: newPassword,
        }).catch(() => {});

        if (session?.user) {
          const updatedSession: any = {
            ...session,
            user: {
              ...session.user,
              email: cleanEmail,
            },
          };
          setSession(updatedSession);
          try {
            localStorage.setItem(TUTOR_STORAGE_KEY, JSON.stringify(updatedSession));
          } catch {}
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
