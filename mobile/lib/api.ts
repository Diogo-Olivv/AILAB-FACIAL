import { Platform } from "react-native";
import { File as ExpoFile } from "expo-file-system";
import { ApiError } from "@/lib/errors";

const BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  process.env.EXPO_PUBLIC_API_URL ??
  "http://localhost:8000";

// Separação de privilégios: kiosks usam KIOSK_KEY apenas para inferência.
// Operações administrativas (enroll, refresh, revoke, delete) exigem tutorToken JWT.
const KIOSK_KEY = process.env.EXPO_PUBLIC_KIOSK_KEY ?? "";

async function appendUpload(form: FormData, field: string, upload: UploadFile) {
  if (Platform.OS === "web") {
    const res = await fetch(upload.uri);
    const blob = await res.blob();
    form.append(field, blob, upload.name);
  } else {
    form.append(field, new ExpoFile(upload.uri) as unknown as Blob, upload.name);
  }
}

/**
 * Realiza uma requisição HTTP autenticada para o backend.
 *
 * @param path - Caminho da API (ex: "/api/v1/recognize")
 * @param options - Opções do fetch (method, body, headers...)
 * @param tutorToken - Bearer JWT do Supabase Auth para rotas administrativas.
 *   Quando fornecido, usa Authorization: Bearer. Quando omitido, usa X-Kiosk-Key.
 */
async function request<T>(
  path: string,
  options: RequestInit = {},
  tutorToken?: string
): Promise<T> {
  const authHeaders: Record<string, string> = tutorToken
    ? { Authorization: `Bearer ${tutorToken}` }
    : { "X-Kiosk-Key": KIOSK_KEY };

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      ...authHeaders,
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    console.warn(`API ${res.status} ${path}: ${body}`);
    throw new ApiError(res.status, body);
  }
  return res.json() as Promise<T>;
}

// ── Tipos ────────────────────────────────────────────────────────────────────

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
  event?: {
    action: RecognitionAction;
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

// ── Endpoints ─────────────────────────────────────────────────────────────────

/** POST /recognize/challenge — solicita token de desafio temporal anti-injeção. */
export async function getRecognizeChallenge(signal?: AbortSignal): Promise<ChallengeResponse> {
  return request<ChallengeResponse>("/api/v1/recognize/challenge", {
    method: "POST",
    signal,
  });
}

/** POST /recognize — usa kiosk key (sem tutorToken) e anexa challenge_id de vivacidade temporal. */
export async function recognizeFrame(
  frameOrFrames: UploadFile | UploadFile[],
  action?: "check_in" | "check_out",
  signal?: AbortSignal
): Promise<RecognizeResult> {
  // 1. Obtém desafio efêmero de vivacidade temporal antes do upload
  const challenge = await getRecognizeChallenge(signal);

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
  return request<RecognizeResult>("/api/v1/recognize", {
    method: "POST",
    body: form,
    headers: {
      "X-Challenge-Token": challenge.challenge_id,
      "X-Challenge-Id": challenge.challenge_id,
    },
    signal,
  });
}

/** GET /sessions/stats/:id — usa kiosk key. */
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

/** POST /enroll — requer tutorToken (Supabase Auth, role=tutor). */
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
    { method: "POST", body: form },
    tutorToken
  );
}

/** POST /profiles/:id/refresh-embedding — requer tutorToken. */
export async function refreshEmbedding(
  profileId: string,
  frames: UploadFile[],
  tutorToken: string
): Promise<EnrollResult> {
  const form = new FormData();
  for (const frame of frames) {
    await appendUpload(form, "frames", frame);
  }
  return request<EnrollResult>(
    `/api/v1/profiles/${profileId}/refresh-embedding`,
    { method: "POST", body: form },
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
