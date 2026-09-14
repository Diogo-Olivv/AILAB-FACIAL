import type { DayGroup } from "../lib/aggregate";
import { formatDuration, formatTime } from "../lib/aggregate";

export function DailyHistory({ days }: { days: DayGroup[] }) {
  if (days.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-line bg-card p-12 text-center shadow-xs">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-navy/5 text-xl">
          📅
        </div>
        <p className="text-base font-medium text-ink">Nenhum registro no período</p>
        <p className="text-sm text-muted mt-1">Nenhuma sessão encontrada para as datas selecionadas.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {days.map((day) => (
        <div
          key={day.key}
          className="overflow-hidden rounded-2xl border border-line bg-card shadow-xs transition-shadow duration-200 hover:shadow-md"
        >
          <div className="flex items-center justify-between gap-2 bg-navy px-4 py-3 sm:px-5">
            <span className="text-sm font-semibold capitalize text-white tracking-wide">
              {day.label}
            </span>
            <span className="whitespace-nowrap rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/90">
              Total: {formatDuration(day.totalSeconds)}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm text-ink">
              <tbody className="divide-y divide-line/60">
                {day.entries.map((entry, index) => (
                  <tr
                    key={index}
                    className="transition-colors duration-150 hover:bg-navy/[0.03]"
                  >
                    <td className="px-2.5 py-2.5 sm:px-5 sm:py-3 font-semibold text-ink truncate max-w-[130px] sm:max-w-none">
                      {entry.memberName}
                    </td>
                    <td className="px-2 py-2.5 sm:px-5 sm:py-3 text-muted text-2xs sm:text-xs">
                      {formatTime(entry.checkIn)} às{" "}
                      {entry.voided ? (
                        <span className="inline-flex items-center gap-1 rounded bg-warn/10 px-1.5 py-0.5 text-2xs font-semibold text-warn">
                          ⚠️ anulada
                        </span>
                      ) : entry.open ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green/15 px-2 py-0.5 text-2xs font-bold text-green">
                          <span className="h-1.5 w-1.5 rounded-full bg-green animate-pulse" />
                          em andamento
                        </span>
                      ) : (
                        formatTime(entry.checkOut!)
                      )}
                    </td>
                    <td className="whitespace-nowrap px-2.5 py-2.5 sm:px-5 sm:py-3 text-right font-bold text-navy tabular-nums text-xs sm:text-sm">
                      {entry.voided ? (
                        <span className="text-muted/50 text-xs">—</span>
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
