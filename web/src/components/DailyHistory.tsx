import { CalendarRange, Ban, GraduationCap, CheckCircle2 } from "lucide-react";
import type { DayGroup } from "../lib/aggregate";
import { formatDuration, formatTime } from "../lib/aggregate";

export function DailyHistory({ days }: { days: DayGroup[] }) {
  if (days.length === 0) {
    return (
      <div className="surface-card flex flex-col items-center justify-center p-12 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100/80 border border-slate-200/80 text-slate-500 dark:bg-[#161F30] dark:border-white/[0.08] dark:text-slate-400">
          <CalendarRange className="h-5 w-5" />
        </div>
        <p className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
          Nenhum registro no período
        </p>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
          Nenhuma sessão encontrada para as datas selecionadas.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {days.map((day) => (
        <div key={day.key} className="surface-card overflow-hidden">
          {/* Cabeçalho do Dia */}
          <div className="glass-table-header flex items-center justify-between gap-2 px-4 py-3 sm:px-5">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex h-2 w-2 rounded-full bg-orange-500 shrink-0" />
              <span className="text-sm font-bold capitalize text-slate-900 dark:text-white tracking-tight truncate">
                {day.label}
              </span>
              <span className="hidden sm:inline-block rounded-md bg-slate-200/60 dark:bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-mono-data tabular-nums text-slate-600 dark:text-slate-400">
                {day.entries.length} {day.entries.length === 1 ? "sessão" : "sessões"}
              </span>
            </div>
            <span className="whitespace-nowrap rounded-lg bg-white dark:bg-[#161F30] border border-slate-200/90 dark:border-white/[0.1] px-2.5 py-1 text-xs font-mono-data tabular-nums font-bold text-slate-900 dark:text-white shadow-2xs">
              Total: {formatDuration(day.totalSeconds)}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm text-slate-700 dark:text-slate-200">
              <tbody className="divide-y divide-slate-200/60 dark:divide-white/[0.05]">
                {day.entries.map((entry, index) => (
                  <tr
                    key={index}
                    className={`transition-colors duration-150 ${
                      entry.voided
                        ? "bg-rose-500/[0.02] dark:bg-rose-500/[0.03] hover:bg-rose-500/[0.05]"
                        : "hover:bg-slate-50/90 dark:hover:bg-white/[0.03]"
                    }`}
                  >
                    <td className="px-3.5 py-3 sm:px-5 font-semibold text-slate-900 dark:text-white max-w-[160px] sm:max-w-none">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`truncate ${entry.voided ? "text-slate-500 dark:text-slate-400" : ""}`}>
                          {entry.memberName}
                        </span>
                        {entry.isTutor && (
                          <span
                            title="Tutor do Laboratório"
                            className="inline-flex items-center gap-1 bg-orange-500/10 text-orange-600 dark:text-orange-400 ring-1 ring-orange-500/25 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md select-none"
                          >
                            <GraduationCap className="h-2.5 w-2.5 shrink-0" />
                            <span>TUTOR</span>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-3 sm:px-5 text-slate-500 dark:text-slate-400 font-mono-data tabular-nums text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={entry.voided ? "line-through opacity-60" : ""}>
                          {formatTime(entry.checkIn)}
                          {entry.checkOut && !entry.open ? ` → ${formatTime(entry.checkOut)}` : ""}
                        </span>
                        {entry.voided ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 ring-1 ring-rose-500/20 px-2.5 py-0.5 text-[10px] font-sans font-bold">
                            <Ban className="h-3 w-3 shrink-0" />
                            <span>Anulada — 0h</span>
                          </span>
                        ) : entry.open ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500/20 px-2.5 py-0.5 text-[10px] font-sans font-bold">
                            <span className="relative flex h-2 w-2 items-center justify-center shrink-0">
                              <span className="absolute h-full w-full rounded-full bg-emerald-500 opacity-75 animate-ping" />
                              <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            </span>
                            <span>Em aberto</span>
                          </span>
                        ) : (
                          <span className="hidden sm:inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-[#161F30] px-1.5 py-0.5 text-[10px] font-sans font-medium text-slate-500 dark:text-slate-400">
                            <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500 shrink-0" />
                            <span>Concluída</span>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3.5 py-3 sm:px-5 text-right font-mono-data tabular-nums font-bold text-xs sm:text-sm">
                      {entry.voided ? (
                        <span className="text-rose-600/80 dark:text-rose-400/80 text-xs font-semibold">
                          0h 00m
                        </span>
                      ) : entry.open ? (
                        <span className="text-emerald-600 dark:text-emerald-400">
                          {formatDuration(entry.seconds)}
                        </span>
                      ) : (
                        <span className="text-slate-900 dark:text-white">
                          {formatDuration(entry.seconds)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
