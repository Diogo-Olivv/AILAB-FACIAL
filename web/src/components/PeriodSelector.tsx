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
    <div className="space-y-3 rounded-2xl border border-navy/15 bg-navy/[0.03] p-4 backdrop-blur-xs transition-all duration-200 hover:border-navy/25">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {KEYS.map((key) => (
            <button
              key={key}
              onClick={() => onPeriod(key)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 active:scale-95 ${
                period === key
                  ? "bg-navy text-white shadow-md ring-2 ring-navy/20"
                  : "border border-line bg-card text-muted hover:border-navy/30 hover:bg-white hover:text-ink shadow-2xs"
              }`}
            >
              {PERIOD_LABELS[key]}
            </button>
          ))}
        </div>
        <span className="whitespace-nowrap rounded-full border border-navy/20 bg-card px-3.5 py-1.5 text-xs font-semibold text-navy shadow-2xs">
          📅 {formatRange(range)}
        </span>
      </div>

      {period === "custom" && (
        <div className="animate-slide-down flex flex-wrap items-center gap-3 pt-1 text-sm text-muted">
          <label className="flex items-center gap-2 font-medium">
            De:
            <input
              type="date"
              value={customFrom}
              max={customTo || undefined}
              onChange={(e) => onCustomFrom(e.target.value)}
              className="rounded-xl border border-line bg-card px-3 py-1.5 text-ink shadow-2xs outline-none transition focus:border-navy focus:ring-2 focus:ring-navy/20"
            />
          </label>
          <label className="flex items-center gap-2 font-medium">
            Até:
            <input
              type="date"
              value={customTo}
              min={customFrom || undefined}
              onChange={(e) => onCustomTo(e.target.value)}
              className="rounded-xl border border-line bg-card px-3 py-1.5 text-ink shadow-2xs outline-none transition focus:border-navy focus:ring-2 focus:ring-navy/20"
            />
          </label>
        </div>
      )}
    </div>
  );
}
