export const VIEWER_EMAIL = (import.meta.env.VITE_VIEWER_EMAIL ?? "").toLowerCase();

function parseCapacity(raw: unknown): number | null {
  const value = Number.parseInt(String(raw ?? ""), 10);
  return Number.isInteger(value) && value > 0 ? value : null;
}

/**
 * Capacidade real do laboratório (pessoas), definida por VITE_LAB_CAPACITY.
 * Sem esse valor a lotação NÃO é classificada: o painel mostra só a contagem.
 */
export const LAB_CAPACITY: number | null = parseCapacity(import.meta.env.VITE_LAB_CAPACITY);
