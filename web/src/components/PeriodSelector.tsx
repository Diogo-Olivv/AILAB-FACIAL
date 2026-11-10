import { useRef, useState, useEffect, useMemo, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import {
  CalendarDays,
  CalendarRange,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
} from "lucide-react";
import type { DateRange } from "../lib/reports";
import { formatRange } from "../lib/period";

const PERIOD_LABELS: Record<"day" | "week" | "month", string> = {
  day: "Hoje",
  week: "Semana",
  month: "Mês",
};

const KEYS: ("day" | "week" | "month")[] = ["day", "week", "month"];

const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const WEEKDAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

interface Props {
  period: "day" | "week" | "month" | "total" | "custom";
  range: DateRange;
  onPeriod: (p: "day" | "week" | "month" | "total" | "custom") => void;
  customFrom?: string;
  customTo?: string;
  onCustomRange?: (from: string, to: string) => void;
}

function toDateInputValue(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateInput(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
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
  const pickerContainerRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [dragLeftPx, setDragLeftPx] = useState<number | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  // Intervalo em edição no calendário
  const [localFrom, setLocalFrom] = useState(
    customFrom || toDateInputValue(range.from)
  );
  const [localTo, setLocalTo] = useState(
    customTo || toDateInputValue(range.to)
  );
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  // Mês e Ano sendo visualizados no calendário
  const [viewYear, setViewYear] = useState(() => range.to.getFullYear());
  const [viewMonth, setViewMonth] = useState(() => range.to.getMonth());

  const safePeriod = period === "custom" ? "custom" : period;
  const displayIndex =
    period === "custom"
      ? -1
      : Math.max(0, KEYS.indexOf(period as "day" | "week" | "month"));

  const [popoverPos, setPopoverPos] = useState({ top: 0, right: 0 });

  const updatePopoverPos = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPopoverPos({
        top: rect.bottom + 8,
        right: Math.max(16, window.innerWidth - rect.right),
      });
    }
  };

  // Sincroniza valores quando customFrom / customTo externos mudarem
  useEffect(() => {
    if (customFrom) setLocalFrom(customFrom);
    if (customTo) setLocalTo(customTo);
  }, [customFrom, customTo]);

  // Fechamento seguro ao clicar fora ou pressionar Escape e reposicionamento no scroll/resize
  useEffect(() => {
    if (!isPickerOpen) return;

    const handleScrollOrResize = () => {
      updatePopoverPos();
    };

    const handlePointerDownOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (
        pickerRef.current &&
        !pickerRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setIsPickerOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsPickerOpen(false);
      }
    };

    window.addEventListener("scroll", handleScrollOrResize, { passive: true, capture: true });
    window.addEventListener("resize", handleScrollOrResize, { passive: true });
    document.addEventListener("mousedown", handlePointerDownOutside);
    document.addEventListener("touchstart", handlePointerDownOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, { capture: true });
      window.removeEventListener("resize", handleScrollOrResize);
      document.removeEventListener("mousedown", handlePointerDownOutside);
      document.removeEventListener("touchstart", handlePointerDownOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPickerOpen]);

  const handleDateDisplayClick = () => {
    if (!isPickerOpen) {
      updatePopoverPos();
      const initialFrom = customFrom || toDateInputValue(range.from);
      const initialTo = customTo || toDateInputValue(range.to);
      setLocalFrom(initialFrom);
      setLocalTo(initialTo);

      const toDate = parseDateInput(initialTo);
      setViewYear(toDate.getFullYear());
      setViewMonth(toDate.getMonth());
    }
    setIsPickerOpen((prev) => !prev);
  };

  const handleApplyCustomRange = () => {
    if (!localFrom) return;
    const end = localTo || localFrom;
    // Garante ordem cronológica
    const f = localFrom <= end ? localFrom : end;
    const t = localFrom <= end ? end : localFrom;

    onCustomRange?.(f, t);
    onPeriod("custom");
    setIsPickerOpen(false);
  };

  // Navegação de mês
  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y: number) => y - 1);
    } else {
      setViewMonth((m: number) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y: number) => y + 1);
    } else {
      setViewMonth((m: number) => m + 1);
    }
  };

  // Clique em um dia do calendário visual
  const handleDayClick = (dateStr: string) => {
    if (!localFrom || (localFrom && localTo)) {
      // Começa nova seleção
      setLocalFrom(dateStr);
      setLocalTo("");
    } else {
      // Já tem data inicial
      if (dateStr < localFrom) {
        setLocalFrom(dateStr);
        setLocalTo(localFrom);
      } else {
        setLocalTo(dateStr);
      }
    }
  };

  // Atalhos rápidos pré-configurados com aplicação instantânea
  const applyPresetAndClose = (fromStr: string, toStr: string) => {
    setLocalFrom(fromStr);
    setLocalTo(toStr);
    const toDate = parseDateInput(toStr);
    setViewYear(toDate.getFullYear());
    setViewMonth(toDate.getMonth());
    onCustomRange?.(fromStr, toStr);
    onPeriod("custom");
    setIsPickerOpen(false);
  };

  const applyPreset = (days: number) => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - (days - 1));
    applyPresetAndClose(toDateInputValue(from), toDateInputValue(to));
  };

  const applyThisMonthPreset = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    applyPresetAndClose(toDateInputValue(firstDay), toDateInputValue(now));
  };

  const applyLastWeekPreset = () => {
    const now = new Date();
    const mondayOffset = (now.getDay() + 6) % 7;
    const thisMonday = new Date(now);
    thisMonday.setDate(thisMonday.getDate() - mondayOffset);
    thisMonday.setHours(0, 0, 0, 0);

    const lastMonday = new Date(thisMonday);
    lastMonday.setDate(lastMonday.getDate() - 7);

    const lastFriday = new Date(lastMonday);
    lastFriday.setDate(lastFriday.getDate() + 4);

    applyPresetAndClose(toDateInputValue(lastMonday), toDateInputValue(lastFriday));
  };

  const applyLastMonthPreset = () => {
    const now = new Date();
    const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    applyPresetAndClose(toDateInputValue(firstOfLastMonth), toDateInputValue(lastOfLastMonth));
  };

  // Segmented control drag/click com threshold de sensibilidade e atualização em tempo real
  const dragRef = useRef<{
    startX: number;
    startY: number;
    initialLeft: number;
    pointerId: number;
    isDragging: boolean;
  } | null>(null);
  const justDraggedRef = useRef(false);

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const padding = 4;
    const usableWidth = Math.max(rect.width - padding * 2, 1);
    const pillWidth = usableWidth / 3;
    const maxLeft = usableWidth - pillWidth;

    const currentDisplayIndex =
      period === "custom"
        ? 0
        : Math.max(0, KEYS.indexOf(period as "day" | "week" | "month"));
    const currentPillLeft = currentDisplayIndex * pillWidth;

    const touchX = e.clientX - rect.left - padding;
    const isTouchNearPill =
      period !== "custom" &&
      touchX >= currentPillLeft - 12 &&
      touchX <= currentPillLeft + pillWidth + 12;

    const initialLeft = isTouchNearPill
      ? currentPillLeft
      : Math.max(0, Math.min(touchX - pillWidth / 2, maxLeft));

    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialLeft,
      pointerId: e.pointerId,
      isDragging: false,
    };
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || !containerRef.current) return;

    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;

    // Threshold de sensibilidade para evitar arrastes acidentais em toques ou rolagem vertical
    if (!drag.isDragging) {
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 7) {
        // Usuário está rolando verticalmente a página, cancela detecção de arraste
        dragRef.current = null;
        return;
      }
      if (Math.abs(dx) >= 7) {
        drag.isDragging = true;
        setIsDragging(true);
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // Ignora caso navegador não suporte pointer capture
        }
      } else {
        return;
      }
    }

    const rect = containerRef.current.getBoundingClientRect();
    const padding = 4;
    const usableWidth = Math.max(rect.width - padding * 2, 1);
    const pillWidth = usableWidth / 3;
    const maxLeft = usableWidth - pillWidth;

    const currentLeft = Math.max(0, Math.min(drag.initialLeft + dx, maxLeft));
    setDragLeftPx(currentLeft);

    // ATUALIZAÇÃO IMEDIATA DURANTE O ARRASTE:
    // Conforme a pílula entra no novo segmento, já seleciona o período e dispara a atualização dos dados
    const nearestIndex = Math.min(2, Math.max(0, Math.round(currentLeft / pillWidth)));
    const targetKey = KEYS[nearestIndex];
    if (targetKey && targetKey !== period) {
      onPeriod(targetKey);
      setIsPickerOpen(false);
    }
  };

  const handlePointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag?.isDragging) {
      justDraggedRef.current = true;
      setTimeout(() => {
        justDraggedRef.current = false;
      }, 50);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Ignora
      }
      setIsDragging(false);
      setDragLeftPx(null);
    }
    dragRef.current = null;
  };

  const handlePointerCancel = (e: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag?.isDragging) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Ignora
      }
      setIsDragging(false);
      setDragLeftPx(null);
    }
    dragRef.current = null;
  };

  // Grade do calendário do mês visualizado
  const calendarDays = useMemo(() => {
    const totalDays = new Date(viewYear, viewMonth + 1, 0).getDate();
    const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();

    const days: { dateStr: string; dayNumber: number; isCurrentMonth: boolean }[] = [];

    // Dias do mês anterior para completar a primeira semana
    const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const prevDate = new Date(viewYear, viewMonth - 1, prevMonthDays - i);
      days.push({
        dateStr: toDateInputValue(prevDate),
        dayNumber: prevMonthDays - i,
        isCurrentMonth: false,
      });
    }

    // Dias do mês atual
    for (let day = 1; day <= totalDays; day++) {
      const d = new Date(viewYear, viewMonth, day);
      days.push({
        dateStr: toDateInputValue(d),
        dayNumber: day,
        isCurrentMonth: true,
      });
    }

    // Completa o grid até 35 ou 42 células
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const nextDate = new Date(viewYear, viewMonth + 1, i);
      days.push({
        dateStr: toDateInputValue(nextDate),
        dayNumber: i,
        isCurrentMonth: false,
      });
    }

    return days;
  }, [viewYear, viewMonth]);

  const todayStr = useMemo(() => toDateInputValue(new Date()), []);

  // Determina seleção atual efetiva para pintar o intervalo
  const effectiveEnd = localTo || hoverDate || localFrom;
  const [rangeStart, rangeEnd] = useMemo(() => {
    if (!localFrom) return ["", ""];
    if (localFrom <= effectiveEnd) {
      return [localFrom, effectiveEnd];
    }
    return [effectiveEnd, localFrom];
  }, [localFrom, effectiveEnd]);

  // Contagem de dias no intervalo selecionado
  const selectedDaysCount = useMemo(() => {
    if (!localFrom) return null;
    const end = localTo || localFrom;
    const f = parseDateInput(localFrom).getTime();
    const t = parseDateInput(end).getTime();
    const diff = Math.round(Math.abs(t - f) / (1000 * 3600 * 24)) + 1;
    return diff;
  }, [localFrom, localTo]);

  return (
    <div className="surface-card p-2.5 sm:p-3 transition-all duration-200">
      {/* Segmented Control + Date Display */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div
          ref={containerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          className="segmented-track w-full sm:w-[340px] h-11 sm:h-10 select-none cursor-grab active:cursor-grabbing touch-pan-y"
          role="tablist"
          aria-label="Seletor de período"
        >
          {/* Pílula flutuante fluida estilo iOS — só visível quando não está no modo custom */}
          {period !== "custom" && (
            <div
              className={`segmented-pill top-1 bottom-1 pointer-events-none ${
                isDragging
                  ? "transition-none scale-[1.01]"
                  : "transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
              }`}
              style={{
                left:
                  isDragging && dragLeftPx !== null
                    ? `${4 + dragLeftPx}px`
                    : `calc(4px + ${displayIndex} * ((100% - 8px) / 3))`,
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
                    if (justDraggedRef.current) return;
                    onPeriod(key);
                    setIsPickerOpen(false);
                  }}
                  className={`flex items-center justify-center px-2 text-xs font-sans rounded-lg transition-colors duration-200 cursor-pointer h-full select-none ${
                    isActive
                      ? "text-slate-900 dark:text-white font-semibold"
                      : "text-slate-500 dark:text-slate-400 font-medium hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <span>{PERIOD_LABELS[key]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Container do botão disparador e do popover ancorado */}
        <div ref={pickerContainerRef} className="relative flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            ref={buttonRef}
            type="button"
            onClick={handleDateDisplayClick}
            className={`min-h-[44px] sm:min-h-[40px] w-full sm:w-auto inline-flex items-center justify-between sm:justify-center gap-2 rounded-xl border px-3.5 py-2 text-xs text-slate-900 dark:text-slate-200 shadow-2xs font-mono-data tabular-nums cursor-pointer transition-all duration-200 select-none ${
              period === "custom"
                ? "border-orange-500/40 bg-orange-500/10 dark:border-amber-500/40 dark:bg-amber-500/10 ring-2 ring-orange-500/15"
                : "border-slate-200/90 bg-slate-100/70 dark:border-white/[0.1] dark:bg-[#161F30] hover:border-slate-300 hover:bg-white dark:hover:border-white/[0.18] dark:hover:bg-[#1E293B]"
            }`}
            aria-label="Selecionar período personalizado no calendário"
            aria-expanded={isPickerOpen}
            title="Clique para abrir o calendário e selecionar datas"
          >
            <CalendarDays className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
            <span className="font-medium text-slate-900 dark:text-slate-200">
              {formatRange(range)}
            </span>
            {period === "custom" && (
              <span className="text-2xs font-sans font-semibold text-[#C15F3D] dark:text-amber-400 uppercase tracking-wide">
                Personalizado
              </span>
            )}
            <ChevronDown
              className={`h-3 w-3 text-slate-500 dark:text-slate-400 transition-transform duration-200 ${
                isPickerOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {/* Popover com Calendário Ancorado Renderizado no Topo via createPortal */}
          {isPickerOpen && typeof document !== "undefined" && createPortal(
            <div
              ref={pickerRef}
              style={{
                position: "fixed",
                top: `${popoverPos.top}px`,
                right: `${popoverPos.right}px`,
                zIndex: 99999,
              }}
              className="w-[340px] max-w-[calc(100vw-24px)] max-h-[calc(100vh-140px)] overflow-y-auto rounded-2xl border border-slate-200/90 dark:border-white/[0.1] bg-white/95 dark:bg-[#0F1623]/95 backdrop-blur-2xl shadow-[0_24px_64px_-12px_rgba(15,23,42,0.28)] dark:shadow-[0_24px_64px_-12px_rgba(0,0,0,0.85)] p-4 sm:p-5 animate-scale-up text-slate-900 dark:text-slate-100"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Cabeçalho do Calendário */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-50 dark:bg-amber-500/10 text-[#C15F3D] dark:text-amber-400 border border-orange-200 dark:border-amber-500/30">
                    <CalendarRange className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="font-editorial text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight">
                      Selecionar Período
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-sans">
                      {localFrom
                        ? `${selectedDaysCount} ${selectedDaysCount === 1 ? "dia" : "dias"} selecionados`
                        : "Escolha as datas de início e fim"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPickerOpen(false)}
                  className="rounded-full h-7 w-7 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                  aria-label="Fechar calendário"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Atalhos Rápidos */}
              <div className="flex flex-wrap gap-1.5 pt-3 pb-2">
                <button
                  type="button"
                  onClick={() => applyPreset(1)}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1 text-[11px] font-sans font-medium text-slate-500 dark:text-slate-300 hover:border-[#C15F3D]/40 hover:text-[#C15F3D] dark:hover:text-amber-400 transition-colors cursor-pointer"
                >
                  Hoje
                </button>
                <button
                  type="button"
                  onClick={applyLastWeekPreset}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1 text-[11px] font-sans font-medium text-slate-500 dark:text-slate-300 hover:border-[#C15F3D]/40 hover:text-[#C15F3D] dark:hover:text-amber-400 transition-colors cursor-pointer"
                  title="Segunda a Sexta da semana anterior"
                >
                  Semana Passada
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset(7)}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1 text-[11px] font-sans font-medium text-slate-500 dark:text-slate-300 hover:border-[#C15F3D]/40 hover:text-[#C15F3D] dark:hover:text-amber-400 transition-colors cursor-pointer"
                >
                  7 dias
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset(15)}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1 text-[11px] font-sans font-medium text-slate-500 dark:text-slate-300 hover:border-[#C15F3D]/40 hover:text-[#C15F3D] dark:hover:text-amber-400 transition-colors cursor-pointer"
                >
                  15 dias
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset(30)}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1 text-[11px] font-sans font-medium text-slate-500 dark:text-slate-300 hover:border-[#C15F3D]/40 hover:text-[#C15F3D] dark:hover:text-amber-400 transition-colors cursor-pointer"
                >
                  30 dias
                </button>
                <button
                  type="button"
                  onClick={applyThisMonthPreset}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1 text-[11px] font-sans font-medium text-slate-500 dark:text-slate-300 hover:border-[#C15F3D]/40 hover:text-[#C15F3D] dark:hover:text-amber-400 transition-colors cursor-pointer"
                >
                  Este Mês
                </button>
                <button
                  type="button"
                  onClick={applyLastMonthPreset}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1 text-[11px] font-sans font-medium text-slate-500 dark:text-slate-300 hover:border-[#C15F3D]/40 hover:text-[#C15F3D] dark:hover:text-amber-400 transition-colors cursor-pointer"
                  title="Mês anterior completo"
                >
                  Mês Passado
                </button>
              </div>

              {/* Barra de Mês e Controles de Navegação */}
              <div className="flex items-center justify-between py-2 px-1">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-300 cursor-pointer transition-colors"
                  aria-label="Mês anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="font-sans text-xs font-bold text-slate-900 dark:text-slate-100">
                  {MONTH_NAMES[viewMonth]} {viewYear}
                </span>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-300 cursor-pointer transition-colors"
                  aria-label="Próximo mês"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              {/* Dias da Semana */}
              <div className="grid grid-cols-7 gap-1 text-center py-1 font-sans text-3xs font-semibold text-slate-400 dark:text-slate-400 uppercase tracking-wider">
                {WEEKDAY_NAMES.map((w) => (
                  <div key={w} className="py-0.5">
                    {w}
                  </div>
                ))}
              </div>

              {/* Grade dos Dias */}
              <div className="grid grid-cols-7 gap-1 text-center font-mono-data tabular-nums text-xs">
                {calendarDays.map(({ dateStr, dayNumber, isCurrentMonth }) => {
                  const isSelectedStart = dateStr === localFrom;
                  const isSelectedEnd = dateStr === localTo;
                  const isInRange =
                    rangeStart &&
                    rangeEnd &&
                    dateStr >= rangeStart &&
                    dateStr <= rangeEnd;
                  const isToday = dateStr === todayStr;

                  return (
                    <button
                      key={dateStr}
                      type="button"
                      onClick={() => handleDayClick(dateStr)}
                      onMouseEnter={() => {
                        if (localFrom && !localTo) {
                          setHoverDate(dateStr);
                        }
                      }}
                      className={`relative h-8 rounded-lg flex items-center justify-center font-medium transition-all cursor-pointer select-none ${
                        isSelectedStart || isSelectedEnd
                          ? "bg-[#C15F3D] text-white font-bold shadow-[0_2px_8px_-2px_rgba(193,95,61,0.6)] z-10"
                          : isInRange
                          ? "bg-[#C15F3D]/10 dark:bg-amber-500/15 text-[#C15F3D] dark:text-amber-300 font-semibold"
                          : isCurrentMonth
                          ? "text-slate-900 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                          : "text-slate-300 dark:text-slate-600 hover:text-slate-500"
                      }`}
                    >
                      <span>{dayNumber}</span>
                      {isToday && !isSelectedStart && !isSelectedEnd && (
                        <span className="absolute bottom-1 h-1 w-1 rounded-full bg-[#C15F3D] dark:bg-amber-400" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Faixa com Resumo de Datas e Botões de Ação */}
              <div className="mt-3.5 pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-2xs font-mono-data tabular-nums text-slate-500 dark:text-slate-400 px-0.5">
                  <div>
                    De: <strong className="text-slate-900 dark:text-slate-200">{localFrom || "—"}</strong>
                  </div>
                  <div>
                    Até: <strong className="text-slate-900 dark:text-slate-200">{localTo || localFrom || "—"}</strong>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPickerOpen(false)}
                    className="btn-secondary flex-1"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyCustomRange}
                    disabled={!localFrom}
                    className="btn-primary flex-1"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>Aplicar Período</span>
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}
        </div>
      </div>
    </div>
  );
}
