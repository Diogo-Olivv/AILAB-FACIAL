import { useRef, useState, type PointerEvent } from "react";

export type ViewKey = "totals" | "history";

const VIEWS: { key: ViewKey; label: string }[] = [
  { key: "totals", label: "Totais por Integrante" },
  { key: "history", label: "Histórico Diário" },
];

interface Props {
  view: ViewKey;
  onViewChange: (view: ViewKey) => void;
}

export function ViewSelector({ view, onViewChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const activeIndex = view === "totals" ? 0 : 1;

  const updateSegmentFromClientX = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const segmentIndex = x / rect.width < 0.5 ? 0 : 1;
    const targetKey = VIEWS[segmentIndex].key;
    if (targetKey !== view) {
      onViewChange(targetKey);
    }
  };

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    setIsDragging(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignora caso o navegador não suporte pointer capture
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
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => setIsDragging(false)}
      className="relative w-full sm:w-[360px] h-11 rounded-2xl bg-[#FAF9F5] border border-[#E5E2DC] dark:bg-slate-800/80 dark:border-slate-700 p-1 select-none cursor-pointer touch-none"
      role="tablist"
      aria-label="Alternar entre totais e histórico"
    >
      {/* Pílula flutuante com alinhamento milimétrico idêntico ao Seletor de Período */}
      <div
        className="absolute top-1 bottom-1 rounded-xl bg-white border border-orange-200/90 shadow-xs dark:bg-slate-900 dark:border-slate-600 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] pointer-events-none"
        style={{
          left: `calc(4px + ${activeIndex} * ((100% - 8px) / 2))`,
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
                  ? "text-[#C15F3D] dark:text-amber-300 font-bold"
                  : "text-[#706E6A] dark:text-slate-400 font-medium hover:text-[#171715] dark:hover:text-slate-200"
              }`}
            >
              <span>{v.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
