import { useCallback, useState } from "react";
import { refreshEmbedding, type EnrollResult, type UploadFile } from "@/lib/api";
import { extractErrorMessage } from "@/lib/errors";

export type RefreshOutcome =
  | { ok: true; data: EnrollResult }
  | { ok: false; message: string };

export function useRefreshEmbedding() {
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(
    async (
      profileId: string,
      frames: UploadFile[],
      tutorToken?: string
    ): Promise<RefreshOutcome> => {
      if (!tutorToken) {
        return {
          ok: false,
          message: "Sessão do tutor ausente ou expirada. Faça login novamente.",
        };
      }

      if (!profileId) {
        return {
          ok: false,
          message: "Nenhum integrante selecionado para recadastro.",
        };
      }

      setLoading(true);
      try {
        const data = await refreshEmbedding(profileId, frames, tutorToken);
        return { ok: true, data };
      } catch (err: unknown) {
        return { ok: false, message: extractErrorMessage(err) };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { refresh, loading };
}
