/**
 * Módulo central de Conformidade Semanal e Justificativas de Débito (Justificar).
 *
 * Regra institucional:
 *   - Semana civil de Segunda a Domingo (America/Sao_Paulo).
 *   - Meta semanal: 4 horas (14.400 segundos).
 *   - Justificativa vale para UM perfil e UMA semana civil.
 *   - Horas reais nunca são alteradas nem apagadas.
 *   - Débito continua registrado matematicamente, mas o status é 'justified'.
 *   - Justificativa ativa remove o estudante da listagem de advertências.
 */

import { supabase } from "./supabase.ts";
import { getSundayOfWeek } from "./tz.ts";
import { WEEKLY_TARGET_SECONDS } from "./attendanceTarget.ts";

export { WEEKLY_TARGET_SECONDS };


export type JustificationCategory =
  | "saude"
  | "academico"
  | "institucional"
  | "pessoal"
  | "outro";

export const JUSTIFICATION_CATEGORIES: { id: JustificationCategory; label: string }[] = [
  { id: "saude", label: "Saúde / Consulta médica" },
  { id: "academico", label: "Compromisso Acadêmico / Prova / Monitoria" },
  { id: "institucional", label: "Representação Institucional / Evento" },
  { id: "pessoal", label: "Motivo Pessoal / Família" },
  { id: "outro", label: "Outro motivo (especificar)" },
];

export interface AttendanceJustification {
  id: string;
  profileId: string;
  periodStart: string; // YYYY-MM-DD (Segunda)
  periodEnd: string;   // YYYY-MM-DD (Domingo)
  category: JustificationCategory;
  reason: string | null;
  status: "active" | "revoked";
  justifiedBy: string;
  justifiedByLabel?: string;
  justifiedAt: string;
  revokedAt?: string | null;
  revokedBy?: string | null;
  revokedByLabel?: string | null;
  revocationReason?: string | null;
}

export type ComplianceStatus = "met" | "debt" | "justified";

export interface WeeklyCompliance {
  profileId: string;
  periodStart: string;
  periodEnd: string;
  status: ComplianceStatus;
  totalSeconds: number; // Horas reais intactas
  targetSeconds: number; // 14400s
  deficitSeconds: number; // Math.max(0, target - total)
  justification?: AttendanceJustification | null;
}

/**
 * Função ÚNICA de cálculo de conformidade semanal.
 *
 * Avalia o cumprimento da meta e a presença de justificativa ativa.
 * Nunca transforma 'abaixo da meta' em 'meta cumprida': marca como 'justified'.
 */
export function computeWeeklyCompliance(
  profileId: string,
  totalSeconds: number,
  periodStartMonday: string,
  justification?: AttendanceJustification | null,
  targetSeconds = WEEKLY_TARGET_SECONDS
): WeeklyCompliance {
  const deficitSeconds = Math.max(0, targetSeconds - totalSeconds);
  let status: ComplianceStatus;

  if (totalSeconds >= targetSeconds) {
    status = "met";
  } else if (justification && justification.status === "active") {
    status = "justified";
  } else {
    status = "debt";
  }

  return {
    profileId,
    periodStart: periodStartMonday,
    periodEnd: getSundayOfWeek(periodStartMonday),
    status,
    totalSeconds,
    targetSeconds,
    deficitSeconds,
    justification: justification ?? null,
  };
}

// ── Armazenamento Local de Resiliência (Fallback quando RPC não está migrada) ──

const LOCAL_JUSTIFICATIONS_STORAGE_KEY = "ailab_attendance_justifications_v1";

function getLocalJustifications(): AttendanceJustification[] {
  if (typeof window === "undefined" || !window.localStorage) return [];
  try {
    const raw = localStorage.getItem(LOCAL_JUSTIFICATIONS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalJustifications(items: AttendanceJustification[]): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    localStorage.setItem(LOCAL_JUSTIFICATIONS_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Silencia eventuais quotas de armazenamento
  }
}

function saveLocalJustificationFallback(
  profileId: string,
  periodStartMonday: string,
  category: JustificationCategory,
  reason: string | null
): AttendanceJustification {
  const current = getLocalJustifications();
  const end = new Date(periodStartMonday);
  end.setDate(end.getDate() + 6);
  const periodEnd = end.toISOString().split("T")[0];

  const filtered = current.filter(
    (j) => !(j.profileId === profileId && j.periodStart === periodStartMonday && j.status === "active")
  );

  const newJustification: AttendanceJustification = {
    id: `local-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    profileId,
    periodStart: periodStartMonday,
    periodEnd,
    category,
    reason,
    status: "active",
    justifiedBy: "tutor-local",
    justifiedByLabel: "Tutor Responsável",
    justifiedAt: new Date().toISOString(),
    revokedAt: null,
    revokedBy: null,
    revokedByLabel: undefined,
    revocationReason: null,
  };

  filtered.push(newJustification);
  saveLocalJustifications(filtered);
  return newJustification;
}

function revokeLocalJustificationFallback(
  id: string,
  reason: string | null
): AttendanceJustification {
  const current = getLocalJustifications();
  const target = current.find((j) => j.id === id);
  if (!target) {
    const nowIso = new Date().toISOString();
    return {
      id,
      profileId: "",
      periodStart: "",
      periodEnd: "",
      category: "outro",
      reason: null,
      status: "revoked",
      justifiedBy: "tutor-local",
      justifiedAt: nowIso,
      revokedAt: nowIso,
      revokedBy: "tutor-local",
      revocationReason: reason,
    };
  }

  target.status = "revoked";
  target.revokedAt = new Date().toISOString();
  target.revokedBy = "tutor-local";
  target.revokedByLabel = "Tutor Responsável";
  target.revocationReason = reason;

  saveLocalJustifications(current);
  return target;
}

function isRpcMissingError(err: any): boolean {
  if (!err) return false;
  const msg = String(err.message || "").toLowerCase();
  const code = String(err.code || "");
  return (
    code === "PGRST202" ||
    code === "42883" ||
    msg.includes("schema cache") ||
    msg.includes("not find the function") ||
    msg.includes("does not exist") ||
    msg.includes("failed to fetch")
  );
}

// ── Chamadas de RPC (Supabase - Restritas a Tutores) ──────────────────────────

/**
 * Justifica débito de frequência de um perfil para uma semana civil.
 */
export async function justifyAttendanceDebt(
  profileId: string,
  periodStartMonday: string,
  category: JustificationCategory,
  reason?: string
): Promise<AttendanceJustification> {
  const trimmedReason = reason?.trim() ? reason.trim() : null;

  if (category === "outro" && (!trimmedReason || trimmedReason.length < 3)) {
    throw new Error("Para a categoria 'Outro', a descrição do motivo é obrigatória (mínimo 3 caracteres).");
  }

  try {
    const { data, error } = await supabase.rpc("justify_attendance_debt", {
      p_profile_id: profileId,
      p_period_start: periodStartMonday,
      p_category: category,
      p_reason: trimmedReason,
    });

    if (error) {
      if (isRpcMissingError(error)) {
        return saveLocalJustificationFallback(profileId, periodStartMonday, category, trimmedReason);
      }
      throw new Error(error.message || "Falha ao registrar justificativa.");
    }

    const raw = data?.justification ?? data;
    return mapJustificationRow(raw);
  } catch (err: any) {
    if (isRpcMissingError(err)) {
      return saveLocalJustificationFallback(profileId, periodStartMonday, category, trimmedReason);
    }
    throw err;
  }
}

/**
 * Revoga uma justificativa ativa previamente concedida.
 */
export async function revokeAttendanceJustification(
  id: string,
  reason?: string
): Promise<AttendanceJustification> {
  const trimmedReason = reason?.trim() ? reason.trim() : null;

  if (id.startsWith("local-")) {
    return revokeLocalJustificationFallback(id, trimmedReason);
  }

  try {
    const { data, error } = await supabase.rpc("revoke_attendance_justification", {
      p_id: id,
      p_reason: trimmedReason,
    });

    if (error) {
      if (isRpcMissingError(error)) {
        return revokeLocalJustificationFallback(id, trimmedReason);
      }
      throw new Error(error.message || "Falha ao revogar justificativa.");
    }

    const raw = data?.justification ?? data;
    return mapJustificationRow(raw);
  } catch (err: any) {
    if (isRpcMissingError(err)) {
      return revokeLocalJustificationFallback(id, trimmedReason);
    }
    throw err;
  }
}

/**
 * Consulta a lista de justificativas em um período para um ou todos os perfis.
 */
export async function listAttendanceJustifications(
  fromMonday: string,
  toSunday: string,
  profileId?: string,
  includeRevoked = true
): Promise<AttendanceJustification[]> {
  const all: AttendanceJustification[] = [];
  let cursor: unknown = null;

  try {
    for (let page = 0; page < MAX_JUSTIFICATION_PAGES; page++) {
      const { data, error } = await supabase.rpc("list_attendance_justifications", {
        p_from: fromMonday,
        p_to: toSunday,
        p_profile_id: profileId || null,
        p_include_revoked: includeRevoked,
        p_limit: 100,
        p_cursor: cursor,
      });

      if (error) {
        if (isRpcMissingError(error)) {
          break;
        }
        throw new Error(error.message || "Falha ao carregar justificativas.");
      }

      const items: any[] = Array.isArray(data?.items) ? data.items : [];
      all.push(...items.map(mapJustificationRow));
      cursor = data?.next_cursor ?? null;
      if (!cursor) break;
    }
  } catch (err: any) {
    if (!isRpcMissingError(err)) {
      console.warn("Erro ao buscar justificativas no Supabase:", err);
    }
  }

  // Mescla com eventuais justificativas locais mantidas em fallback
  const locals = getLocalJustifications().filter((j) => {
    if (profileId && j.profileId !== profileId) return false;
    if (!includeRevoked && j.status === "revoked") return false;
    return j.periodStart >= fromMonday && j.periodStart <= toSunday;
  });

  const merged = [...all];
  for (const loc of locals) {
    const existingIdx = merged.findIndex(
      (m) => m.profileId === loc.profileId && m.periodStart === loc.periodStart
    );
    if (existingIdx >= 0) {
      if (loc.status === "revoked" && merged[existingIdx].status === "active") {
        merged[existingIdx] = loc;
      }
    } else {
      merged.push(loc);
    }
  }

  return merged;
}

const MAX_JUSTIFICATION_PAGES = 20;

function mapJustificationRow(row: any): AttendanceJustification {
  return {
    id: row.id,
    profileId: row.profile_id,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    category: row.category,
    reason: row.reason ?? null,
    status: row.status === "active" || (!row.revoked_at && row.status !== "revoked") ? "active" : "revoked",
    justifiedBy: row.justified_by,
    justifiedByLabel: row.justified_by_label ?? undefined,
    justifiedAt: row.justified_at,
    revokedAt: row.revoked_at ?? null,
    revokedBy: row.revoked_by ?? null,
    revokedByLabel: row.revoked_by_label ?? undefined,
    revocationReason: row.revocation_reason ?? null,
  };
}
