import { useCallback, useState } from "react";
import { enrollStudent, type EnrollResult, type UploadFile } from "@/lib/api";
import { extractErrorMessage } from "@/lib/errors";

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
      } catch (err: unknown) {
        return { ok: false, message: extractErrorMessage(err) };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { enroll, loading };
}
