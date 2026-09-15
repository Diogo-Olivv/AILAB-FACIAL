import type { DayGroup } from "../lib/aggregate";
import { formatDuration, formatTime } from "../lib/aggregate";

export function DailyHistory({ days }: { days: DayGroup[] }) {
  if (days.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border border-[#E5E2DC] bg-white/80 p-12 text-center shadow-xs dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FAF9F5] border border-[#E5E2DC] text-xl text-[#706E6A] dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400">
          📅
        </div>
        <p className="font-editorial text-lg text-[#171715] dark:text-slate-100">Nenhum registro no período</p>
        <p className="text-xs sm:text-sm text-[#706E6A] dark:text-slate-400 mt-1 max-w-xs">
          Nenhuma sessão encontrada para as datas selecionadas.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {days.map((day) => (
        <div
          key={day.key}
          className="overflow-hidden rounded-3xl border border-[#E5E2DC] bg-white/85 backdrop-blur-xl shadow-[0_4px_24px_rgba(23,23,21,0.03)] dark:border-slate-800 dark:bg-slate-900/85 dark:shadow-[0_4px_24px_rgba(0,0,0,0.3)] transition-all duration-300"
        >
          {/* Cabeçalho do Dia com Identidade AILAB */}
          <div className="flex items-center justify-between gap-2 bg-gradient-to-r from-orange-50/60 via-[#FAF9F5]/90 to-transparent dark:from-slate-800/80 dark:via-slate-800/60 dark:to-slate-900 border-b border-[#E5E2DC] dark:border-slate-800 px-4 py-3 sm:px-5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-2.5 w-2.5 rounded-full bg-[#C15F3D] shadow-xs" />
              <span className="font-editorial font-serif text-sm sm:text-base font-medium capitalize text-[#171715] dark:text-slate-100 tracking-tight">
                {day.label}
              </span>
            </div>
            <span className="whitespace-nowrap rounded-full bg-white dark:bg-slate-800 border border-orange-200/90 dark:border-slate-700 px-3 py-1 text-xs font-mono-data font-bold text-[#C15F3D] dark:text-amber-300 shadow-2xs">
              Total: {formatDuration(day.totalSeconds)}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm text-[#171715] dark:text-slate-100">
              <tbody className="divide-y divide-[#E5E2DC]/70 dark:divide-slate-800/70">
                {day.entries.map((entry, index) => (
                  <tr
                    key={index}
                    className="transition-colors duration-150 hover:bg-[#FAF9F5] dark:hover:bg-slate-800/50"
                  >
                    <td className="px-3.5 py-3 sm:px-5 font-sans font-medium text-[#171715] dark:text-slate-100 truncate max-w-[140px] sm:max-w-none">
                      {entry.memberName}
                    </td>
                    <td className="px-2 py-3 sm:px-5 text-[#706E6A] dark:text-slate-400 font-mono-data text-xs">
                      {formatTime(entry.checkIn)} às{" "}
                      {entry.voided ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#FAF5F0] dark:bg-amber-950/40 border border-[#F0DCD3] dark:border-amber-800/50 px-2 py-0.5 text-[10px] font-medium text-[#C15F3D] dark:text-amber-400">
                          ⚠️ anulada
                        </span>
                      ) : entry.open ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 text-white dark:bg-emerald-950/80 dark:text-emerald-300 dark:border dark:border-emerald-700/80 px-2.5 py-0.5 text-[10px] font-bold shadow-2xs">
                          <span className="relative flex h-1.5 w-1.5 shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white dark:bg-emerald-400" />
                          </span>
                          em andamento
                        </span>
                      ) : (
                        formatTime(entry.checkOut!)
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3.5 py-3 sm:px-5 text-right font-mono-data font-semibold text-[#171715] dark:text-slate-200 text-xs sm:text-sm">
                      {entry.voided ? (
                        <span className="text-[#706E6A]/50 dark:text-slate-500 text-xs">—</span>
                      ) : (
                        formatDuration(entry.seconds)
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
