import type { DayGroup } from "../lib/aggregate";
import { formatDuration, formatTime } from "../lib/aggregate";

export function DailyHistory({ days }: { days: DayGroup[] }) {
  if (days.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border border-white/80 bg-white/70 backdrop-blur-xl p-12 text-center shadow-apple">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-xl text-blue-600">
          📅
        </div>
        <p className="text-base font-bold text-slate-900">Nenhum registro no período</p>
        <p className="text-sm text-slate-500 mt-1">Nenhuma sessão encontrada para as datas selecionadas.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {days.map((day) => (
        <div
          key={day.key}
          className="overflow-hidden rounded-3xl border border-white/80 bg-white/75 backdrop-blur-xl shadow-apple transition-all duration-300"
        >
          {/* Cabeçalho do Dia estilo Apple Glass */}
          <div className="flex items-center justify-between gap-2 bg-gradient-to-r from-blue-500/[0.08] via-indigo-500/[0.04] to-transparent border-b border-black/[0.05] px-4 py-3 sm:px-5">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-blue-500" />
              <span className="text-xs sm:text-sm font-bold capitalize text-slate-900 tracking-tight">
                {day.label}
              </span>
            </div>
            <span className="whitespace-nowrap rounded-full bg-blue-500/10 border border-blue-500/20 px-2.5 py-0.5 sm:px-3 sm:py-1 text-2xs sm:text-xs font-bold text-blue-900 shadow-2xs">
              Total: {formatDuration(day.totalSeconds)}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm text-slate-800">
              <tbody className="divide-y divide-black/[0.04]">
                {day.entries.map((entry, index) => (
                  <tr
                    key={index}
                    className="transition-colors duration-150 hover:bg-white/90"
                  >
                    <td className="px-3.5 py-3 sm:px-5 font-semibold text-slate-900 truncate max-w-[140px] sm:max-w-none">
                      {entry.memberName}
                    </td>
                    <td className="px-2 py-3 sm:px-5 text-slate-500 text-2xs sm:text-xs">
                      {formatTime(entry.checkIn)} às{" "}
                      {entry.voided ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10.5px] font-semibold text-amber-800">
                          ⚠️ anulada
                        </span>
                      ) : entry.open ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 border border-emerald-500/25 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-700 shadow-2xs">
                          <span className="relative flex h-1.5 w-1.5 shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                          </span>
                          em andamento
                        </span>
                      ) : (
                        formatTime(entry.checkOut!)
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3.5 py-3 sm:px-5 text-right font-mono font-bold text-slate-900 tabular-nums text-xs sm:text-sm">
                      {entry.voided ? (
                        <span className="text-slate-400 text-xs">—</span>
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
