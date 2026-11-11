/**
 * Decisões de identidade do totem, sem dependência de React Native, para poderem
 * ser testadas isoladamente (mobile/lib/kioskAuth.test.ts).
 */

/** Sessão mínima necessária para decidir se o dispositivo é um totem ativado. */
export interface SessionLike {
  user?: { app_metadata?: Record<string, unknown> };
}

/**
 * O dispositivo só é um totem ativado se a sessão for de uma conta com papel `kiosk`.
 *
 * Nenhuma variável de ambiente, chave embutida na build ou valor fixo conta como
 * ativação: isso fazia a tela "Totem não ativado" nunca aparecer em builds com
 * a chave compartilhada (AF-04).
 */
export function isKioskSession(session: SessionLike | null | undefined): boolean {
  return session?.user?.app_metadata?.role === "kiosk";
}

/**
 * Credencial usada nas chamadas à API: o token do tutor (quando há uma sessão de tutor
 * ativa) ou o token da conta do próprio totem. Sem nenhum dos dois, retorna `null`
 * e o chamador deve tratar como "totem não ativado". Não existe credencial de reserva.
 */
export function resolveBearerToken(
  tutorToken: string | null | undefined,
  kioskAccessToken: string | null | undefined,
): string | null {
  return tutorToken || kioskAccessToken || null;
}
