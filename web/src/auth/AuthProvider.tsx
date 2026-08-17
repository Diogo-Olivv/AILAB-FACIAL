import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { OWNER_EMAIL } from "../lib/config";
import { AuthContext, type AuthState } from "./auth-context";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthState>(() => {
    const email = session?.user.email?.toLowerCase() ?? "";
    return {
      session,
      user: session?.user ?? null,
      loading,
      isOwner: Boolean(OWNER_EMAIL) && email === OWNER_EMAIL,
      signIn: async (emailInput, password) => {
        const { error } = await supabase.auth.signInWithPassword({
          email: emailInput,
          password,
        });
        if (error) throw error;
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
    };
  }, [session, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
