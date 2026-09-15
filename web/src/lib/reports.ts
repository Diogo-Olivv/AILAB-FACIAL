import { supabase } from "./supabase";

export interface Member {
  id: string;
  name: string;
  matricula: string | null;
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

export async function fetchMembers(): Promise<Member[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, matricula")
    .eq("active", true)
    .order("name");
  if (error) throw error;
  return (data ?? []).map((p) => ({ id: p.id, name: p.name, matricula: p.matricula }));
}

export async function fetchSessions(range: DateRange): Promise<SessionRecord[]> {
  const { data, error } = await supabase
    .from("sessions")
    .select("id, profile_id, check_in, check_out, duration_s, auto_closed, voided_at")
    .gte("check_in", range.from.toISOString())
    .lte("check_in", range.to.toISOString())
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

export async function fetchPresentIds(): Promise<string[]> {
  const { data, error } = await supabase
    .from("sessions")
    .select("profile_id")
    .is("check_out", null);
  if (error) throw error;
  return (data ?? []).map((s) => s.profile_id);
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
  // 1. Invoca a RPC atômica tutor_close_session com SECURITY DEFINER
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

  // 2. Fallback direto via Supabase REST (caso a sessão autenticada possua permissão RLS)
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
  // 1. Invoca a RPC atômica tutor_register_entry
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

  // 2. Fallback direto via Supabase REST
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

