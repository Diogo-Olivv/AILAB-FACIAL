/**
 * Utilitários de fuso horário e calendário civil institucional (America/Sao_Paulo).
 *
 * Garante semana civil de Segunda-feira (00:00:00) a Domingo (23:59:59),
 * imune a variações de fuso horário e horário de verão do navegador.
 */

export const BRAZIL_TIMEZONE = "America/Sao_Paulo";

/**
 * Devolve os componentes YYYY, MM, DD na timezone America/Sao_Paulo.
 */
export function getSaoPauloParts(date: Date | string | number): {
  year: number;
  month: number;
  day: number;
  isoDate: string;
} {
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: BRAZIL_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const isoDate = formatter.format(d); // Formato YYYY-MM-DD
  const [yearStr, monthStr, dayStr] = isoDate.split("-");
  return {
    year: parseInt(yearStr, 10),
    month: parseInt(monthStr, 10),
    day: parseInt(dayStr, 10),
    isoDate,
  };
}

/**
 * Retorna o dia da semana ISO (1 = Segunda-feira, 7 = Domingo) em America/Sao_Paulo.
 */
export function getSaoPauloIsoDayOfWeek(date: Date | string | number): number {
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  // Intl format com weekday short
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: BRAZIL_TIMEZONE,
    weekday: "short",
  });
  const weekday = formatter.format(d);
  switch (weekday) {
    case "Mon":
      return 1;
    case "Tue":
      return 2;
    case "Wed":
      return 3;
    case "Thu":
      return 4;
    case "Fri":
      return 5;
    case "Sat":
      return 6;
    case "Sun":
      return 7;
    default:
      return 1;
  }
}

/**
 * Formata um objeto Date como YYYY-MM-DD em UTC para operações com datas de calendário.
 */
function toDateString(year: number, month: number, day: number): string {
  const m = month.toString().padStart(2, "0");
  const d = day.toString().padStart(2, "0");
  return `${year}-${m}-${d}`;
}

/**
 * Retorna a Segunda-feira (YYYY-MM-DD) da semana civil que contém a data informada.
 */
export function getMondayOfWeek(date: Date | string | number = new Date()): string {
  const { year, month, day } = getSaoPauloParts(date);
  const isoDow = getSaoPauloIsoDayOfWeek(date); // 1 = Seg, 7 = Dom
  const diffDays = isoDow - 1;

  // Usa Date UTC para aritmética pura de dias sem interferência de fuso local
  const baseDate = new Date(Date.UTC(year, month - 1, day));
  baseDate.setUTCDate(baseDate.getUTCDate() - diffDays);

  return toDateString(
    baseDate.getUTCFullYear(),
    baseDate.getUTCMonth() + 1,
    baseDate.getUTCDate()
  );
}

/**
 * Retorna o Domingo (YYYY-MM-DD) da semana civil a partir da Segunda-feira (ou qualquer data da semana).
 */
export function getSundayOfWeek(mondayOrAnyDate: string | Date): string {
  const mondayIso =
    typeof mondayOrAnyDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(mondayOrAnyDate)
      ? mondayOrAnyDate
      : getMondayOfWeek(mondayOrAnyDate);

  const [y, m, d] = mondayIso.split("-").map((v) => parseInt(v, 10));
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCDate(base.getUTCDate() + 6);

  return toDateString(
    base.getUTCFullYear(),
    base.getUTCMonth() + 1,
    base.getUTCDate()
  );
}

/**
 * Retorna os limites da semana civil: Segunda-feira e Domingo (YYYY-MM-DD).
 */
export function getWeekBoundaries(date: Date | string | number = new Date()): {
  periodStart: string; // YYYY-MM-DD (Segunda)
  periodEnd: string;   // YYYY-MM-DD (Domingo)
  label: string;       // "10/11 – 16/11/2026"
} {
  const monday = getMondayOfWeek(date);
  const sunday = getSundayOfWeek(monday);

  const [mY, mM, mD] = monday.split("-");
  const [sY, sM, sD] = sunday.split("-");

  const label =
    mY === sY
      ? `${mD}/${mM} a ${sD}/${sM}/${sY}`
      : `${mD}/${mM}/${mY} a ${sD}/${sM}/${sY}`;

  return {
    periodStart: monday,
    periodEnd: sunday,
    label,
  };
}

/**
 * Determina se a semana informada (periodStart = Segunda-feira YYYY-MM-DD) é uma semana futura.
 */
export function isFutureWeek(periodStartMonday: string, now: Date = new Date()): boolean {
  const currentMonday = getMondayOfWeek(now);
  return periodStartMonday > currentMonday;
}

/**
 * Determina se a semana informada é a semana civil em curso.
 */
export function isCurrentWeek(periodStartMonday: string, now: Date = new Date()): boolean {
  const currentMonday = getMondayOfWeek(now);
  return periodStartMonday === currentMonday;
}
