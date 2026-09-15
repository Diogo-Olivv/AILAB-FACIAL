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
    <div className="rounded-3xl border border-[#E5E2DC] bg-white/85 backdrop-blur-xl p-3 sm:p-3.5 shadow-[0_4px_20px_rgba(23,23,21,0.02)] transition-all duration-300">
      {/* Segmented Control refinado estilo Apple & Perplexity com alinhamento simétrico milimétrico */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div
          ref={containerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => setIsDragging(false)}
          className="relative w-full sm:w-[360px] h-11 rounded-2xl bg-[#FAF9F5] border border-[#E5E2DC] p-1 select-none cursor-pointer touch-none"
          role="tablist"
          aria-label="Seletor de período"
        >
          {/* Pílula branca flutuante perfeitamente centralizada e simétrica em todos os eixos */}
          <div
            className="absolute top-1 bottom-1 rounded-xl bg-white border border-[#E5E2DC]/80 shadow-2xs transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] pointer-events-none"
            style={{
              left: `calc(4px + ${activeIndex} * ((100% - 8px) / 3))`,
              width: "calc((100% - 8px) / 3)",
            }}
          />

          <div className="relative z-10 grid grid-cols-3 h-full">
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
                  className={`flex items-center justify-center px-2 text-xs sm:text-sm font-sans rounded-xl transition-colors duration-200 cursor-pointer h-full select-none ${
                    isActive ? "text-[#171715] font-semibold" : "text-[#706E6A] font-medium hover:text-[#171715]"
                  }`}
                >
                  <span>{PERIOD_LABELS[key]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Indicador de intervalo de datas com tipografia mono precisa e altura alinhada */}
        <div className="flex items-center justify-between sm:justify-end gap-2">
          <div className="h-11 inline-flex items-center gap-2 rounded-2xl border border-[#E5E2DC] bg-[#FAF9F5] px-4 py-2 text-xs text-[#171715] shadow-2xs font-mono-data">
            <span className="text-xs text-[#706E6A]">📅</span>
            <span className="font-medium text-[#171715]">{formatRange(range)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
