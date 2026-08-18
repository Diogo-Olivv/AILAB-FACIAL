import type { PeriodKey } from "../lib/period";
import { PERIOD_LABELS } from "../lib/period";

const KEYS: PeriodKey[] = ["day", "week", "month", "custom"];

interface Props {
  period: PeriodKey;
  customFrom: string;
  customTo: string;
  onPeriod: (period: PeriodKey) => void;
  onCustomFrom: (value: string) => void;
  onCustomTo: (value: string) => void;
}

export function PeriodSelector({
  period,
  customFrom,
  customTo,
  onPeriod,
  onCustomFrom,
  onCustomTo,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {KEYS.map((key) => (
          <button
            key={key}
            onClick={() => onPeriod(key)}
            className={`rounded-full px-4 py-2 text-sm transition ${
              period === key
                ? "bg-navy text-white"
                : "border border-line bg-card text-muted hover:text-ink"
            }`}
          >
            {PERIOD_LABELS[key]}
          </button>
        ))}
      </div>

      {period === "custom" && (
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
          <label className="flex items-center gap-2">
            De
            <input
              type="date"
              value={customFrom}
              onChange={(e) => onCustomFrom(e.target.value)}
              className="rounded-lg border border-line bg-white px-3 py-2 text-ink outline-none focus:ring-2 focus:ring-navy"
            />
          </label>
          <label className="flex items-center gap-2">
            Ate
            <input
              type="date"
              value={customTo}
              onChange={(e) => onCustomTo(e.target.value)}
              className="rounded-lg border border-line bg-white px-3 py-2 text-ink outline-none focus:ring-2 focus:ring-navy"
            />
          </label>
        </div>
      )}
    </div>
  );
}
