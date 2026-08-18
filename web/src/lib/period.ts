import type { DateRange } from "./reports";

export type PeriodKey = "day" | "week" | "month" | "custom";

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  day: "Hoje",
  week: "Esta semana",
  month: "Este mes",
  custom: "Periodo",
};

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

  return {
    from: startOfDay(fromDateInput(customFrom, now)),
    to: endOfDay(fromDateInput(customTo, now)),
  };
}
