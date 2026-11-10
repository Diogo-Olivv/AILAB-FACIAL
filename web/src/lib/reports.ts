import { supabase } from "./supabase";

export interface Member {
  id: string;
  name: string;
  matricula: string | null;
  avatarUrl?: string | null;
  isTutor?: boolean;
}

export interface SessionRecord {
  id?: number;
  profileId: string;
  checkIn: string;
  checkOut: string | null;
  durationS: number | null;
  autoClosed?: boolean;
  voidedAt?: string | null;
}

export interface DateRange {
  from: Date;
  to: Date;
}

export interface PublicBucket {
  dow: number;
  hour: number;
  sessions: number;
  seconds: number;
}

export interface PublicLabStats {
  presentNow: number;
  windowDays: number;
  totalSessions: number;
  buckets: PublicBucket[];
  timezone: string;
  generatedAt: string;
}

export async function fetchPublicLabStats(days = 28): Promise<PublicLabStats> {
  // 1. Tenta RPC nativo public_lab_stats (quando migração 23 está aplicada no backend)
  try {
    const { data, error } = await supabase.rpc("public_lab_stats", { p_days: days });
    if (!error && data) {
      const raw = data as {
        present_now?: number;
        window_days?: number;
        total_sessions?: number;
        buckets?: Array<{ dow: number; hour: number; sessions: number; seconds: number }>;
        timezone?: string;
        generated_at?: string;
      };
      return {
        presentNow: raw?.present_now ?? 0,
        windowDays: raw?.window_days ?? days,
        totalSessions: raw?.total_sessions ?? 0,
        buckets: raw?.buckets ?? [],
        timezone: raw?.timezone ?? "America/Sao_Paulo",
        generatedAt: raw?.generated_at ?? new Date().toISOString(),
      };
    }
  } catch {
    // RPC não disponível no schema do Supabase remoto, fallback gracioso
  }

  // 2. Fallback de alta disponibilidade: agrega sessões anonimamente sem expor PII (DP-1)
  try {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const [pRes, sRes] = await Promise.all([
      supabase
        .from("sessions")
        .select("id", { count: "exact", head: true })
        .is("check_out", null)
        .is("voided_at", null),
      supabase
        .from("sessions")
        .select("check_in, check_out, duration_s")
        .is("voided_at", null)
        .gte("check_in", since.toISOString()),
    ]);

    const presentNow = pRes.count ?? 0;
    const rawSessions = sRes.data ?? [];
    const bucketsMap = new Map<string, { dow: number; hour: number; sessions: number; seconds: number }>();

    for (const s of rawSessions) {
      if (!s.check_in) continue;
      const d = new Date(s.check_in);
      const rawDow = d.getDay();
      const dow = rawDow === 0 ? 7 : rawDow;
      const hour = d.getHours();
      const key = `${dow}_${hour}`;
      let dur = typeof s.duration_s === "number" && s.duration_s > 0 ? s.duration_s : 0;
      if (dur === 0 && s.check_in) {
        const outTime = s.check_out ? new Date(s.check_out).getTime() : Date.now();
        dur = Math.max(0, Math.floor((outTime - d.getTime()) / 1000));
        if (dur > 36000) dur = 36000;
      }
      const b = bucketsMap.get(key) ?? { dow, hour, sessions: 0, seconds: 0 };
      b.sessions += 1;
      b.seconds += dur;
      bucketsMap.set(key, b);
    }

    return {
      presentNow,
      windowDays: days,
      totalSessions: rawSessions.length,
      buckets: Array.from(bucketsMap.values()),
      timezone: "America/Sao_Paulo",
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.warn("[AILAB] Não foi possível carregar estatísticas agregadas do laboratório:", err);
    return {
      presentNow: 0,
      windowDays: days,
      totalSessions: 0,
      buckets: [],
      timezone: "America/Sao_Paulo",
      generatedAt: new Date().toISOString(),
    };
  }
}

export async function fetchMembers(): Promise<Member[]> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, name, matricula, avatar_url, is_tutor")
      .eq("active", true)
      .order("name");
    if (error) {
      if (error.code === "42501" || error.message?.includes("permission denied")) {
        return [];
      }
      throw error;
    }
    return (data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      matricula: p.matricula,
      avatarUrl: p.avatar_url ?? null,
      isTutor: Boolean(p.is_tutor),
    }));
  } catch (err: any) {
    if (err?.code === "42501" || err?.message?.includes("permission denied")) {
      return [];
    }
    throw err;
  }
}

export async function updateMemberAvatar(memberId: string, avatarUrl: string | null): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", memberId);
  if (error) throw error;
}

export function compressImageToBase64(file: File, maxSize = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          return reject(new Error("Não foi possível processar a imagem."));
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error("Falha ao ler o arquivo de imagem."));
      img.src = event.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Erro ao carregar o arquivo."));
    reader.readAsDataURL(file);
  });
}

export async function fetchSessions(range: DateRange): Promise<SessionRecord[]> {
  try {
    const { data, error } = await supabase
      .from("sessions")
      .select("id, profile_id, check_in, check_out, duration_s, auto_closed, voided_at")
      .gte("check_in", range.from.toISOString())
      .lte("check_in", range.to.toISOString())
      .order("check_in", { ascending: false });
    if (error) {
      if (error.code === "42501" || error.message?.includes("permission denied")) {
        return [];
      }
      throw error;
    }
    return (data ?? []).map((s) => ({
      id: s.id,
      profileId: s.profile_id,
      checkIn: s.check_in,
      checkOut: s.check_out,
      durationS: s.duration_s,
      autoClosed: s.auto_closed,
      voidedAt: s.voided_at,
    }));
  } catch (err: any) {
    if (err?.code === "42501" || err?.message?.includes("permission denied")) {
      return [];
    }
    throw err;
  }
}

export async function fetchMemberSessionsOnDate(
  profileId: string,
  dayStartISO: string,
  dayEndISO: string
): Promise<SessionRecord[]> {
  const { data, error } = await supabase
    .from("sessions")
    .select("id, profile_id, check_in, check_out, duration_s, auto_closed, voided_at")
    .eq("profile_id", profileId)
    .gte("check_in", dayStartISO)
    .lte("check_in", dayEndISO)
    .order("check_in", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((s) => ({
    id: s.id,
    profileId: s.profile_id,
    checkIn: s.check_in,
    checkOut: s.check_out,
    durationS: s.duration_s,
    autoClosed: s.auto_closed,
    voidedAt: s.voided_at,
  }));
}

const API_BASE_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) ||
  "https://ailab-facial-api-948162587922.southamerica-east1.run.app";

export async function tutorRegisterManualSession(
  profileId: string,
  checkInISO: string,
  checkOutISO: string
): Promise<void> {
  // 1. Tenta API do backend (executa com service_role)
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/sessions/manual`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer tutor-master-local-session",
      },
      body: JSON.stringify({
        profile_id: profileId,
        check_in: checkInISO,
        check_out: checkOutISO,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success) return;
    }
  } catch (apiErr) {
    console.warn("Backend manual session falhou, tentando fallback direto:", apiErr);
  }

  // 2. Fallback direto via Supabase REST
  const { error } = await supabase
    .from("sessions")
    .insert({ profile_id: profileId, check_in: checkInISO, check_out: checkOutISO });
  if (error) throw error;
}

export async function fetchPresentIds(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from("sessions")
      .select("profile_id")
      .is("check_out", null)
      .is("voided_at", null);
    if (error) {
      if (error.code === "42501" || error.message?.includes("permission denied")) {
        return [];
      }
      throw error;
    }
    return (data ?? []).map((s) => s.profile_id);
  } catch (err: any) {
    if (err?.code === "42501" || err?.message?.includes("permission denied")) {
      return [];
    }
    throw err;
  }
}

/**
 * Permite que o tutor encerre uma sessão em aberto:
 * - action === "checkout": Encerra com horário atual, computando a permanência normal até o momento.
 * - action === "void": Anula a sessão (voided_at preenchido), computando 0 horas (esquecimento/erro).
 */
export async function tutorCloseSession(
  profileId: string,
  action: "checkout" | "void"
): Promise<void> {
  // 1. Tenta API oficial do backend (executa no Cloud Run com service_role, ignorando restrições RLS de cliente anônimo)
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/sessions/tutor-close`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer tutor-master-local-session",
      },
      body: JSON.stringify({ profile_id: profileId, action }),
    });
    if (res.ok) {
      const json = await res.json();
      if (json.success) return;
    }
  } catch (apiErr) {
    console.warn("Backend tutor-close falhou, tentando RPC direto:", apiErr);
  }

  // 2. Invoca a RPC atômica tutor_close_session com SECURITY DEFINER
  try {
    const { data, error } = await supabase.rpc("tutor_close_session", {
      p_profile_id: profileId,
      p_action: action,
    });

    if (error) {
      console.warn("RPC tutor_close_session falhou, tentando fallback direto:", error.message);
    } else if (data && typeof data === "object") {
      const res = data as { success?: boolean; updated_count?: number };
      if (res.success) {
        return;
      }
    }
  } catch (rpcErr) {
    console.warn("Exceção ao chamar RPC tutor_close_session:", rpcErr);
  }

  // 3. Fallback direto via Supabase REST (caso a sessão autenticada possua permissão RLS)
  const now = new Date().toISOString();
  if (action === "checkout") {
    const { error } = await supabase
      .from("sessions")
      .update({ check_out: now })
      .eq("profile_id", profileId)
      .is("check_out", null);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("sessions")
      .update({
        check_out: now,
        voided_at: now,
        auto_closed: true,
      })
      .eq("profile_id", profileId)
      .is("check_out", null);
    if (error) throw error;
  }
}

/**
 * Permite que o tutor registre manualmente a entrada de um integrante.
 * Útil para contingência caso o totem ou reconhecimento facial trave ou apresente falhas.
 */
export async function tutorRegisterEntry(profileId: string): Promise<void> {
  // 1. Tenta API do backend (executa com service_role)
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/sessions/entry`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer tutor-master-local-session",
      },
      body: JSON.stringify({ profile_id: profileId }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success) return;
    }
  } catch (apiErr) {
    console.warn("Backend tutor-entry falhou, tentando RPC direto:", apiErr);
  }

  // 2. Invoca a RPC atômica tutor_register_entry
  try {
    const { data, error } = await supabase.rpc("tutor_register_entry", {
      p_profile_id: profileId,
    });

    if (error) {
      console.warn("RPC tutor_register_entry falhou, tentando fallback:", error.message);
    } else if (data && typeof data === "object") {
      const res = data as { success?: boolean; message?: string };
      if (res.success) {
        return;
      }
      if (res.message) {
        throw new Error(res.message);
      }
    }
  } catch (rpcErr: any) {
    if (rpcErr?.message && !rpcErr.message.includes("RPC")) {
      throw rpcErr;
    }
    console.warn("Exceção ao chamar RPC tutor_register_entry:", rpcErr);
  }

  // 3. Fallback direto via Supabase REST
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("sessions")
    .insert({ profile_id: profileId, check_in: now });
  if (error) throw error;
}

/**
 * Permite que o tutor descadastre um integrante (ex: desistentes do laboratório).
 * - Remove biometria facial para estrita conformidade com a LGPD.
 * - Desativa o perfil (active = false), removendo-o de todas as listas ativas.
 * - Opcionalmente purga registros históricos se solicitado.
 */
export async function tutorRemoveMember(
  profileId: string,
  purgeData = false
): Promise<void> {
  // 1. Invoca a RPC atômica tutor_remove_member
  try {
    const { data, error } = await supabase.rpc("tutor_remove_member", {
      p_profile_id: profileId,
      p_purge_data: purgeData,
    });

    if (error) {
      console.warn("RPC tutor_remove_member falhou, tentando fallback:", error.message);
    } else if (data && typeof data === "object") {
      const res = data as { success?: boolean; message?: string };
      if (res.success) {
        return;
      }
      if (res.message) {
        throw new Error(res.message);
      }
    }
  } catch (rpcErr: any) {
    if (rpcErr?.message && !rpcErr.message.includes("RPC")) {
      throw rpcErr;
    }
    console.warn("Exceção ao chamar RPC tutor_remove_member:", rpcErr);
  }

  // 2. Fallback direto via Supabase REST
  const now = new Date().toISOString();
  // Encerra qualquer sessão aberta
  await supabase
    .from("sessions")
    .update({ check_out: now, voided_at: now, auto_closed: true })
    .eq("profile_id", profileId)
    .is("check_out", null);

  // Remove embeddings faciais
  await supabase.from("face_embeddings").delete().eq("profile_id", profileId);

  // Inativa o perfil
  const { error } = await supabase
    .from("profiles")
    .update({ active: false, consent_revoked_at: now })
    .eq("id", profileId);
  if (error) throw error;
}

/**
 * Permite que o tutor anule/invalide uma sessão específica (ex: sessão anômala ou > 10h).
 * Zera a contagem de horas e grava voided_at com rastreabilidade.
 */
export async function tutorVoidSession(sessionId: number, reason = "anomalous_or_over_10h"): Promise<void> {
  try {
    const { data, error } = await supabase.rpc("tutor_void_session", {
      p_session_id: sessionId,
      p_reason: reason,
    });
    if (error) {
      console.warn("RPC tutor_void_session falhou, tentando fallback direto:", error.message);
    } else if (data && typeof data === "object") {
      const res = data as { success?: boolean; message?: string };
      if (res.success) return;
      if (res.message) throw new Error(res.message);
    }
  } catch (rpcErr: any) {
    if (rpcErr?.message && !rpcErr.message.includes("RPC")) throw rpcErr;
    console.warn("Exceção ao chamar RPC tutor_void_session:", rpcErr);
  }

  // Fallback direto via Supabase REST
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("sessions")
    .update({ voided_at: now, auto_closed: true })
    .eq("id", sessionId);
  if (error) throw error;
}

/**
 * Permite que o tutor reative uma sessão que havia sido anulada por equívoco.
 */
export async function tutorUnvoidSession(sessionId: number): Promise<void> {
  try {
    const { data, error } = await supabase.rpc("tutor_unvoid_session", {
      p_session_id: sessionId,
    });
    if (error) {
      console.warn("RPC tutor_unvoid_session falhou, tentando fallback direto:", error.message);
    } else if (data && typeof data === "object") {
      const res = data as { success?: boolean; message?: string };
      if (res.success) return;
      if (res.message) throw new Error(res.message);
    }
  } catch (rpcErr: any) {
    if (rpcErr?.message && !rpcErr.message.includes("RPC")) throw rpcErr;
    console.warn("Exceção ao chamar RPC tutor_unvoid_session:", rpcErr);
  }

  const { error } = await supabase
    .from("sessions")
    .update({ voided_at: null })
    .eq("id", sessionId);
  if (error) throw error;
}

/**
 * Permite que o tutor exclua definitivamente uma sessão do histórico do banco de dados.
 */
export async function tutorDeleteSession(sessionId: number): Promise<void> {
  try {
    const { data, error } = await supabase.rpc("tutor_delete_session", {
      p_session_id: sessionId,
    });
    if (error) {
      console.warn("RPC tutor_delete_session falhou, tentando fallback direto:", error.message);
    } else if (data && typeof data === "object") {
      const res = data as { success?: boolean; message?: string };
      if (res.success) return;
      if (res.message) throw new Error(res.message);
    }
  } catch (rpcErr: any) {
    if (rpcErr?.message && !rpcErr.message.includes("RPC")) throw rpcErr;
    console.warn("Exceção ao chamar RPC tutor_delete_session:", rpcErr);
  }

  const { error } = await supabase.from("sessions").delete().eq("id", sessionId);
  if (error) throw error;
}

