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
      className="relative grid grid-cols-2 w-full sm:w-[350px] rounded-2xl bg-[#FAF9F5] border border-[#E5E2DC] p-1 select-none cursor-pointer touch-none"
      role="tablist"
      aria-label="Alternar entre totais e histórico"
    >
      {/* Pílula branca flutuante */}
      <div
        className="absolute top-1 bottom-1 rounded-xl bg-white border border-[#E5E2DC]/80 shadow-2xs transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] pointer-events-none"
        style={{
          width: "calc(50% - 2px)",
          transform: `translateX(${activeIndex * 100}%)`,
          left: "1px",
        }}
      />

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
            className={`relative z-10 flex items-center justify-center py-2 px-3 text-xs sm:text-sm font-sans font-medium rounded-xl transition-colors duration-200 cursor-pointer min-h-[38px] ${
              isActive ? "text-[#171715] font-semibold" : "text-[#706E6A] hover:text-[#171715]"
            }`}
          >
            {v.label}
          </button>
        );
      })}
    </div>
  );
}
