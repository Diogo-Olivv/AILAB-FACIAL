import { Platform } from "react-native";
import { File as ExpoFile } from "expo-file-system";
import { ApiError, KioskNotProvisionedError, NetworkTimeoutError } from "@/lib/errors";
import { getKioskAccessToken } from "@/lib/supabase";

const BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  process.env.EXPO_PUBLIC_API_URL ??
  "http://localhost:8000";

/** Tempo máximo de uma requisição comum e de um upload de frames. */
const DEFAULT_TIMEOUT_MS = 12_000;
const UPLOAD_TIMEOUT_MS = 25_000;

/**
 * Repetição do reconhecimento: SEMPRE o mesmo desafio e os mesmos frames (em
 * memória), para que o servidor trate como a mesma requisição e não gere um
 * segundo registro. Orçamento total bem abaixo da retenção do servidor (5 min).
 */
const RECOGNIZE_MAX_RETRIES = 2;
const RECOGNIZE_BACKOFF_MS = [1000, 2000];

async function appendUpload(form: FormData, field: string, upload: UploadFile) {
  if (Platform.OS === "web") {
    const res = await fetch(upload.uri);
    const blob = await res.blob();
    form.append(field, blob, upload.name);
  } else {
    form.append(field, new ExpoFile(upload.uri) as unknown as Blob, upload.name);
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        const abortError = new Error("Aborted");
        abortError.name = "AbortError";
        reject(abortError);
      },
      { once: true }
    );
  });
}

interface RequestConfig extends RequestInit {
  timeoutMs?: number;
}

/**
 * Requisição autenticada ao backend.
 *
 * - `tutorToken` informado → rota administrativa com a sessão temporária do tutor.
 * - omitido → identidade própria do dispositivo (kiosk). Sem identidade, a
 *   chamada nem é enviada: lança KioskNotProvisionedError.
 *
 * Toda requisição tem prazo. Estouro de prazo ou falha de rede viram
 * NetworkTimeoutError (resultado desconhecido). Cancelamento pelo chamador
 * continua sendo AbortError.
 */
async function request<T>(path: string, config: RequestConfig = {}, tutorToken?: string): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal: callerSignal, headers, ...init } = config;

  const token = tutorToken || (await getKioskAccessToken());
  if (!token) {
    throw new KioskNotProvisionedError();
  }

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onCallerAbort = () => controller.abort();
  if (callerSignal) {
    if (callerSignal.aborted) controller.abort();
    else callerSignal.addEventListener("abort", onCallerAbort, { once: true });
  }

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        ...((headers as Record<string, string> | undefined) ?? {}),
      },
    });
  } catch (err: any) {
    if (timedOut) throw new NetworkTimeoutError();
    if (err?.name === "AbortError") throw err;
    throw new NetworkTimeoutError("Falha de rede.");
  } finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener("abort", onCallerAbort);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const retryAfterRaw = res.headers.get("Retry-After");
    const retryAfter = retryAfterRaw ? Number.parseInt(retryAfterRaw, 10) : NaN;
    // Só o status vai para o console: corpo e credenciais nunca são registrados.
    console.warn(`API ${res.status} ${path}`);
    throw new ApiError(
      res.status,
      body,
      Number.isFinite(retryAfter) ? retryAfter : null,
      res.headers.get("X-Recognition-State")
    );
  }
  return res.json() as Promise<T>;
}

// ── Tipos ────────────────────────────────────────────────

export interface UploadFile {
  uri: string;
  name: string;
  type: string;
}

export type RecognitionAction =
  | "check_in"
  | "check_out"
  | "already_in"
  | "not_in"
  | "debounced";

export interface RecognizeResult {
  recognized: boolean;
  profile_id?: string;
  name?: string;
  confidence?: number;
  distance?: number;
  cosine_similarity?: number;
  status?: string;
  message?: string;
  is_tutor?: boolean;
  event?: {
    action: RecognitionAction;
    profile_id?: string;
    session_id?: number;
    timestamp?: string;
    duration_minutes?: number;
    wait_seconds?: number;
  };
}

export interface SessionStats {
  profile_id: string;
  total_hours: number;
  year: number | null;
  month: number | null;
}

export interface ChallengeResponse {
  challenge_id: string;
  expires_at: number;
  ttl_seconds: number;
}

export interface EnrollResult {
  profile_id: string;
  name: string;
  photos_used: number;
}

export interface KioskCredential {
  kiosk_id: string;
  label: string;
  email: string;
  password: string;
}

// ── Endpoints ──────────────────────────────────────────────

/** POST /recognize/challenge — desafio temporal vinculado a este dispositivo. */
export async function getRecognizeChallenge(signal?: AbortSignal): Promise<ChallengeResponse> {
  return request<ChallengeResponse>("/api/v1/recognize/challenge", {
    method: "POST",
    signal,
  });
}

function isRetryableRecognizeError(err: unknown): boolean {
  if (err instanceof NetworkTimeoutError) return true;
  if (err instanceof ApiError) {
    if (err.status === 409) return err.recognitionState === "processing";
    return err.status >= 500;
  }
  return false;
}

/**
 * POST /recognize — identidade do kiosk + desafio.
 *
 * O desafio e o formulário são montados UMA vez. Em timeout, falha de rede, 5xx
 * ou "em processamento", a MESMA requisição é reenviada: se o servidor já tinha
 * registrado a presença, ele devolve a resposta original em vez de registrar de novo.
 * Erros de validação (4xx) não são repetidos — exigem nova captura.
 */
export async function recognizeFrame(
  frameOrFrames: UploadFile | UploadFile[],
  action?: "check_in" | "check_out" | null,
  signal?: AbortSignal
): Promise<RecognizeResult> {
  const challenge = await getRecognizeChallenge(signal);

  const buildForm = async () => {
    const form = new FormData();
    form.append("challenge_id", challenge.challenge_id);
    if (Array.isArray(frameOrFrames)) {
      if (frameOrFrames.length > 0) {
        await appendUpload(form, "frame", frameOrFrames[0]);
      }
      for (const f of frameOrFrames) {
        await appendUpload(form, "frames", f);
      }
    } else {
      await appendUpload(form, "frame", frameOrFrames);
      await appendUpload(form, "frames", frameOrFrames);
    }
    if (action) form.append("action", action);
    return form;
  };

  let lastError: unknown;
  for (let attempt = 0; attempt <= RECOGNIZE_MAX_RETRIES; attempt++) {
    try {
      // Mesmo conteúdo e mesma ordem a cada tentativa (o servidor compara a impressão digital).
      const form = await buildForm();
      return await request<RecognizeResult>("/api/v1/recognize", {
        method: "POST",
        body: form,
        headers: {
          "X-Challenge-Token": challenge.challenge_id,
          "X-Challenge-Id": challenge.challenge_id,
        },
        signal,
        timeoutMs: UPLOAD_TIMEOUT_MS,
      });
    } catch (err) {
      lastError = err;
      if (attempt === RECOGNIZE_MAX_RETRIES || !isRetryableRecognizeError(err)) {
        throw err;
      }
      const serverHint = err instanceof ApiError && err.retryAfter ? err.retryAfter * 1000 : 0;
      await sleep(Math.min(Math.max(RECOGNIZE_BACKOFF_MS[attempt], serverHint), 5000), signal);
    }
  }
  throw lastError;
}

/** GET /sessions/stats/:id — identidade do kiosk. */
export async function getSessionStats(
  profileId: string,
  year?: number,
  month?: number
): Promise<SessionStats> {
  const params = new URLSearchParams();
  if (year) params.set("year", String(year));
  if (month) params.set("month", String(month));
  const qs = params.toString() ? `?${params}` : "";
  return request<SessionStats>(`/api/v1/sessions/stats/${profileId}${qs}`);
}

/** POST /enroll — requer tutorToken (Supabase Auth, papel tutor). */
export async function enrollStudent(
  name: string,
  matricula: string,
  consent: boolean,
  frames: UploadFile[],
  tutorToken: string
): Promise<EnrollResult> {
  const form = new FormData();
  form.append("name", name);
  form.append("matricula", matricula);
  form.append("consent", String(consent));
  for (const frame of frames) {
    await appendUpload(form, "frames", frame);
  }
  return request<EnrollResult>(
    "/api/v1/enroll",
    { method: "POST", body: form, timeoutMs: UPLOAD_TIMEOUT_MS },
    tutorToken
  );
}

/**
 * POST /profiles/:id/refresh-embedding — tutorToken; durante a janela cadastral,
 * a identidade do kiosk também é aceita.
 */
export async function refreshEmbedding(
  profileId: string,
  frames: UploadFile[],
  tutorToken?: string
): Promise<EnrollResult> {
  const form = new FormData();
  for (const frame of frames) {
    await appendUpload(form, "frames", frame);
  }
  return request<EnrollResult>(
    `/api/v1/profiles/${profileId}/refresh-embedding`,
    { method: "POST", body: form, timeoutMs: UPLOAD_TIMEOUT_MS },
    tutorToken
  );
}

/** POST /profiles/:id/revoke-consent — requer tutorToken. */
export async function revokeConsent(
  profileId: string,
  tutorToken: string
): Promise<{ revoked: boolean; profile_id: string; revoked_at: string }> {
  return request(
    `/api/v1/profiles/${profileId}/revoke-consent`,
    { method: "POST" },
    tutorToken
  );
}

/** DELETE /profiles/:id — requer tutorToken. */
export async function deleteProfile(
  profileId: string,
  tutorToken: string
): Promise<{ deleted: boolean; profile_id: string }> {
  return request(
    `/api/v1/profiles/${profileId}`,
    { method: "DELETE" },
    tutorToken
  );
}

/**
 * POST /kiosks — um tutor ativa este dispositivo.
 * A credencial devolvida é usada uma vez para iniciar a sessão do kiosk e descartada.
 */
export async function provisionKiosk(label: string, tutorToken: string): Promise<KioskCredential> {
  return request<KioskCredential>(
    "/api/v1/kiosks",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    },
    tutorToken
  );
}
