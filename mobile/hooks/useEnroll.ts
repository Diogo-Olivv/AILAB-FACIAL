import { useCallback, useState } from "react";
import { enrollStudent, type EnrollResult, type UploadFile } from "@/lib/api";

export function useEnroll() {
  const [result, setResult] = useState<EnrollResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enroll = useCallback(
    async (name: string, matricula: string, consent: boolean, frames: UploadFile[]) => {
      setLoading(true);
      setError(null);
      try {
        const res = await enrollStudent(name, matricula, consent, frames);
        setResult(res);
        return res;
      } catch (err: any) {
        setError(err.message ?? "Erro desconhecido");
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { enroll, result, loading, error };
}
