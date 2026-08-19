import type { DateRange } from "./reports";

export type PeriodKey = "day" | "week" | "month" | "custom";

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  day: "Hoje",
  week: "Esta semana",
  month: "Este mês",
  custom: "Período",
};

function formatDay(date: Date): string {
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function formatRange(range: DateRange): string {
  const from = formatDay(range.from);
  const to = formatDay(range.to);
  return from === to ? from : `${from} a ${to}`;
}

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

function fromDateInput(value: string, fallback: Date): Date {
  return value ? new Date(`${value}T00:00:00`) : fallback;
}

export function rangeFor(key: PeriodKey, customFrom = "", customTo = ""): DateRange {
  const now = new Date();

  if (key === "day") {
    return { from: startOfDay(now), to: endOfDay(now) };
  }

  if (key === "week") {
    const mondayOffset = (now.getDay() + 6) % 7;
    const from = startOfDay(now);
    from.setDate(from.getDate() - mondayOffset);
    return { from, to: endOfDay(now) };
  }

  if (key === "month") {
    const from = startOfDay(now);
    from.setDate(1);
    return { from, to: endOfDay(now) };
  }

  const from = startOfDay(fromDateInput(customFrom, now));
  const to = endOfDay(fromDateInput(customTo, now));
  if (from > to) {
    return { from: startOfDay(to), to: endOfDay(from) };
  }
  return { from, to };
}
