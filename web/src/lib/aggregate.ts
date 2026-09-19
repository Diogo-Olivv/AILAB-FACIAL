import type { Member, SessionRecord } from "./reports";

/**
 * Retorna true se a data cair em dia útil (Segunda a Sexta-feira).
 * Descarta sábados (6) e domingos (0).
 */
export function isWeekday(d: Date | string): boolean {
  const date = typeof d === "string" ? new Date(d) : d;
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

/**
 * Filtra registros de sessão mantendo apenas os ocorridos em dias úteis (Seg–Sex).
 */
export function filterWeekdaySessions(sessions: SessionRecord[]): SessionRecord[] {
  return sessions.filter((s) => isWeekday(s.checkIn));
}

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

export interface ShiftSummary {
  morningSeconds: number;
  afternoonSeconds: number;
  eveningSeconds: number;
  peakShift: "Manhã" | "Tarde" | "Noite" | "Sem dados";
}

export interface StudentAtRisk {
  member: Member;
  totalSeconds: number;
  deficitSeconds: number;
  lastCheckIn: string | null;
  status: "critical" | "warning";
}

export interface TutorInsights {
  totalWeekdaySessions: number;
  totalWeekdaySeconds: number;
  activeMembersCount: number;
  totalMembersCount: number;
  retentionRate: number; // 0 a 100%
  averageStayPerActiveSeconds: number;
  studentsAtRisk: StudentAtRisk[];
  shifts: ShiftSummary;
}

export function calculateTutorInsights(
  members: Member[],
  sessions: SessionRecord[],
  now: Date
): TutorInsights {
  const weekdaySessions = filterWeekdaySessions(sessions).filter((s) => s.voidedAt == null);

  const memberSeconds = new Map<string, number>();
  const lastCheckInMap = new Map<string, string>();
  for (const m of members) {
    memberSeconds.set(m.id, 0);
  }

  let morningSec = 0;
  let afternoonSec = 0;
  let eveningSec = 0;

  for (const s of weekdaySessions) {
    const sec = sessionSeconds(s, now);
    memberSeconds.set(s.profileId, (memberSeconds.get(s.profileId) ?? 0) + sec);

    const h = new Date(s.checkIn).getHours();
    if (h < 12) {
      morningSec += sec;
    } else if (h < 18) {
      afternoonSec += sec;
    } else {
      eveningSec += sec;
    }

    const prevLast = lastCheckInMap.get(s.profileId);
    if (!prevLast || s.checkIn > prevLast) {
      lastCheckInMap.set(s.profileId, s.checkIn);
    }
  }

  const activeMembersCount = [...memberSeconds.values()].filter((sec) => sec > 0).length;
  const totalMembersCount = members.length;
  const retentionRate =
    totalMembersCount > 0 ? Math.round((activeMembersCount / totalMembersCount) * 100) : 0;

  const totalWeekdaySeconds = weekdaySessions.reduce((sum, s) => sum + sessionSeconds(s, now), 0);
  const averageStayPerActiveSeconds =
    activeMembersCount > 0 ? Math.round(totalWeekdaySeconds / activeMembersCount) : 0;

  let peakShift: "Manhã" | "Tarde" | "Noite" | "Sem dados" = "Sem dados";
  if (morningSec > 0 || afternoonSec > 0 || eveningSec > 0) {
    if (morningSec >= afternoonSec && morningSec >= eveningSec) {
      peakShift = "Manhã";
    } else if (afternoonSec >= morningSec && afternoonSec >= eveningSec) {
      peakShift = "Tarde";
    } else {
      peakShift = "Noite";
    }
  }

  const TARGET_SECONDS = 4 * 3600;
  const studentsAtRisk: StudentAtRisk[] = [];

  for (const m of members) {
    const sec = memberSeconds.get(m.id) ?? 0;
    if (sec < TARGET_SECONDS) {
      const deficit = TARGET_SECONDS - sec;
      const lastCheckIn = lastCheckInMap.get(m.id) ?? null;
      studentsAtRisk.push({
        member: m,
        totalSeconds: sec,
        deficitSeconds: deficit,
        lastCheckIn,
        status: sec === 0 ? "critical" : "warning",
      });
    }
  }

  studentsAtRisk.sort((a, b) => b.deficitSeconds - a.deficitSeconds);

  return {
    totalWeekdaySessions: weekdaySessions.length,
    totalWeekdaySeconds,
    activeMembersCount,
    totalMembersCount,
    retentionRate,
    averageStayPerActiveSeconds,
    studentsAtRisk,
    shifts: {
      morningSeconds: morningSec,
      afternoonSeconds: afternoonSec,
      eveningSeconds: eveningSec,
      peakShift,
    },
  };
}

