import { useState, useMemo } from "react";
import {
  TrendingUp,
  Clock,
  Users,
  AlertTriangle,
  SunMedium,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import type { Member, SessionRecord } from "../lib/reports";
import {
  calculateTutorInsights,
  formatDuration,
} from "../lib/aggregate";
import { MemberAvatar } from "./MemberAvatar";

interface Props {
  members: Member[];
  sessions: SessionRecord[];
  now: Date;
  onSelectMember?: (memberId: string) => void;
}

export function TutorInsightsCard({ members, sessions, now, onSelectMember }: Props) {
  const [isRiskListExpanded, setIsRiskListExpanded] = useState(false);

  const insights = useMemo(
    () => calculateTutorInsights(members, sessions, now),
    [members, sessions, now]
  );

  const { shifts, studentsAtRisk } = insights;
  const totalShiftSeconds =
    shifts.morningSeconds + shifts.afternoonSeconds + shifts.eveningSeconds || 1;
  const morningPct = Math.round((shifts.morningSeconds / totalShiftSeconds) * 100);
  const afternoonPct = Math.round((shifts.afternoonSeconds / totalShiftSeconds) * 100);
  const eveningPct = Math.round((shifts.eveningSeconds / totalShiftSeconds) * 100);

  const criticalCount = studentsAtRisk.filter((s) => s.status === "critical").length;

  return (
    <section className="surface-card p-5 sm:p-6 transition-all duration-200" aria-labelledby="tutor-insights-heading">
      {/* Cabeçalho do Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200/80 dark:border-white/[0.07]">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 ring-1 ring-orange-500/25 text-orange-600 dark:text-amber-400">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 id="tutor-insights-heading" className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                Insights Analíticos da Tutoria
              </h3>
              <span className="rounded-md bg-slate-100 dark:bg-[#161F30] border border-slate-200/80 dark:border-white/[0.08] px-2 py-0.5 text-2xs font-mono-data font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap shrink-0">
                Dias Úteis (Seg–Sex)
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Auditoria de retenção, frequência semanal e vigilância de carga horária mínima (<span className="tabular-nums">4h</span>).
            </p>
          </div>
        </div>

        {/* Indicador de Status Geral */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {studentsAtRisk.length === 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              <span className="tabular-nums">100% dos Discentes na Meta</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 ring-1 ring-amber-500/25 px-3 py-1 text-xs font-semibold text-amber-800 dark:text-amber-300 tabular-nums">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <span>
                {studentsAtRisk.length} {studentsAtRisk.length === 1 ? "discente abaixo de 4h" : "discentes abaixo de 4h"}
              </span>
            </span>
          )}
        </div>
      </div>

      {/* Grid de 4 Indicadores Principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-5">
        {/* KPI 1: Frequência & Retenção */}
        <div className="surface-muted p-4 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="eyebrow">Retenção Útil</span>
            <span className="w-9 h-9 rounded-lg flex items-center justify-center bg-emerald-500/10 ring-1 ring-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0">
              <Users className="h-4 w-4" />
            </span>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white font-mono-data tabular-nums">
                {Math.min(100, Math.max(0, insights.retentionRate))}%
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono-data tabular-nums">
                ({insights.activeMembersCount}/{insights.totalMembersCount})
              </span>
            </div>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              Discentes com presença ativa
            </p>
          </div>
        </div>

        {/* KPI 2: Média Diária de Permanência */}
        <div className="surface-muted p-4 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="eyebrow">Média por Ativo</span>
            <span className="w-9 h-9 rounded-lg flex items-center justify-center bg-indigo-500/10 ring-1 ring-indigo-500/20 text-indigo-600 dark:text-indigo-400 shrink-0">
              <Clock className="h-4 w-4" />
            </span>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white font-mono-data tabular-nums">
              {formatDuration(insights.averageStayPerActiveSeconds)}
            </div>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              Soma útil: <strong className="font-mono-data font-semibold text-slate-700 dark:text-slate-200">{formatDuration(insights.totalWeekdaySeconds)}</strong>
            </p>
          </div>
        </div>

        {/* KPI 3: Distribuição por Turno & Pico */}
        <div className="surface-muted p-4 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="eyebrow">Turno Dominante</span>
            <span className="w-9 h-9 rounded-lg flex items-center justify-center bg-amber-500/10 ring-1 ring-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
              <SunMedium className="h-4 w-4" />
            </span>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
              {shifts.peakShift}
            </div>
            <div className="mt-2">
              <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-[#0F1623]">
                <div style={{ width: `${morningPct}%` }} className="bg-amber-400" title={`Manhã: ${morningPct}%`} />
                <div style={{ width: `${afternoonPct}%` }} className="bg-orange-500" title={`Tarde: ${afternoonPct}%`} />
                <div style={{ width: `${eveningPct}%` }} className="bg-indigo-500" title={`Noite: ${eveningPct}%`} />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono-data tabular-nums mt-1">
                <span>M {morningPct}%</span>
                <span>T {afternoonPct}%</span>
                <span>N {eveningPct}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* KPI 4: Alunos Abaixo da Meta (< 4h) */}
        <div className="surface-muted p-4 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="eyebrow">Abaixo da Meta (&lt;4h)</span>
            <span className="w-9 h-9 rounded-lg flex items-center justify-center bg-rose-500/10 ring-1 ring-rose-500/20 text-rose-600 dark:text-rose-400 shrink-0">
              <AlertTriangle className="h-4 w-4" />
            </span>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold tracking-tight text-rose-600 dark:text-rose-400 font-mono-data tabular-nums">
                {studentsAtRisk.length}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                ({criticalCount} com 0h)
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsRiskListExpanded((prev) => !prev)}
              className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-orange-600 dark:text-amber-400 hover:underline cursor-pointer"
            >
              <span>{isRiskListExpanded ? "Ocultar lista rápida" : "Inspecionar pendências"}</span>
              {isRiskListExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Painel Expansível de Alunos em Risco */}
      {isRiskListExpanded && (
        <div className="mt-5 pt-4 border-t border-slate-200/80 dark:border-white/[0.07] animate-scale-up">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-500" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-200">
                Discentes com Débito na Meta Semanal (&lt; 4h)
              </h4>
            </div>
            <span className="text-xs font-mono-data tabular-nums text-slate-500 dark:text-slate-400">
              Total: {studentsAtRisk.length}
            </span>
          </div>

          {studentsAtRisk.length === 0 ? (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 py-3 text-center">
              Todos os discentes cumpriram a meta mínima de 4 horas em dias úteis.
            </p>
          ) : (
            <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200/80 dark:border-white/[0.08] divide-y divide-slate-200/60 dark:divide-white/[0.06] bg-slate-50/50 dark:bg-[#090D16]/50">
              {studentsAtRisk.map((item) => {
                const isCritical = item.status === "critical";
                return (
                  <div
                    key={item.member.id}
                    className="p-3 flex flex-wrap items-center justify-between gap-3 hover:bg-white dark:hover:bg-[#161F30] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <MemberAvatar
                        name={item.member.name}
                        src={item.member.avatarUrl}
                        size="sm"
                        highlight={Boolean(item.member.isTutor)}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {item.member.name}
                          </span>
                          {item.member.matricula && (
                            <span className="text-[11px] font-mono-data tabular-nums text-slate-500 dark:text-slate-400">
                              #{item.member.matricula}
                            </span>
                          )}
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-[10px] font-mono-data tabular-nums font-bold ${
                              isCritical
                                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 ring-1 ring-rose-500/20"
                                : "bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/20"
                            }`}
                          >
                            {isCritical ? "0h 00m" : formatDuration(item.totalSeconds)}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                          {isCritical
                            ? "Sem nenhum check-in registrado em dias úteis"
                            : `Faltam ${formatDuration(item.deficitSeconds)} para atingir 4h`}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onSelectMember?.(item.member.id)}
                      className="btn-secondary !min-h-[34px] !px-3 !py-1 text-2xs"
                    >
                      Ver Histórico
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
