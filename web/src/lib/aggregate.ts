import type { Member, SessionRecord } from "./reports";

export function formatDuration(totalSeconds: number, includeSeconds = false): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  if (includeSeconds) {
    return `${hours}h ${minutes.toString().padStart(2, "0")}m ${seconds.toString().padStart(2, "0")}s`;
  }
  return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function sessionSeconds(session: SessionRecord, now: Date): number {
  if (session.voidedAt != null) return 0;
  if (session.durationS != null) return session.durationS;
  if (session.checkOut != null) {
    const closedElapsed = Math.floor(
      (new Date(session.checkOut).getTime() - new Date(session.checkIn).getTime()) / 1000
    );
    return Math.max(0, closedElapsed);
  }
  const elapsed = Math.floor((now.getTime() - new Date(session.checkIn).getTime()) / 1000);
  return Math.max(0, elapsed);
}

export interface MemberTotal {
  member: Member;
  totalSeconds: number;
  sessionCount: number;
  present: boolean;
}

export function totalsByMember(
  members: Member[],
  sessions: SessionRecord[],
  presentIds: string[],
  now: Date,
): MemberTotal[] {
  const present = new Set(presentIds);
  const totals = new Map<string, MemberTotal>();
  for (const member of members) {
    totals.set(member.id, {
      member,
      totalSeconds: 0,
      sessionCount: 0,
      present: present.has(member.id),
    });
  }
  for (const session of sessions) {
    const row = totals.get(session.profileId);
    if (!row) continue;
    if (session.voidedAt != null) continue;
    row.totalSeconds += sessionSeconds(session, now);
    row.sessionCount += 1;
  }
  return [...totals.values()].sort((a, b) => b.totalSeconds - a.totalSeconds);
}

export interface DayEntry {
  memberName: string;
  checkIn: string;
  checkOut: string | null;
  seconds: number;
  open: boolean;
  voided: boolean;
}

export interface DayGroup {
  key: string;
  label: string;
  totalSeconds: number;
  entries: DayEntry[];
}

function dayKey(iso: string): string {
  const date = new Date(iso);
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function dayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

export function groupByDay(members: Member[], sessions: SessionRecord[], now: Date): DayGroup[] {
  const names = new Map(members.map((m) => [m.id, m.name]));
  const groups = new Map<string, DayGroup>();
  for (const session of sessions) {
    const key = dayKey(session.checkIn);
    let group = groups.get(key);
    if (!group) {
      group = { key, label: dayLabel(session.checkIn), totalSeconds: 0, entries: [] };
      groups.set(key, group);
    }
    const isVoided = session.voidedAt != null;
    const seconds = sessionSeconds(session, now);
    group.totalSeconds += seconds;
    group.entries.push({
      memberName: names.get(session.profileId) ?? "Desconhecido",
      checkIn: session.checkIn,
      checkOut: session.checkOut,
      seconds,
      open: session.checkOut === null && !isVoided,
      voided: isVoided,
    });
  }
  return [...groups.values()].sort((a, b) => (a.key < b.key ? 1 : -1));
}
