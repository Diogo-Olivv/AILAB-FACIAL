import { supabase } from "./supabase";

export interface MemberHours {
  id: string;
  name: string;
  matricula: string | null;
  totalSeconds: number;
  present: boolean;
}

export function formatHours(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
}

export async function fetchMemberHours(): Promise<MemberHours[]> {
  const [profiles, sessions] = await Promise.all([
    supabase.from("profiles").select("id, name, matricula").eq("active", true),
    supabase.from("sessions").select("profile_id, duration_s, check_out"),
  ]);
  if (profiles.error) throw profiles.error;
  if (sessions.error) throw sessions.error;

  const byId = new Map<string, MemberHours>();
  for (const p of profiles.data ?? []) {
    byId.set(p.id, { id: p.id, name: p.name, matricula: p.matricula, totalSeconds: 0, present: false });
  }
  for (const s of sessions.data ?? []) {
    const member = byId.get(s.profile_id);
    if (!member) continue;
    if (s.duration_s) member.totalSeconds += s.duration_s;
    if (s.check_out === null) member.present = true;
  }
  return [...byId.values()].sort((a, b) => b.totalSeconds - a.totalSeconds);
}
