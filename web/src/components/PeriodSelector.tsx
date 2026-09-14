import type { DateRange } from "../lib/reports";
import type { PeriodKey } from "../lib/period";
import { PERIOD_LABELS, formatRange } from "../lib/period";

const KEYS: PeriodKey[] = ["day", "week", "month", "custom"];

interface Props {
  period: PeriodKey;
  range: DateRange;
  customFrom: string;
  customTo: string;
  onPeriod: (period: PeriodKey) => void;
  onCustomFrom: (value: string) => void;
  onCustomTo: (value: string) => void;
}

export function PeriodSelector({
  period,
  range,
  customFrom,
  customTo,
  onPeriod,
  onCustomFrom,
  onCustomTo,
}: Props) {
  return (
    <div className="space-y-2.5 rounded-2xl border border-line/80 bg-card p-3 sm:p-4 shadow-2xs transition-all hover:border-navy/20">
      {/* Segmented Control de 4 opções sem quebra */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="grid grid-cols-4 w-full sm:w-auto rounded-xl bg-navy/[0.04] p-1 border border-line/60 gap-1">
          {KEYS.map((key) => {
            const isActive = period === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onPeriod(key)}
                className={`flex items-center justify-center py-2 px-1.5 sm:px-4 text-xs sm:text-sm font-semibold rounded-lg transition-all active:scale-95 cursor-pointer min-h-[38px] ${
                  isActive
                    ? "bg-navy text-white shadow-xs font-bold"
                    : "text-muted hover:text-ink hover:bg-white/60"
                }`}
              >
                <span className="sm:hidden">
                  {key === "week" ? "Semana" : key === "month" ? "Mês" : PERIOD_LABELS[key]}
                </span>
                <span className="hidden sm:inline">
                  {PERIOD_LABELS[key]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Indicador elegante de intervalo de datas ativo */}
        <div className="flex items-center justify-between sm:justify-end gap-2 px-1 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-navy/15 bg-navy/[0.03] px-2.5 py-1 text-xs font-bold text-navy shadow-2xs">
            <span>📅</span>
            <span>{formatRange(range)}</span>
          </span>
          <span className="text-2xs font-semibold text-muted/70 uppercase tracking-wider hidden sm:inline">
            {period === "day"
              ? "Hoje"
              : period === "week"
              ? "Semana Corrente"
              : period === "month"
              ? "Mês Corrente"
              : "Intervalo Personalizado"}
          </span>
        </div>
      </div>

      {/* Painel expansível para período personalizado */}
      {period === "custom" && (
        <div className="animate-slide-down grid grid-cols-2 gap-2.5 pt-2 border-t border-line/50">
          <div className="space-y-1">
            <label className="text-2xs font-bold text-ink uppercase tracking-wider block">
              Data Inicial (De)
            </label>
            <input
              type="date"
              value={customFrom}
              max={customTo || undefined}
              onChange={(e) => onCustomFrom(e.target.value)}
              className="w-full rounded-xl border border-line bg-white px-3 py-2 text-xs sm:text-sm text-ink outline-none focus:border-navy focus:ring-2 focus:ring-navy/20 shadow-2xs"
            />
          </div>
          <div className="space-y-1">
            <label className="text-2xs font-bold text-ink uppercase tracking-wider block">
              Data Final (Até)
            </label>
            <input
              type="date"
              value={customTo}
              min={customFrom || undefined}
              onChange={(e) => onCustomTo(e.target.value)}
              className="w-full rounded-xl border border-line bg-white px-3 py-2 text-xs sm:text-sm text-ink outline-none focus:border-navy focus:ring-2 focus:ring-navy/20 shadow-2xs"
            />
          </div>
        </div>
      )}
    </div>
  );
}
