import { useRef, useState, type PointerEvent } from "react";
import type { DateRange } from "../lib/reports";
import type { PeriodKey } from "../lib/period";
import { PERIOD_LABELS, formatRange } from "../lib/period";

const KEYS: PeriodKey[] = ["day", "week", "month"];

interface Props {
  period: PeriodKey;
  range: DateRange;
  onPeriod: (period: PeriodKey) => void;
}

export function PeriodSelector({
  period,
  range,
  onPeriod,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const safePeriod = period === "custom" ? "week" : period;
  const activeIndex = Math.max(0, KEYS.indexOf(safePeriod));

  const updateSegmentFromClientX = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const segmentIndex = Math.min(2, Math.floor((x / rect.width) * 3));
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
    <div className="glass-panel space-y-3.5 rounded-3xl p-3.5 sm:p-4 transition-all duration-300 hover:shadow-apple-hover">
      {/* Apple-style Segmented Control com deslizamento suave (3 opções) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div
          ref={containerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => setIsDragging(false)}
          className="relative grid grid-cols-3 w-full sm:w-[320px] rounded-2xl bg-black/[0.05] p-1 select-none cursor-pointer touch-none shadow-inner"
          role="tablist"
          aria-label="Seletor de período"
        >
          {/* Pílula branca flutuante estilo Apple com física de mola */}
          <div
            className="absolute top-1 bottom-1 rounded-xl bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] pointer-events-none"
            style={{
              width: "calc(33.333% - 2px)",
              transform: `translateX(${activeIndex * 100}%)`,
              left: "1px",
            }}
          />

          {KEYS.map((key) => {
            const isActive = safePeriod === key;
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
                className={`relative z-10 flex items-center justify-center py-2 px-2 text-xs sm:text-sm font-semibold rounded-xl transition-colors duration-200 cursor-pointer min-h-[38px] ${
                  isActive ? "text-slate-900 font-bold" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <span>{PERIOD_LABELS[key]}</span>
              </button>
            );
          })}
        </div>

        {/* Indicador elegante de intervalo de datas ativo */}
        <div className="flex items-center justify-between sm:justify-end gap-2 px-1 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.06] bg-black/[0.03] px-3.5 py-1 text-xs font-semibold text-slate-800 shadow-2xs">
            <span>📅</span>
            <span>{formatRange(range)}</span>
          </span>
          <span className="text-2xs font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">
            {safePeriod === "day"
              ? "Hoje"
              : safePeriod === "week"
              ? "Semana Corrente"
              : "Mês Corrente"}
          </span>
        </div>
      </div>
    </div>
  );
}
