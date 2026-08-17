const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const API_KEY = process.env.EXPO_PUBLIC_API_KEY ?? "";

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
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface RecognizeResult {
  recognized: boolean;
  profile_id?: string;
  confidence?: number;
  event?: {
    action: "check_in" | "check_out" | "debounced";
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

// ── Endpoints ─────────────────────────────────────────────────────────────────

export async function recognizeFrame(imageBlob: Blob): Promise<RecognizeResult> {
  const form = new FormData();
  form.append("frame", imageBlob, "frame.jpg");
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

export async function triggerSheetsSync(): Promise<{ synced: number; cursor: number }> {
  return request("/api/v1/sync/sheets", { method: "POST" });
}
