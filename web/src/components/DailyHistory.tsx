import type { DayGroup } from "../lib/aggregate";
import { formatDuration, formatTime } from "../lib/aggregate";

export function DailyHistory({ days }: { days: DayGroup[] }) {
  if (days.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border border-[#E5E2DC] bg-white/80 p-12 text-center shadow-xs">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FAF9F5] border border-[#E5E2DC] text-xl text-[#706E6A]">
          📅
        </div>
        <p className="font-editorial text-lg text-[#171715]">Nenhum registro no período</p>
        <p className="text-xs sm:text-sm text-[#706E6A] mt-1 max-w-xs">
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
          className="overflow-hidden rounded-3xl border border-[#E5E2DC] bg-white/85 backdrop-blur-xl shadow-[0_4px_24px_rgba(23,23,21,0.03)] transition-all duration-300"
        >
          {/* Cabeçalho do Dia estilo Claude Paper */}
          <div className="flex items-center justify-between gap-2 bg-[#FAF9F5]/90 border-b border-[#E5E2DC] px-4 py-3 sm:px-5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-2 w-2 rounded-full bg-[#C15F3D]" />
              <span className="font-editorial font-serif text-sm sm:text-base font-normal capitalize text-[#171715] tracking-tight">
                {day.label}
              </span>
            </div>
            <span className="whitespace-nowrap rounded-full bg-white border border-[#E5E2DC] px-3 py-1 text-xs font-mono-data font-semibold text-[#171715] shadow-2xs">
              Total: {formatDuration(day.totalSeconds)}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm text-[#171715]">
              <tbody className="divide-y divide-[#E5E2DC]/70">
                {day.entries.map((entry, index) => (
                  <tr
                    key={index}
                    className="transition-colors duration-150 hover:bg-[#FAF9F5]"
                  >
                    <td className="px-3.5 py-3 sm:px-5 font-sans font-medium text-[#171715] truncate max-w-[140px] sm:max-w-none">
                      {entry.memberName}
                    </td>
                    <td className="px-2 py-3 sm:px-5 text-[#706E6A] font-mono-data text-xs">
                      {formatTime(entry.checkIn)} às{" "}
                      {entry.voided ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#FAF5F0] border border-[#F0DCD3] px-2 py-0.5 text-[10px] font-medium text-[#C15F3D]">
                          ⚠️ anulada
                        </span>
                      ) : entry.open ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 text-[10px] font-medium text-emerald-800 shadow-2xs">
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
                    <td className="whitespace-nowrap px-3.5 py-3 sm:px-5 text-right font-mono-data font-semibold text-[#171715] text-xs sm:text-sm">
                      {entry.voided ? (
                        <span className="text-[#706E6A]/50 text-xs">—</span>
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
