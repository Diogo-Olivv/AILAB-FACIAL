import { endTutorSession } from "@/lib/supabase";

/**
 * Sessão temporária do tutor no kiosk: vive apenas em memória.
 * O token nunca vai para parâmetros de rota, AsyncStorage, logs ou URLs.
 */
let currentToken: string | null = null;
let expiryTimer: ReturnType<typeof setTimeout> | null = null;

/** Tempo máximo que a liberação de tutor fica ativa sem novo login. */
const TUTOR_SESSION_MAX_MS = 10 * 60 * 1000;

export function setTutorToken(token: string): void {
  currentToken = token;
  if (expiryTimer) clearTimeout(expiryTimer);
  expiryTimer = setTimeout(() => {
    void clearTutorToken();
  }, TUTOR_SESSION_MAX_MS);
}

export function getTutorToken(): string | undefined {
  return currentToken ?? undefined;
}

export async function clearTutorToken(): Promise<void> {
  currentToken = null;
  if (expiryTimer) {
    clearTimeout(expiryTimer);
    expiryTimer = null;
  }
  await endTutorSession();
}
