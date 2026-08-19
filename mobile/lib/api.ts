import { File } from "expo-file-system";
import { ApiError } from "@/lib/errors";

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const API_KEY = process.env.EXPO_PUBLIC_API_KEY ?? "";

function appendUpload(form: FormData, field: string, upload: UploadFile) {
  form.append(field, new File(upload.uri) as unknown as Blob, upload.name);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "X-API-Key": API_KEY,
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
  confidence?: number;
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

export interface EnrollResult {
  profile_id: string;
  name: string;
  photos_used: number;
}

// ── Endpoints ─────────────────────────────────────────────────────────────────

export async function recognizeFrame(
  frame: UploadFile,
  action?: "check_in" | "check_out"
): Promise<RecognizeResult> {
  const form = new FormData();
  appendUpload(form, "frame", frame);
  if (action) form.append("action", action);
  return request<RecognizeResult>("/api/v1/recognize", {
    method: "POST",
    body: form,
  });
}

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

export async function enrollStudent(
  name: string,
  matricula: string,
  consent: boolean,
  frames: UploadFile[]
): Promise<EnrollResult> {
  const form = new FormData();
  form.append("name", name);
  form.append("matricula", matricula);
  form.append("consent", String(consent));
  frames.forEach((frame) => appendUpload(form, "frames", frame));
  return request<EnrollResult>("/api/v1/enroll", {
    method: "POST",
    body: form,
  });
}
