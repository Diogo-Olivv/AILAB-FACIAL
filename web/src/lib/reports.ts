import { supabase } from "./supabase";

export interface Member {
  id: string;
  name: string;
  matricula: string | null;
}

export interface SessionRecord {
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
    .select("profile_id, check_in, check_out, duration_s, auto_closed, voided_at")
    .gte("check_in", range.from.toISOString())
    .lte("check_in", range.to.toISOString())
    .order("check_in", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((s) => ({
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
