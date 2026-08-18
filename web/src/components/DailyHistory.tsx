import type { DayGroup } from "../lib/aggregate";
import { formatDuration, formatTime } from "../lib/aggregate";

export function DailyHistory({ days }: { days: DayGroup[] }) {
  if (days.length === 0) {
    return <p className="text-muted">Nenhum registro no periodo.</p>;
  }

  return (
    <div className="space-y-4">
      {days.map((day) => (
        <div key={day.key} className="overflow-hidden rounded-2xl border border-line bg-card">
          <div className="flex items-center justify-between bg-navy px-4 py-3">
            <span className="text-sm font-medium capitalize text-white">{day.label}</span>
            <span className="text-sm text-white/70">{formatDuration(day.totalSeconds)}</span>
          </div>
          <table className="w-full text-left text-sm text-ink">
            <tbody>
              {day.entries.map((entry, index) => (
                <tr key={index} className="border-t border-line">
                  <td className="px-4 py-3">{entry.memberName}</td>
                  <td className="px-4 py-3 text-muted">
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
