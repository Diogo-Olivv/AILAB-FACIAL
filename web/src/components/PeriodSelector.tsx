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

  const applyDaysPreset = (daysAgo: number) => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - daysAgo);
    onCustomFrom(from.toISOString().split("T")[0]);
    onCustomTo(to.toISOString().split("T")[0]);
  };

  const applyThisMonthPreset = () => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    onCustomFrom(from.toISOString().split("T")[0]);
    onCustomTo(now.toISOString().split("T")[0]);
  };

  return (
    <div className="glass-panel space-y-3.5 rounded-3xl p-3.5 sm:p-4 transition-all duration-300 hover:shadow-apple-hover">
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
          <span className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.06] bg-black/[0.03] px-3 py-1 text-xs font-semibold text-ink/80 shadow-2xs">
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
              : "Personalizado"}
          </span>
        </div>
      </div>

      {/* Cápsula Liquid Glass para seleção de período personalizado */}
      {period === "custom" && (
        <div className="animate-slide-down pt-3 border-t border-black/[0.05] space-y-2.5">
          {/* Presets Rápidos de 1 Toque estilo Apple */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5 text-2xs sm:text-xs">
              <span className="font-semibold text-muted mr-1 hidden sm:inline">Atalhos:</span>
              <button
                type="button"
                onClick={() => applyDaysPreset(7)}
                className="liquid-glass-button rounded-xl px-2.5 py-1 text-2xs sm:text-xs font-semibold text-ink hover:text-navy cursor-pointer"
              >
                Últimos 7 dias
              </button>
              <button
                type="button"
                onClick={() => applyDaysPreset(30)}
                className="liquid-glass-button rounded-xl px-2.5 py-1 text-2xs sm:text-xs font-semibold text-ink hover:text-navy cursor-pointer"
              >
                Últimos 30 dias
              </button>
              <button
                type="button"
                onClick={applyThisMonthPreset}
                className="liquid-glass-button rounded-xl px-2.5 py-1 text-2xs sm:text-xs font-semibold text-ink hover:text-navy cursor-pointer"
              >
                Mês Atual
              </button>
            </div>

            {(customFrom || customTo) && (
              <button
                type="button"
                onClick={() => {
                  onCustomFrom("");
                  onCustomTo("");
                }}
                className="text-2xs font-semibold text-muted hover:text-warn transition-colors cursor-pointer"
              >
                ✕ Limpar datas
              </button>
            )}
          </div>

          {/* Cápsula de Intervalo Conectada (Liquid Glass Capsule) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Campo Inicial (De) */}
            <div className="flex items-center gap-2 rounded-2xl border border-white/80 bg-white/70 backdrop-blur-md px-3 py-2 shadow-2xs focus-within:ring-2 focus-within:ring-navy/20 focus-within:bg-white focus-within:border-navy/30 transition-all">
              <span className="text-xs font-bold text-muted uppercase tracking-wider shrink-0">De:</span>
              <input
                type="date"
                value={customFrom}
                max={customTo || undefined}
                onChange={(e) => onCustomFrom(e.target.value)}
                className="w-full bg-transparent text-xs sm:text-sm font-semibold text-ink outline-none cursor-pointer"
                aria-label="Data inicial"
              />
            </div>

            {/* Campo Final (Até) */}
            <div className="flex items-center gap-2 rounded-2xl border border-white/80 bg-white/70 backdrop-blur-md px-3 py-2 shadow-2xs focus-within:ring-2 focus-within:ring-navy/20 focus-within:bg-white focus-within:border-navy/30 transition-all">
              <span className="text-xs font-bold text-muted uppercase tracking-wider shrink-0">Até:</span>
              <input
                type="date"
                value={customTo}
                min={customFrom || undefined}
                onChange={(e) => onCustomTo(e.target.value)}
                className="w-full bg-transparent text-xs sm:text-sm font-semibold text-ink outline-none cursor-pointer"
                aria-label="Data final"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
