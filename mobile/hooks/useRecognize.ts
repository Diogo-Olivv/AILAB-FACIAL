import { useCallback, useRef, useState } from "react";
import { recognizeFrame, type RecognizeResult } from "@/lib/api";

export function useRecognize() {
  const [result, setResult] = useState<RecognizeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const recognize = useCallback(
    async (imageBlob: Blob, action?: "check_in" | "check_out") => {
    // Cancela chamada anterior se ainda pendente
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setError(null);
    try {
      const res = await recognizeFrame(imageBlob, action);
      setResult(res);
      return res;
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setError(err.message ?? "Erro desconhecido");
      }
      return null;
    } finally {
      setLoading(false);
    }
    },
    []
  );

  return { recognize, result, loading, error };
}
