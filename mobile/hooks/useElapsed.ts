import { useEffect, useState } from "react";

export function useElapsed(checkIn: string): string {
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    const update = () => {
      const diffSec = Math.max(0, Math.floor((Date.now() - new Date(checkIn).getTime()) / 1000));
      const h = Math.floor(diffSec / 3600);
      const m = Math.floor((diffSec % 3600) / 60);
      const s = diffSec % 60;
      const pad = (n: number) => String(n).padStart(2, "0");

      if (h > 0) {
        setElapsed(`${h}h ${pad(m)}m ${pad(s)}s`);
      } else if (m > 0) {
        setElapsed(`${m}m ${pad(s)}s`);
      } else {
        setElapsed(`${s}s`);
      }
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [checkIn]);

  return elapsed;
}
