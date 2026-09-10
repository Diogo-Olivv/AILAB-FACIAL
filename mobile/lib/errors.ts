export const GENERIC_ERROR_MESSAGE = "Algo deu errado. Tente novamente.";

export class ApiError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(status: number, body: string) {
    super(GENERIC_ERROR_MESSAGE);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export function extractErrorMessage(err: unknown): string {
  if (err instanceof ApiError && err.body) {
    try {
      const parsed = JSON.parse(err.body);
      if (typeof parsed?.detail === "string") return parsed.detail;
      if (typeof parsed?.message === "string") return parsed.message;
    } catch {
      if (err.body.trim().length > 0 && err.body.length < 200) {
        return err.body;
      }
    }
  }
  if (err instanceof Error && err.message && err.message !== GENERIC_ERROR_MESSAGE) {
    return err.message;
  }
  return GENERIC_ERROR_MESSAGE;
}
