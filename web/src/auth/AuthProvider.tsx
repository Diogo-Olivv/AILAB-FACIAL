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
        let cleanEmail = (
          email && email.trim().length > 0 ? email.trim() : VIEWER_EMAIL
        ).toLowerCase();

        // Se o usuário digitou apenas o nome de usuário institucional sem o domínio, auto-completa
        if (!cleanEmail.includes("@")) {
          cleanEmail = `${cleanEmail}@ailab.com`;
        }

        // 1. Tenta autenticação padrão oficial no Supabase Auth (GoTrue)
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password,
          });

          if (!error && data?.session) {
            setSession(data.session);
            localStorage.setItem(TUTOR_STORAGE_KEY, JSON.stringify(data.session));
            localStorage.setItem("ailab_site_access_granted", "true");
            return;
          }
        } catch {
          // Prossegue para verificação via RPC e contingências
        }

        // 2. Consulta a RPC segura verify_tutor_login no Supabase
        try {
          const { data: rpcRes, error: rpcErr } = await supabase.rpc("verify_tutor_login", {
            p_email: cleanEmail,
            p_password: password,
          });

          if (!rpcErr && rpcRes && rpcRes.valid) {
            const tutorUser: User = {
              id: rpcRes.user_id || "tutor-master-id",
              aud: "authenticated",
              role: "authenticated",
              email: rpcRes.email || cleanEmail,
              app_metadata: { role: "tutor", provider: "email" },
              user_metadata: {
                role: "tutor",
                name: rpcRes.name || cleanEmail.split("@")[0],
              },
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

            setSession(tutorSession);
            localStorage.setItem(TUTOR_STORAGE_KEY, JSON.stringify(tutorSession));
            localStorage.setItem("ailab_site_access_granted", "true");
            return;
          }
        } catch {
          // Prossegue para contingência local
        }

        // 3. Verificação de credenciais personalizadas salvas localmente
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

        // 4. Verificação estática master (tutor@ailab.com / apenasParaTutores@42)
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

          setSession(tutorSession);
          localStorage.setItem(TUTOR_STORAGE_KEY, JSON.stringify(tutorSession));
          localStorage.setItem("ailab_site_access_granted", "true");
          return;
        }

        throw new Error("E-mail ou senha de tutor incorretos.");
      },
      signOut: async () => {
        localStorage.removeItem(TUTOR_STORAGE_KEY);
        localStorage.removeItem("ailab_site_access_granted");
        await supabase.auth.signOut().catch(() => {});
        setSession(null);
      },
      updateTutorCredentials: async (newEmail: string, newPassword: string) => {
        let cleanEmail = newEmail.trim().toLowerCase();
        if (!cleanEmail.includes("@")) {
          cleanEmail = `${cleanEmail}@ailab.com`;
        }
        if (!cleanEmail.endsWith("@ailab.com")) {
          throw new Error("O e-mail institucional deve terminar obrigatoriamente com @ailab.com");
        }
        if (!newPassword || newPassword.length < 6) {
          throw new Error("A nova senha deve possuir pelo menos 6 caracteres.");
        }

        // 1. Sincroniza credenciais no Supabase Auth via RPC (auth.users e auth.identities)
        const currentEmail = session?.user?.email || "tutor@ailab.com";
        const { data: syncRes, error: rpcErr } = await supabase.rpc("sync_tutor_credentials", {
          p_current_email: currentEmail,
          p_new_email: cleanEmail,
          p_new_password: newPassword,
        });

        if (rpcErr) {
          throw new Error(rpcErr.message || "Erro ao sincronizar credenciais no banco.");
        }

        // 2. Salva localmente para contingência
        localStorage.setItem(
          TUTOR_CUSTOM_CREDENTIALS_KEY,
          JSON.stringify({ email: cleanEmail, password: newPassword })
        );

        // 3. Tenta autenticar no GoTrue para obter JWT assinado
        try {
          const { data: signData } = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password: newPassword,
          });
          if (signData?.session) {
            setSession(signData.session);
            localStorage.setItem(TUTOR_STORAGE_KEY, JSON.stringify(signData.session));
            return;
          }
        } catch {
          // Fallback para sessão direta
        }

        // 4. Fallback imediato de sessão ativa
        const updatedUser: User = {
          ...(session?.user ?? ({} as User)),
          id: (syncRes as any)?.user_id || session?.user?.id || "tutor-master-id",
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
      updateTutorAvatar: async (avatarUrl: string | null) => {
        try {
          await supabase.auth.updateUser({
            data: { avatar_url: avatarUrl },
          });
        } catch {
          // Ignora caso esteja operando em modo offline / sessão local
        }

        if (session?.user) {
          const updatedUser: User = {
            ...session.user,
            user_metadata: {
              ...session.user.user_metadata,
              avatar_url: avatarUrl,
            },
          };
          const updatedSession: Session = {
            ...session,
            user: updatedUser,
          };
          setSession(updatedSession);
          localStorage.setItem(TUTOR_STORAGE_KEY, JSON.stringify(updatedSession));
        }
      },
    }),
    [session, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
