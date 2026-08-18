import type { DayGroup } from "../lib/aggregate";
import { formatDuration, formatTime } from "../lib/aggregate";

export function DailyHistory({ days }: { days: DayGroup[] }) {
  if (days.length === 0) {
    return <p className="text-white/40">Nenhum registro no periodo.</p>;
  }

  return (
    <div className="space-y-4">
      {days.map((day) => (
        <div key={day.key} className="overflow-hidden rounded-2xl bg-surface">
          <div className="flex items-center justify-between bg-black/20 px-4 py-3">
            <span className="text-sm font-medium capitalize text-white">{day.label}</span>
            <span className="text-sm text-white/60">{formatDuration(day.totalSeconds)}</span>
          </div>
          <table className="w-full text-left text-sm text-white">
            <tbody>
              {day.entries.map((entry, index) => (
                <tr key={index} className="border-t border-white/5">
                  <td className="px-4 py-3">{entry.memberName}</td>
                  <td className="px-4 py-3 text-white/60">
                    {formatTime(entry.checkIn)} ate {entry.open ? "agora" : formatTime(entry.checkOut!)}
                  </td>
                  <td className="px-4 py-3 text-right">{formatDuration(entry.seconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
