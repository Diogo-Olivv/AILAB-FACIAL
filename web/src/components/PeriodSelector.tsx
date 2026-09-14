import { useRef, useState, type PointerEvent } from "react";
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const activeIndex = Math.max(0, KEYS.indexOf(period));

  const updateSegmentFromClientX = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const segmentIndex = Math.min(3, Math.floor((x / rect.width) * 4));
    const targetKey = KEYS[segmentIndex];
    if (targetKey && targetKey !== period) {
      onPeriod(targetKey);
    }
  };

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    setIsDragging(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignora caso não suporte pointer capture
    }
    updateSegmentFromClientX(e.clientX);
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    updateSegmentFromClientX(e.clientX);
  };

  const handlePointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      setIsDragging(false);
      updateSegmentFromClientX(e.clientX);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Ignora
      }
    }
  };

  return (
    <div className="space-y-3 rounded-3xl border border-black/[0.06] bg-white p-3.5 sm:p-4 shadow-apple transition-all duration-300 hover:shadow-apple-hover">
      {/* Apple-style Segmented Control com deslizamento e arrasto */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div
          ref={containerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => setIsDragging(false)}
          className="relative grid grid-cols-4 w-full sm:w-[420px] rounded-2xl bg-black/[0.05] p-1 select-none cursor-pointer touch-none"
          role="tablist"
          aria-label="Seletor de período"
        >
          {/* Pílula branca flutuante estilo Apple com mola e arrasto suave */}
          <div
            className="absolute top-1 bottom-1 rounded-xl bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] pointer-events-none"
            style={{
              width: "calc(25% - 2px)",
              transform: `translateX(${activeIndex * 100}%)`,
              left: "1px",
            }}
          />

          {KEYS.map((key) => {
            const isActive = period === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={(e) => {
                  e.stopPropagation();
                  onPeriod(key);
                }}
                className={`relative z-10 flex items-center justify-center py-2 px-1 text-xs sm:text-sm font-semibold rounded-xl transition-colors duration-200 cursor-pointer min-h-[38px] ${
                  isActive ? "text-ink font-bold" : "text-muted hover:text-ink"
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
          <span className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.06] bg-black/[0.02] px-3 py-1 text-xs font-semibold text-ink/80 shadow-2xs">
            <span>📅</span>
            <span>{formatRange(range)}</span>
          </span>
          <span className="text-2xs font-semibold text-muted uppercase tracking-wider hidden sm:inline">
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
        <div className="animate-slide-down grid grid-cols-2 gap-3 pt-2.5 border-t border-black/[0.05]">
          <div className="space-y-1">
            <label className="text-2xs font-bold text-muted uppercase tracking-wider block">
              Data Inicial (De)
            </label>
            <input
              type="date"
              value={customFrom}
              max={customTo || undefined}
              onChange={(e) => onCustomFrom(e.target.value)}
              className="w-full rounded-2xl border border-black/[0.08] bg-white px-3 py-2 text-xs sm:text-sm text-ink outline-none focus:border-navy focus:ring-2 focus:ring-navy/15 shadow-2xs transition-all"
            />
          </div>
          <div className="space-y-1">
            <label className="text-2xs font-bold text-muted uppercase tracking-wider block">
              Data Final (Até)
            </label>
            <input
              type="date"
              value={customTo}
              min={customFrom || undefined}
              onChange={(e) => onCustomTo(e.target.value)}
              className="w-full rounded-2xl border border-black/[0.08] bg-white px-3 py-2 text-xs sm:text-sm text-ink outline-none focus:border-navy focus:ring-2 focus:ring-navy/15 shadow-2xs transition-all"
            />
          </div>
        </div>
      )}
    </div>
  );
}
