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
    .select("profile_id, check_in, check_out, duration_s")
    .gte("check_in", range.from.toISOString())
    .lte("check_in", range.to.toISOString())
    .order("check_in", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((s) => ({
    profileId: s.profile_id,
    checkIn: s.check_in,
    checkOut: s.check_out,
    durationS: s.duration_s,
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
