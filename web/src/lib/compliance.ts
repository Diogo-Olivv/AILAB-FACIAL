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

  const { data, error } = await supabase.rpc("justify_attendance_debt", {
    p_profile_id: profileId,
    p_period_start: periodStartMonday,
    p_category: category,
    p_reason: trimmedReason,
  });

  if (error) {
    throw new Error(error.message || "Falha ao registrar justificativa.");
  }

  const raw = data?.justification ?? data;
  return mapJustificationRow(raw);
}

/**
 * Revoga uma justificativa ativa previamente concedida.
 */
export async function revokeAttendanceJustification(
  id: string,
  reason?: string
): Promise<AttendanceJustification> {
  const trimmedReason = reason?.trim() ? reason.trim() : null;

  const { data, error } = await supabase.rpc("revoke_attendance_justification", {
    p_id: id,
    p_reason: trimmedReason,
  });

  if (error) {
    throw new Error(error.message || "Falha ao revogar justificativa.");
  }

  const raw = data?.justification ?? data;
  return mapJustificationRow(raw);
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
  // O servidor entrega no máximo 100 linhas por página; segue o cursor até o fim.
  // Uma falha é propagada: lista vazia por erro faria um justificado aparecer como débito.
  const all: AttendanceJustification[] = [];
  let cursor: unknown = null;
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
      throw new Error(error.message || "Falha ao carregar justificativas.");
    }

    const items: any[] = Array.isArray(data?.items) ? data.items : [];
    all.push(...items.map(mapJustificationRow));
    cursor = data?.next_cursor ?? null;
    if (!cursor) break;
  }
  return all;
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
