import { useEffect, useState } from "react";

const globalListeners = new Set<() => void>();
let globalInterval: ReturnType<typeof setInterval> | null = null;

function ensureGlobalTicker() {
  if (!globalInterval && globalListeners.size > 0) {
    globalInterval = setInterval(() => {
      globalListeners.forEach((listener) => listener());
    }, 1000);
  }
}

function stopGlobalTickerIfEmpty() {
  if (globalListeners.size === 0 && globalInterval) {
    clearInterval(globalInterval);
    globalInterval = null;
  }
}

export function formatElapsed(checkIn: string): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(checkIn).getTime()) / 1000));
  const h = Math.floor(diffSec / 3600);
  const m = Math.floor((diffSec % 3600) / 60);
  const s = diffSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");

  if (h > 0) {
    return `${h}h ${pad(m)}m ${pad(s)}s`;
  } else if (m > 0) {
    return `${m}m ${pad(s)}s`;
  } else {
    return `${s}s`;
  }
}

export function useElapsed(checkIn: string): string {
  const [elapsed, setElapsed] = useState(() => formatElapsed(checkIn));

  useEffect(() => {
    setElapsed(formatElapsed(checkIn));
    const listener = () => {
      setElapsed(formatElapsed(checkIn));
    };
    globalListeners.add(listener);
    ensureGlobalTicker();

    return () => {
      globalListeners.delete(listener);
      stopGlobalTickerIfEmpty();
    };
  }, [checkIn]);

  return elapsed;
}

