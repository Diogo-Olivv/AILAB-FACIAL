export const GENERIC_ERROR_MESSAGE = "Algo deu errado. Tente novamente.";

export class ApiError extends Error {
  readonly status: number;
  readonly body: string;
  /** Segundos sugeridos pelo servidor antes de repetir (cabeçalho Retry-After). */
  readonly retryAfter: number | null;
  /** Estado informado pelo servidor quando a requisição ainda está em processamento. */
  readonly recognitionState: string | null;

  constructor(
    status: number,
    body: string,
    retryAfter: number | null = null,
    recognitionState: string | null = null
  ) {
    super(GENERIC_ERROR_MESSAGE);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
    this.retryAfter = retryAfter;
    this.recognitionState = recognitionState;
  }
}

/** O totem ainda não tem identidade própria: um tutor precisa ativá-lo. */
export class KioskNotProvisionedError extends Error {
  constructor() {
    super("Totem não ativado.");
    this.name = "KioskNotProvisionedError";
  }
}

/**
 * A requisição não respondeu a tempo ou a rede falhou.
 * Não prova que o servidor NÃO processou: o resultado é desconhecido.
 */
export class NetworkTimeoutError extends Error {
  constructor(message = "Tempo de resposta esgotado.") {
    super(message);
    this.name = "NetworkTimeoutError";
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

export type RecognitionFailureKind =
  | "not_provisioned"
  | "unauthorized"
  | "rate_limited"
  | "unavailable"
  | "unconfirmed"
  | "rejected";

/**
 * Classifica uma falha do reconhecimento para a interface.
 * "unconfirmed" = resultado desconhecido (timeout/rede): nunca é presença confirmada.
 */
export function classifyRecognitionFailure(err: unknown): RecognitionFailureKind {
  if (err instanceof KioskNotProvisionedError) return "not_provisioned";
  if (err instanceof NetworkTimeoutError) return "unconfirmed";
  if (err instanceof ApiError) {
    if (err.status === 401 || err.status === 403) return "unauthorized";
    if (err.status === 429) return "rate_limited";
    if (err.status === 503) return "unavailable";
    if (err.status >= 500) return "unconfirmed";
    return "rejected";
  }
  return "unconfirmed";
}

export const RECOGNITION_FAILURE_COPY: Record<RecognitionFailureKind, { title: string; message: string }> = {
  not_provisioned: {
    title: "Totem não ativado",
    message: "Este dispositivo ainda não foi ativado. Procure um tutor.",
  },
  unauthorized: {
    title: "Totem sem autorização",
    message: "A autorização deste dispositivo não é mais válida. Procure um tutor.",
  },
  rate_limited: {
    title: "Muitas tentativas",
    message: "Aguarde um minuto antes de tentar novamente.",
  },
  unavailable: {
    title: "Verificação indisponível",
    message: "O serviço de reconhecimento está indisponível. Tente novamente em instantes ou procure um tutor.",
  },
  unconfirmed: {
    title: "Registro não confirmado",
    message: "Sem conexão — não foi possível confirmar o registro. Tente novamente ou procure um tutor.",
  },
  rejected: {
    title: "Não foi possível registrar",
    message: "A captura não foi aceita. Faça uma nova tentativa.",
  },
};
