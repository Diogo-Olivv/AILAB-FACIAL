import { useCallback, useState } from "react";
import { enrollStudent, type EnrollResult, type UploadFile } from "@/lib/api";

export type EnrollOutcome =
  | { ok: true; data: EnrollResult }
  | { ok: false; message: string };

export function useEnroll() {
  const [loading, setLoading] = useState(false);

  const enroll = useCallback(
    async (
      name: string,
      matricula: string,
      consent: boolean,
      frames: UploadFile[]
    ): Promise<EnrollOutcome> => {
      setLoading(true);
      try {
        const data = await enrollStudent(name, matricula, consent, frames);
        return { ok: true, data };
      } catch (err: any) {
        return { ok: false, message: err?.message ?? "Erro desconhecido" };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { enroll, loading };
}
