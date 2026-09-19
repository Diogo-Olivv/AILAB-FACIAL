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
    <div className="rounded-3xl border border-[#E5E2DC] dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl p-5 sm:p-6 shadow-[0_4px_24px_rgba(23,23,21,0.03)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)] transition-all duration-300">
      {/* Cabeçalho do Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E5E2DC]/80 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#FAF5F0] dark:bg-amber-950/40 border border-[#F0DCD3] dark:border-amber-800/40 text-[#C15F3D] dark:text-amber-400 shadow-2xs">
            <TrendingUp className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-editorial text-base sm:text-lg font-normal text-[#171715] dark:text-slate-100">
                Insights Analíticos da Tutoria
              </h3>
              <span className="rounded-md bg-[#FAF9F5] dark:bg-slate-800 border border-[#E5E2DC] dark:border-slate-700 px-2 py-0.5 text-2xs font-mono-data font-semibold text-[#706E6A] dark:text-slate-300">
                Dias Úteis (Seg–Sex)
              </span>
            </div>
            <p className="text-xs text-[#706E6A] dark:text-slate-400 font-sans mt-0.5">
              Auditoria de retenção, frequência semanal e vigilância de evasão discente.
            </p>
          </div>
        </div>

        {/* Indicador de Status Geral */}
        <div className="flex items-center gap-2">
          {studentsAtRisk.length === 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" />
              100% dos Alunos na Meta
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-3 py-1 text-xs font-medium text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              {studentsAtRisk.length} {studentsAtRisk.length === 1 ? "aluno em risco" : "alunos em risco"}
            </span>
          )}
        </div>
      </div>

      {/* Grid de 4 Indicadores Principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-5">
        {/* KPI 1: Frequência & Retenção */}
        <div className="rounded-2xl border border-[#E5E2DC] dark:border-slate-800 bg-[#FAF9F5]/70 dark:bg-slate-800/50 p-4 transition-all hover:bg-white dark:hover:bg-slate-800">
          <div className="flex items-center justify-between text-[#706E6A] dark:text-slate-400 mb-2">
            <span className="text-xs font-medium font-sans">Retenção em Dias Úteis</span>
            <Users className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono-data text-2xl font-bold text-[#171715] dark:text-slate-100">
              {Math.min(100, Math.max(0, insights.retentionRate))}%
            </span>
            <span className="text-2xs text-[#706E6A] dark:text-slate-400 font-sans">
              ({insights.activeMembersCount}/{insights.totalMembersCount} discentes)
            </span>
          </div>
          <div className="mt-2 text-2xs text-[#706E6A] dark:text-slate-400 font-sans flex items-center gap-1">
            <span>Adesão semanal ativa</span>
          </div>
        </div>

        {/* KPI 2: Média Diária de Permanência */}
        <div className="rounded-2xl border border-[#E5E2DC] dark:border-slate-800 bg-[#FAF9F5]/70 dark:bg-slate-800/50 p-4 transition-all hover:bg-white dark:hover:bg-slate-800">
          <div className="flex items-center justify-between text-[#706E6A] dark:text-slate-400 mb-2">
            <span className="text-xs font-medium font-sans">Média por Aluno Ativo</span>
            <Clock className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono-data text-2xl font-bold text-[#171715] dark:text-slate-100">
              {formatDuration(insights.averageStayPerActiveSeconds)}
            </span>
          </div>
          <div className="mt-2 text-2xs text-[#706E6A] dark:text-slate-400 font-sans flex items-center gap-1">
            <span>Total: {formatDuration(insights.totalWeekdaySeconds)} em dias úteis</span>
          </div>
        </div>

        {/* KPI 3: Distribuição por Turno & Pico */}
        <div className="rounded-2xl border border-[#E5E2DC] dark:border-slate-800 bg-[#FAF9F5]/70 dark:bg-slate-800/50 p-4 transition-all hover:bg-white dark:hover:bg-slate-800">
          <div className="flex items-center justify-between text-[#706E6A] dark:text-slate-400 mb-2">
            <span className="text-xs font-medium font-sans">Turno Mais Frequente</span>
            <SunMedium className="h-4 w-4 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono-data text-2xl font-bold text-[#171715] dark:text-slate-100">
              {shifts.peakShift}
            </span>
          </div>
          {/* Mini Barra de Proporção de Turnos */}
          <div className="mt-2.5">
            <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex">
              <div
                style={{ width: `${morningPct}%` }}
                className="bg-amber-400"
                title={`Manhã: ${morningPct}%`}
              />
              <div
                style={{ width: `${afternoonPct}%` }}
                className="bg-orange-500"
                title={`Tarde: ${afternoonPct}%`}
              />
              <div
                style={{ width: `${eveningPct}%` }}
                className="bg-indigo-500"
                title={`Noite: ${eveningPct}%`}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-[#706E6A] dark:text-slate-400 font-mono-data mt-1 px-0.5">
              <span>M: {morningPct}%</span>
              <span>T: {afternoonPct}%</span>
              <span>N: {eveningPct}%</span>
            </div>
          </div>
        </div>

        {/* KPI 4: Alunos em Risco de Evasão */}
        <div className="rounded-2xl border border-[#E5E2DC] dark:border-slate-800 bg-[#FAF9F5]/70 dark:bg-slate-800/50 p-4 transition-all hover:bg-white dark:hover:bg-slate-800">
          <div className="flex items-center justify-between text-[#706E6A] dark:text-slate-400 mb-2">
            <span className="text-xs font-medium font-sans">Alunos Abaixo da Meta (&lt; 4h)</span>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono-data text-2xl font-bold text-destructive">
              {studentsAtRisk.length}
            </span>
            <span className="text-2xs text-[#706E6A] dark:text-slate-400 font-sans">
              ({criticalCount} sem presença)
            </span>
          </div>
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setIsRiskListExpanded((prev) => !prev)}
              className="text-2xs font-semibold text-[#C15F3D] dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>{isRiskListExpanded ? "Ocultar auditoria" : "Auditar alunos em risco"}</span>
              {isRiskListExpanded ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Painel Expansível de Alunos em Risco de Evasão / Estagnação */}
      {isRiskListExpanded && (
        <div className="mt-5 pt-4 border-t border-[#E5E2DC] dark:border-slate-800 animate-scale-up">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <h4 className="font-sans text-xs font-bold text-[#171715] dark:text-slate-200">
                Auditoria de Discentes com Débito na Carga Horária Obrigatória (&lt; 4h)
              </h4>
            </div>
            <span className="text-2xs font-mono-data text-[#706E6A] dark:text-slate-400">
              Total: {studentsAtRisk.length} discente(s)
            </span>
          </div>

          {studentsAtRisk.length === 0 ? (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 py-3 text-center">
              Parabéns! Todos os discentes cumpriram a meta mínima de 4 horas em dias úteis.
            </p>
          ) : (
            <div className="max-h-60 overflow-y-auto rounded-2xl border border-[#E5E2DC] dark:border-slate-800 divide-y divide-[#E5E2DC] dark:divide-slate-800 bg-[#FAF9F5]/40 dark:bg-slate-900/40">
              {studentsAtRisk.map((item) => {
                const isCritical = item.status === "critical";
                return (
                  <div
                    key={item.member.id}
                    className="p-3 flex flex-wrap items-center justify-between gap-3 hover:bg-white dark:hover:bg-slate-800/80 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-xl text-xs font-mono-data font-bold ${
                          isCritical
                            ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 border border-red-200 dark:border-red-900"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-900"
                        }`}
                      >
                        {isCritical ? "0h" : "<4h"}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-[#171715] dark:text-slate-100">
                            {item.member.name}
                          </span>
                          {item.member.matricula && (
                            <span className="text-[11px] font-mono-data text-[#706E6A] dark:text-slate-400">
                              #{item.member.matricula}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#706E6A] dark:text-slate-400 font-sans">
                          {isCritical
                            ? "Sem nenhum check-in em dias úteis no período"
                            : `Acumulado: ${formatDuration(item.totalSeconds)} (déficit de ${formatDuration(item.deficitSeconds)})`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onSelectMember?.(item.member.id)}
                        className="rounded-xl border border-[#E5E2DC] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-2xs font-sans font-medium text-[#171715] dark:text-slate-200 hover:border-[#C15F3D]/40 hover:bg-[#FAF9F5] dark:hover:bg-slate-700 transition-colors cursor-pointer"
                      >
                        Ver Histórico
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
