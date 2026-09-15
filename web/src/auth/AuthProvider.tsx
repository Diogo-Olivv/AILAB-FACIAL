import { useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { VIEWER_EMAIL } from "../lib/config";
import { AuthContext, type AuthState } from "./auth-context";

const TUTOR_STATIC_EMAIL = "tutor@ailab.com";
const TUTOR_STATIC_PASSWORD = "apenasParaTutores@42";
const TUTOR_STORAGE_KEY = "ailab_tutor_session";
const TUTOR_CUSTOM_CREDENTIALS_KEY = "ailab_custom_tutor_credentials";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Verifica se há sessão local ativa do tutor
    try {
      const localTutor = localStorage.getItem(TUTOR_STORAGE_KEY);
      if (localTutor) {
        const parsed = JSON.parse(localTutor);
        setSession(parsed);
        setLoading(false);
        return;
      }
    } catch {
      // Ignora erro
    }

    // 2. Verifica sessão do Supabase Auth
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) {
          supabase.auth.signOut().catch(() => {});
          setSession(null);
        } else {
          setSession(data.session);
        }
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (next) {
        setSession(next);
      }
    });
    return () => sub.subscription.unsubscribe();
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

        // 1. Verifica credenciais personalizadas salvas previamente pelo tutor
        let isCustomMatch = false;
        try {
          const rawCustom = localStorage.getItem(TUTOR_CUSTOM_CREDENTIALS_KEY);
          if (rawCustom) {
            const custom = JSON.parse(rawCustom);
            if (
              custom.email &&
              custom.password &&
              custom.email.toLowerCase() === cleanEmail &&
              custom.password === password
            ) {
              isCustomMatch = true;
            }
          }
        } catch {
          // Ignora erro de parse
        }

        // 2. Verificação do primeiro acesso padrão (tutor@ailab.com) ou credenciais personalizadas
        const isStaticMatch =
          cleanEmail === TUTOR_STATIC_EMAIL && password === TUTOR_STATIC_PASSWORD;

        if (isStaticMatch || isCustomMatch) {
          const tutorEmail = isCustomMatch ? cleanEmail : TUTOR_STATIC_EMAIL;
          const tutorName = tutorEmail.split("@")[0] || "Tutor";

          const tutorUser: User = {
            id: "tutor-master-id",
            aud: "authenticated",
            role: "authenticated",
            email: tutorEmail,
            app_metadata: { role: "tutor", provider: "email" },
            user_metadata: { role: "tutor", name: tutorName },
            created_at: new Date().toISOString(),
          } as User;

          const tutorSession: Session = {
            access_token: "tutor-static-session-token",
            token_type: "bearer",
            user: tutorUser,
            expires_in: 3600 * 24 * 7,
            expires_at: Math.floor(Date.now() / 1000) + 3600 * 24 * 7,
            refresh_token: "tutor-refresh-token",
          };

          // Tenta também autenticar no Supabase Auth caso a conta exista lá
          try {
            const { data } = await supabase.auth.signInWithPassword({
              email: cleanEmail,
              password,
            });
            if (data?.session) {
              setSession(data.session);
              localStorage.setItem(TUTOR_STORAGE_KEY, JSON.stringify(data.session));
              localStorage.setItem("ailab_site_access_granted", "true");
              return;
            }
          } catch {
            // Em caso de ausência no Supabase, mantém a sessão do tutor local autorizada
          }

          setSession(tutorSession);
          localStorage.setItem(TUTOR_STORAGE_KEY, JSON.stringify(tutorSession));
          localStorage.setItem("ailab_site_access_granted", "true");
          return;
        }

        // Caso contrário, tenta login padrão no Supabase
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (error || !data.session) {
          throw error || new Error("Credenciais inválidas.");
        }

        setSession(data.session);
        localStorage.setItem("ailab_site_access_granted", "true");
      },
      signOut: async () => {
        localStorage.removeItem(TUTOR_STORAGE_KEY);
        localStorage.removeItem("ailab_site_access_granted");
        await supabase.auth.signOut().catch(() => {});
        setSession(null);
      },
      updateTutorCredentials: async (newEmail: string, newPassword: string) => {
        const cleanEmail = newEmail.trim().toLowerCase();
        if (!cleanEmail.endsWith("@ailab.com")) {
          throw new Error("O e-mail institucional deve terminar obrigatoriamente com @ailab.com");
        }
        if (!newPassword || newPassword.length < 6) {
          throw new Error("A nova senha deve possuir pelo menos 6 caracteres.");
        }

        // Armazena as novas credenciais personalizadas
        localStorage.setItem(
          TUTOR_CUSTOM_CREDENTIALS_KEY,
          JSON.stringify({ email: cleanEmail, password: newPassword })
        );

        // Atualiza a sessão ativa imediatamente
        const updatedUser: User = {
          ...(session?.user ?? ({} as User)),
          id: session?.user?.id || "tutor-master-id",
          aud: "authenticated",
          role: "authenticated",
          email: cleanEmail,
          app_metadata: { role: "tutor", provider: "email" },
          user_metadata: { role: "tutor", name: cleanEmail.split("@")[0] },
          created_at: session?.user?.created_at || new Date().toISOString(),
        } as User;

        const updatedSession: Session = {
          access_token: session?.access_token || "tutor-static-session-token",
          token_type: "bearer",
          user: updatedUser,
          expires_in: 3600 * 24 * 7,
          expires_at: Math.floor(Date.now() / 1000) + 3600 * 24 * 7,
          refresh_token: session?.refresh_token || "tutor-refresh-token",
        };

        setSession(updatedSession);
        localStorage.setItem(TUTOR_STORAGE_KEY, JSON.stringify(updatedSession));
      },
    }),
    [session, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
