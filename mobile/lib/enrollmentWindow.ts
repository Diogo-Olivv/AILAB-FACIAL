/**
 * Utilitário de janela cadastral temporária (AILAB-FACIAL)
 *
 * Entre 28/09/2026 00:00:00 e 02/10/2026 23:59:59 (America/Sao_Paulo, GMT-3)
 * o recadastro facial pode ser realizado sem autenticação de tutor.
 *
 * ATENÇÃO: Este módulo é UX apenas — a validação real de segurança está no backend.
 * Nunca use esta função como controle de acesso definitivo no cliente.
 */

/** Início da janela cadastral (ISO 8601 com offset -03:00) */
const WINDOW_START = new Date("2026-09-28T00:00:00-03:00");
/** Fim da janela cadastral (ISO 8601 com offset -03:00) */
const WINDOW_END = new Date("2026-10-02T23:59:59-03:00");

/**
 * Retorna `true` se o momento atual estiver dentro da janela cadastral.
 *
 * O JavaScript Date compara em UTC internamente, então o offset -03:00
 * já está incorporado nas constantes acima — nenhuma conversão manual necessária.
 */
export function isEnrollmentWindowActive(): boolean {
  const now = new Date();
  return now >= WINDOW_START && now <= WINDOW_END;
}

/** Metadados da janela para exibição de badges e logs */
export interface EnrollmentWindowInfo {
  active: boolean;
  windowStart: string;
  windowEnd: string;
}

export function getEnrollmentWindowInfo(): EnrollmentWindowInfo {
  return {
    active: isEnrollmentWindowActive(),
    windowStart: WINDOW_START.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
    windowEnd: WINDOW_END.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
  };
}
