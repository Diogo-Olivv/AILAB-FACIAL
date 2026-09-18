import type { SessionRecord } from "./reports";

/**
 * Lógica pura (sem Supabase) do registro manual de presença pelo tutor.
 * Usada como contingência quando a internet cai e os integrantes assinam a
 * lista de papel: depois o tutor lança dia, hora de entrada e hora de saída.
 * Mantida separada da camada de dados para permitir teste isolado.
 */

export interface ManualSessionInput {
  profileId: string;
  /** "YYYY-MM-DD" vindo de <input type="date"> */
  date: string;
  /** "HH:mm" vindo de <input type="time"> */
  entryTime: string;
  /** "HH:mm" vindo de <input type="time"> */
  exitTime: string;
}

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

/**
 * Combina data (YYYY-MM-DD) e hora local (HH:mm) num timestamp ISO em UTC,
 * do mesmo formato gravado pelo backend (register_event grava UTC ISO).
 * O construtor de Date interpreta a string sem fuso como horário local, e
 * toISOString() converte para UTC.
 */
export function combineDateTime(dateStr: string, timeStr: string): string {
  return new Date(`${dateStr}T${timeStr}:00`).toISOString();
}

/**
 * Valida os campos do formulário de registro manual.
 * Exige integrante, data e horas preenchidos, entrada estritamente antes da
 * saída, e proíbe data no futuro.
 */
export function validateManualSession(
  input: ManualSessionInput,
  now: Date = new Date()
): ValidationResult {
  const { profileId, date, entryTime, exitTime } = input;

  if (!profileId) {
    return { ok: false, error: "Selecione um integrante." };
  }
  if (!date) {
    return { ok: false, error: "Informe a data do registro." };
  }
  if (!entryTime || !exitTime) {
    return { ok: false, error: "Informe a hora de entrada e a hora de saída." };
  }

  const checkIn = new Date(`${date}T${entryTime}:00`);
  const checkOut = new Date(`${date}T${exitTime}:00`);

  if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime())) {
    return { ok: false, error: "Data ou horário inválido." };
  }

  if (checkIn.getTime() >= checkOut.getTime()) {
    return { ok: false, error: "A hora de entrada deve ser anterior à hora de saída." };
  }

  if (checkOut.getTime() > now.getTime()) {
    return { ok: false, error: "Não é possível registrar presença no futuro." };
  }

  return { ok: true };
}

/**
 * Detecta se o intervalo candidato [checkIn, checkOut) sobrepõe alguma sessão
 * existente do integrante. Sessões anuladas (voidedAt) são ignoradas; sessões
 * abertas (checkOut nulo) são tratadas como em andamento a partir do check_in.
 * Intervalos apenas encostados (fim == início) não contam como sobreposição.
 */
export function overlaps(
  candidate: { checkIn: string; checkOut: string },
  existing: SessionRecord[]
): boolean {
  const candStart = new Date(candidate.checkIn).getTime();
  const candEnd = new Date(candidate.checkOut).getTime();

  return existing.some((s) => {
    if (s.voidedAt != null) return false;
    const start = new Date(s.checkIn).getTime();
    const end = s.checkOut != null ? new Date(s.checkOut).getTime() : Infinity;
    return candStart < end && start < candEnd;
  });
}
