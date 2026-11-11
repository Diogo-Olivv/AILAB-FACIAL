/**
 * Decisões puras de autenticação do painel (sem React, sem rede).
 *
 * Regras:
 * - O papel de tutor vem somente de `app_metadata`, que só o servidor escreve.
 *   `user_metadata` é editável pelo próprio usuário e nunca concede acesso.
 * - Nenhuma senha, sessão ou credencial é gravada por esta aplicação em
 *   localStorage. A sessão persistida é a do próprio cliente Supabase.
 */

/** Chaves antigas, gravadas por versões anteriores com sessão forjada e senha em texto claro. */
export const LEGACY_AUTH_STORAGE_KEYS = [
  "ailab_tutor_session",
  "ailab_custom_tutor_credentials",
] as const;

export interface RoleCarrier {
  user?: { app_metadata?: Record<string, unknown> | null } | null;
}

export function isTutorSession(session: RoleCarrier | null | undefined): boolean {
  return session?.user?.app_metadata?.role === "tutor";
}

export interface NormalizedCredentials {
  email: string;
  password: string;
}

/**
 * Aceita `(email, senha)` ou `(senha, email)`; sem e-mail, usa o padrão informado.
 * A senha nunca é alterada (sem trim).
 */
export function normalizeCredentials(
  arg1: string,
  arg2: string | undefined,
  defaultEmail: string
): NormalizedCredentials {
  if (arg1.includes("@")) {
    return { email: arg1.trim().toLowerCase(), password: arg2 ?? "" };
  }
  if (arg2 && arg2.includes("@")) {
    return { email: arg2.trim().toLowerCase(), password: arg1 };
  }
  return { email: defaultEmail.trim().toLowerCase(), password: arg1 };
}

export interface StorageLike {
  removeItem(key: string): void;
}

/** Apaga as chaves antigas. Falhas de armazenamento são ignoradas (modo privado, bloqueio). */
export function purgeLegacyAuthStorage(storage: StorageLike | null | undefined): void {
  if (!storage) return;
  for (const key of LEGACY_AUTH_STORAGE_KEYS) {
    try {
      storage.removeItem(key);
    } catch {
      // armazenamento indisponível: nada a limpar
    }
  }
}

const AVATAR_DATA_URL = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

/**
 * Valida a URL de avatar antes de usá-la em `<img src>`.
 * Aceita imagem em data URL (png/jpeg/webp em base64) ou https. Todo o resto vira null.
 */
export function safeAvatarUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const url = value.trim();
  if (!url) return null;
  if (url.startsWith("data:")) {
    return AVATAR_DATA_URL.test(url) ? url : null;
  }
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}
