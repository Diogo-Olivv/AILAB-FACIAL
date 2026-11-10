import { useEffect, useState } from "react";
import { provisionKiosk } from "@/lib/api";
import { kioskClient } from "@/lib/supabase";

/**
 * Identidade própria do dispositivo (totem).
 *
 * O totem só opera depois de ativado por um tutor: o backend cria uma conta
 * exclusiva (papel `kiosk`), o app inicia a sessão com a credencial recebida e a
 * descarta em seguida. A sessão fica em armazenamento protegido (ver lib/supabase.ts).
 * Reinstalar o app apaga a sessão: o dispositivo precisa ser ativado de novo.
 */
export type KioskIdentityStatus = "loading" | "provisioned" | "unprovisioned";

function isKioskSession(session: { user?: { app_metadata?: Record<string, unknown> } } | null): boolean {
  return session?.user?.app_metadata?.role === "kiosk";
}

/** Ativa este dispositivo usando a sessão temporária de um tutor. */
export async function activateKiosk(label: string, tutorToken: string): Promise<void> {
  const credential = await provisionKiosk(label.trim(), tutorToken);
  const { data, error } = await kioskClient.auth.signInWithPassword({
    email: credential.email,
    password: credential.password,
  });
  if (error || !isKioskSession(data.session)) {
    throw new Error("O dispositivo foi criado, mas não foi possível iniciar a sessão. Tente ativar novamente.");
  }
}

/** Remove a identidade local (ex.: antes de reprovisionar). Não revoga a conta no servidor. */
export async function forgetKioskIdentity(): Promise<void> {
  await kioskClient.auth.signOut({ scope: "local" });
}

export function useKioskIdentity(): KioskIdentityStatus {
  const [status, setStatus] = useState<KioskIdentityStatus>("loading");

  useEffect(() => {
    let mounted = true;

    kioskClient.auth
      .getSession()
      .then(({ data }) => {
        if (mounted) setStatus(isKioskSession(data.session) ? "provisioned" : "unprovisioned");
      })
      .catch(() => {
        if (mounted) setStatus("unprovisioned");
      });

    const { data: sub } = kioskClient.auth.onAuthStateChange((_event, session) => {
      if (mounted) setStatus(isKioskSession(session) ? "provisioned" : "unprovisioned");
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return status;
}
