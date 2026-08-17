import { API_BASE_URL, API_KEY } from "./config";

export interface EnrollResult {
  profile_id: string;
  name: string;
  photos_used: number;
}

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

async function post<T>(path: string, body: FormData): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "X-API-Key": API_KEY },
    body,
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`API ${res.status}: ${detail}`);
  }
  return res.json() as Promise<T>;
}

export async function enroll(
  name: string,
  matricula: string,
  consent: boolean,
  photos: Blob[],
): Promise<EnrollResult> {
  const form = new FormData();
  form.append("name", name);
  form.append("matricula", matricula);
  form.append("consent", String(consent));
  photos.forEach((photo, i) => form.append("frames", photo, `frame_${i}.jpg`));
  return post<EnrollResult>("/api/v1/enroll", form);
}

export async function recognizeFrame(frame: Blob): Promise<RecognizeResult> {
  const form = new FormData();
  form.append("frame", frame, "frame.jpg");
  return post<RecognizeResult>("/api/v1/recognize", form);
}
