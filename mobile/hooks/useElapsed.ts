import { useEffect, useState } from "react";

export function useElapsed(checkIn: string): string {
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    const update = () => {
      const diffSec = Math.floor((Date.now() - new Date(checkIn).getTime()) / 1000);
      const h = Math.floor(diffSec / 3600);
      const m = Math.floor((diffSec % 3600) / 60);
      const s = diffSec % 60;
      setElapsed(h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [checkIn]);

  return elapsed;
}
