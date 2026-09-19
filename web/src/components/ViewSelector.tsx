import { useRef, useState, type PointerEvent } from "react";

export type ViewKey = "totals" | "history";

const VIEWS: { key: ViewKey; label: string; shortLabel: string }[] = [
  { key: "totals", label: "Totais por Integrante", shortLabel: "Totais" },
  { key: "history", label: "Histórico Diário", shortLabel: "Diário" },
];

interface Props {
  view: ViewKey;
  onViewChange: (view: ViewKey) => void;
}

export function ViewSelector({ view, onViewChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragLeftPx, setDragLeftPx] = useState<number | null>(null);
  const activeIndex = view === "totals" ? 0 : 1;

  const updateSegmentFromClientX = (clientX: number, isFinal = false) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const padding = 4;
    const usableWidth = Math.max(rect.width - padding * 2, 1);
    const pillWidth = usableWidth / 2;
    const maxLeft = usableWidth - pillWidth;

    const relativeX = clientX - rect.left - padding;
    const currentLeft = Math.max(0, Math.min(relativeX - pillWidth / 2, maxLeft));
    setDragLeftPx(currentLeft);

    if (isFinal) {
      const segmentIndex = Math.min(1, Math.max(0, Math.round(currentLeft / pillWidth)));
      const targetKey = VIEWS[segmentIndex].key;
      if (targetKey !== view) {
        onViewChange(targetKey);
      }
    }
  };

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    setIsDragging(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignora caso o navegador não suporte pointer capture
    }
    updateSegmentFromClientX(e.clientX, false);
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    updateSegmentFromClientX(e.clientX, false);
  };

  const handlePointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      setIsDragging(false);
      updateSegmentFromClientX(e.clientX, true);
      setDragLeftPx(null);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Ignora
      }
    }
  };

  const handlePointerCancel = (e: PointerEvent<HTMLDivElement>) => {
    setIsDragging(false);
    setDragLeftPx(null);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignora
    }
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      className="relative w-full sm:w-[360px] h-11 rounded-2xl bg-[#FAF9F5] border border-[#E5E2DC] dark:bg-slate-800/80 dark:border-slate-700 p-1 select-none cursor-grab active:cursor-grabbing touch-none"
      role="tablist"
      aria-label="Alternar entre totais e histórico"
    >
      {/* Pílula flutuante com alinhamento milimétrico idêntico ao Seletor de Período */}
      <div
        className={`absolute top-1 bottom-1 rounded-xl bg-white border border-[#E5E2DC]/80 shadow-2xs dark:bg-slate-900 dark:border-slate-600 pointer-events-none ${
          isDragging
            ? "transition-none shadow-md scale-[1.01]"
            : "transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
        }`}
        style={{
          left:
            isDragging && dragLeftPx !== null
              ? `${4 + dragLeftPx}px`
              : `calc(4px + ${activeIndex} * ((100% - 8px) / 2))`,
          width: "calc((100% - 8px) / 2)",
        }}
      />

      <div className="relative z-10 grid grid-cols-2 h-full">
        {VIEWS.map((v) => {
          const isActive = view === v.key;
          return (
            <button
              key={v.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={(e) => {
                e.stopPropagation();
                onViewChange(v.key);
              }}
              className={`flex items-center justify-center px-3 text-xs sm:text-sm font-sans rounded-xl transition-colors duration-200 cursor-pointer h-full select-none ${
                isActive
                  ? "text-[#171715] dark:text-slate-100 font-semibold"
                  : "text-[#706E6A] dark:text-slate-400 font-medium hover:text-[#171715] dark:hover:text-slate-200"
              }`}
            >
              <span className="hidden sm:inline">{v.label}</span>
              <span className="sm:hidden font-medium">{v.shortLabel}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
