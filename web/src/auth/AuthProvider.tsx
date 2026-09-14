import { useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { VIEWER_EMAIL } from "../lib/config";
import { AuthContext, type AuthState } from "./auth-context";

const TUTOR_STATIC_EMAIL = "tutor@ailab.com";
const TUTOR_STATIC_PASSWORD = "apenasParaTutores@42";
const TUTOR_STORAGE_KEY = "ailab_tutor_session";

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

        // Verificação estrita das credenciais de Tutor solicitadas pelo usuário
        if (cleanEmail === TUTOR_STATIC_EMAIL && password === TUTOR_STATIC_PASSWORD) {
          const tutorUser: User = {
            id: "tutor-master-id",
            aud: "authenticated",
            role: "authenticated",
            email: TUTOR_STATIC_EMAIL,
            app_metadata: { role: "tutor", provider: "email" },
            user_metadata: { role: "tutor", name: "Tutor AiLab" },
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

        // Caso contrário, tenta login no Supabase
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
        await supabase.auth.signOut().catch(() => {});
        setSession(null);
      },
    }),
    [session, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
