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
