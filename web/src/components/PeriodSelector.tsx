import { createPortal } from "react-dom";
import { useRef, useState, useEffect, type PointerEvent } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import type { DateRange } from "../lib/reports";
import type { PeriodKey } from "../lib/period";
import { PERIOD_LABELS, formatRange } from "../lib/period";

const KEYS: PeriodKey[] = ["day", "week", "month"];

interface Props {
  period: PeriodKey;
  range: DateRange;
  onPeriod: (period: PeriodKey) => void;
  customFrom?: string;
  customTo?: string;
  onCustomRange?: (from: string, to: string) => void;
}

function toDateInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function PeriodSelector({
  period,
  range,
  onPeriod,
  customFrom = "",
  customTo = "",
  onCustomRange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [pickerPos, setPickerPos] = useState<{top: number; right: number}>({top: 0, right: 0});
  const [isDragging, setIsDragging] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [localFrom, setLocalFrom] = useState(customFrom || toDateInputValue(new Date()));
  const [localTo, setLocalTo] = useState(customTo || toDateInputValue(new Date()));
  const pickerRef = useRef<HTMLDivElement>(null);

  const safePeriod = period === "custom" ? "custom" : period;
  const displayIndex = period === "custom" ? -1 : Math.max(0, KEYS.indexOf(period as "day" | "week" | "month"));

  // Sync local values when external customFrom/customTo change
  useEffect(() => {
    if (customFrom) setLocalFrom(customFrom);
    if (customTo) setLocalTo(customTo);
  }, [customFrom, customTo]);

  // Close picker on click outside
  useEffect(() => {
    if (!isPickerOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      // Allow clicks inside the button itself to be handled by the button's onClick
      if (buttonRef.current && buttonRef.current.contains(e.target as Node)) return;
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setIsPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isPickerOpen]);

  useEffect(() => {
    if (!isPickerOpen) return;
    const close = () => setIsPickerOpen(false);
    window.addEventListener('scroll', close, { passive: true, capture: true });
    window.addEventListener('resize', close, { passive: true });
    return () => {
      window.removeEventListener('scroll', close, { capture: true });
      window.removeEventListener('resize', close);
    };
  }, [isPickerOpen]);

  const updateSegmentFromClientX = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const segmentIndex = Math.min(2, Math.floor((x / rect.width) * 3));
    const targetKey = KEYS[segmentIndex];
    if (targetKey && targetKey !== period) {
      onPeriod(targetKey);
      setIsPickerOpen(false);
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

  const handleApplyCustomRange = () => {
    if (!localFrom || !localTo) return;
    onPeriod("custom");
    onCustomRange?.(localFrom, localTo);
    setIsPickerOpen(false);
  };

  const handleDateDisplayClick = () => {
    if (!isPickerOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPickerPos({
        top: rect.bottom + window.scrollY + 8,
        right: window.innerWidth - rect.right,
      });
    }
    setIsPickerOpen((prev) => !prev);
  };

  return (
    <div className="rounded-3xl border border-[#E5E2DC] bg-white/85 backdrop-blur-xl p-3 sm:p-3.5 shadow-[0_4px_20px_rgba(23,23,21,0.02)] dark:border-slate-800 dark:bg-slate-900/85 dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] transition-all duration-300">
      {/* Segmented Control + Date Display */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div
          ref={containerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => setIsDragging(false)}
          className="relative w-full sm:w-[360px] h-11 rounded-2xl bg-[#FAF9F5] border border-[#E5E2DC] dark:bg-slate-800/80 dark:border-slate-700 p-1 select-none cursor-pointer touch-none"
          role="tablist"
          aria-label="Seletor de período"
        >
          {/* Pílula flutuante — só visível quando não está no modo custom */}
          {period !== "custom" && (
            <div
              className="absolute top-1 bottom-1 rounded-xl bg-white border border-[#E5E2DC]/80 shadow-2xs dark:bg-slate-900 dark:border-slate-600 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] pointer-events-none"
              style={{
                left: `calc(4px + ${displayIndex} * ((100% - 8px) / 3))`,
                width: "calc((100% - 8px) / 3)",
              }}
            />
          )}

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
                    setIsPickerOpen(false);
                  }}
                  className={`flex items-center justify-center px-2 text-xs sm:text-sm font-sans rounded-xl transition-colors duration-200 cursor-pointer h-full select-none ${
                    isActive
                      ? "text-[#171715] dark:text-slate-100 font-semibold"
                      : "text-[#706E6A] dark:text-slate-400 font-medium hover:text-[#171715] dark:hover:text-slate-200"
                  }`}
                >
                  <span>{PERIOD_LABELS[key]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Indicador de intervalo de datas — clicável para abrir o picker */}
        <div className="flex items-center justify-between sm:justify-end gap-2 relative">
          <button
            ref={buttonRef}
            type="button"
            onClick={handleDateDisplayClick}
            className={`h-11 inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-xs text-[#171715] dark:text-slate-200 shadow-2xs font-mono-data cursor-pointer transition-all duration-200 select-none ${
              period === "custom"
                ? "border-[#C15F3D]/50 bg-[#FAF5F0] dark:border-amber-600/50 dark:bg-amber-950/30 ring-2 ring-[#C15F3D]/15 dark:ring-amber-600/15"
                : "border-[#E5E2DC] bg-[#FAF9F5] dark:border-slate-700 dark:bg-slate-800/80 hover:border-[#C15F3D]/40 hover:bg-white dark:hover:bg-slate-800"
            }`}
            aria-label="Selecionar período personalizado"
            aria-expanded={isPickerOpen}
            title="Clique para selecionar um intervalo de datas personalizado"
          >
            <CalendarDays className="h-3.5 w-3.5 text-[#706E6A] dark:text-slate-400 shrink-0" />
            <span className="font-medium text-[#171715] dark:text-slate-200">{formatRange(range)}</span>
            {period === "custom" && (
              <span className="text-2xs font-sans font-semibold text-[#C15F3D] dark:text-amber-400 uppercase tracking-wide">
                Personalizado
              </span>
            )}
            <ChevronDown className={`h-3 w-3 text-[#706E6A] dark:text-slate-400 transition-transform duration-200 ${isPickerOpen ? "rotate-180" : ""}`} />
          </button>

          {/* Dropdown do Date-Range Picker */}
          {isPickerOpen && typeof document !== 'undefined' && createPortal(
            <div
              ref={pickerRef}
              style={{
                position: 'fixed',
                top: pickerPos.top,
                right: pickerPos.right,
                zIndex: 9999,
              }}
              className="w-72 rounded-2xl border border-[#E5E2DC] dark:border-slate-700 bg-white dark:bg-slate-900 shadow-[0_8px_32px_rgba(23,23,21,0.12)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-4 animate-fade-in"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-editorial font-semibold text-[#171715] dark:text-slate-100">
                  Período personalizado
                </span>
              </div>

              <div className="space-y-2.5">
                {/* De */}
                <div>
                  <label className="block text-2xs font-sans font-semibold uppercase tracking-wider text-[#706E6A] dark:text-slate-400 mb-1">
                    De
                  </label>
                  <input
                    type="date"
                    value={localFrom}
                    max={localTo || toDateInputValue(new Date())}
                    onChange={(e) => setLocalFrom(e.target.value)}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="w-full rounded-xl border border-[#E5E2DC] dark:border-slate-700 bg-[#FAF9F5] dark:bg-slate-800 px-3 py-2 text-sm font-mono-data text-[#171715] dark:text-slate-100 focus:border-[#C15F3D] focus:outline-none focus:ring-2 focus:ring-[#C15F3D]/15 transition-all cursor-pointer"
                  />
                </div>

                {/* Até */}
                <div>
                  <label className="block text-2xs font-sans font-semibold uppercase tracking-wider text-[#706E6A] dark:text-slate-400 mb-1">
                    Até
                  </label>
                  <input
                    type="date"
                    value={localTo}
                    min={localFrom}
                    max={toDateInputValue(new Date())}
                    onChange={(e) => setLocalTo(e.target.value)}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="w-full rounded-xl border border-[#E5E2DC] dark:border-slate-700 bg-[#FAF9F5] dark:bg-slate-800 px-3 py-2 text-sm font-mono-data text-[#171715] dark:text-slate-100 focus:border-[#C15F3D] focus:outline-none focus:ring-2 focus:ring-[#C15F3D]/15 transition-all cursor-pointer"
                  />
                </div>
              </div>

              {/* Atalhos rápidos */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {[
                  { label: "Últimos 7 dias", days: 7 },
                  { label: "Últimos 30 dias", days: 30 },
                  { label: "Últimos 90 dias", days: 90 },
                ].map(({ label, days }) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => {
                      const to = new Date();
                      const from = new Date();
                      from.setDate(from.getDate() - days);
                      setLocalFrom(toDateInputValue(from));
                      setLocalTo(toDateInputValue(to));
                    }}
                    className="rounded-lg border border-[#E5E2DC] dark:border-slate-700 bg-[#FAF9F5] dark:bg-slate-800 px-2.5 py-1 text-2xs font-sans font-medium text-[#706E6A] dark:text-slate-300 hover:border-[#C15F3D]/40 hover:text-[#C15F3D] dark:hover:text-amber-400 transition-colors cursor-pointer"
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Botões de ação */}
              <div className="mt-3.5 flex items-center gap-2 pt-3 border-t border-[#E5E2DC] dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsPickerOpen(false)}
                  className="flex-1 rounded-xl border border-[#E5E2DC] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-sans font-medium text-[#706E6A] dark:text-slate-300 hover:bg-[#FAF9F5] dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleApplyCustomRange}
                  disabled={!localFrom || !localTo}
                  className="flex-1 rounded-xl bg-[#171715] dark:bg-white hover:bg-[#2A2925] dark:hover:bg-slate-100 px-3 py-2 text-xs font-sans font-medium text-white dark:text-slate-900 shadow-sm transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Aplicar
                </button>
              </div>
            </div>,
            document.body
          )}
        </div>
      </div>
    </div>
  );
}
