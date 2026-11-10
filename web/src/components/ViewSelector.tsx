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
  const dragRef = useRef<{
    startX: number;
    startY: number;
    initialLeft: number;
    pointerId: number;
    isDragging: boolean;
  } | null>(null);
  const justDraggedRef = useRef(false);
  const activeIndex = view === "totals" ? 0 : 1;

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const padding = 4;
    const usableWidth = Math.max(rect.width - padding * 2, 1);
    const pillWidth = usableWidth / 2;
    const maxLeft = usableWidth - pillWidth;

    const currentPillLeft = activeIndex * pillWidth;
    const touchX = e.clientX - rect.left - padding;
    const isTouchNearPill =
      touchX >= currentPillLeft - 12 && touchX <= currentPillLeft + pillWidth + 12;

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

    if (!drag.isDragging) {
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 7) {
        dragRef.current = null;
        return;
      }
      if (Math.abs(dx) >= 7) {
        drag.isDragging = true;
        setIsDragging(true);
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {}
      } else {
        return;
      }
    }

    const rect = containerRef.current.getBoundingClientRect();
    const padding = 4;
    const usableWidth = Math.max(rect.width - padding * 2, 1);
    const pillWidth = usableWidth / 2;
    const maxLeft = usableWidth - pillWidth;

    const currentLeft = Math.max(0, Math.min(drag.initialLeft + dx, maxLeft));
    setDragLeftPx(currentLeft);

    // Atualização em tempo real durante o arraste
    const segmentIndex = Math.min(1, Math.max(0, Math.round(currentLeft / pillWidth)));
    const targetKey = VIEWS[segmentIndex].key;
    if (targetKey !== view) {
      onViewChange(targetKey);
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
      } catch {}
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
      } catch {}
      setIsDragging(false);
      setDragLeftPx(null);
    }
    dragRef.current = null;
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      className="segmented-track w-full sm:w-[300px] h-11 sm:h-10 select-none cursor-grab active:cursor-grabbing touch-pan-y"
      role="tablist"
      aria-label="Alternar entre totais e histórico"
    >
      {/* Pílula flutuante com alinhamento milimétrico idêntico ao Seletor de Período */}
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
                if (justDraggedRef.current) return;
                onViewChange(v.key);
              }}
              className={`flex items-center justify-center px-3 text-xs font-sans rounded-lg transition-colors duration-200 cursor-pointer h-full select-none ${
                isActive
                  ? "text-slate-900 dark:text-white font-semibold"
                  : "text-slate-500 dark:text-slate-400 font-medium hover:text-slate-900 dark:hover:text-white"
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
