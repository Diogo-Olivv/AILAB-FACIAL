import type { MemberTotal } from "../lib/aggregate";
import { formatDuration } from "../lib/aggregate";

export function TotalsTable({ rows }: { rows: MemberTotal[] }) {
  if (rows.length === 0) {
    return <p className="text-white/40">Nenhum registro no periodo.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-2xl bg-surface">
      <table className="w-full text-left text-sm text-white">
        <thead className="bg-black/20 text-white/60">
          <tr>
            <th className="px-4 py-3">Integrante</th>
            <th className="px-4 py-3">Matricula</th>
            <th className="px-4 py-3">Sessoes</th>
            <th className="px-4 py-3">Total</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.member.id} className="border-t border-white/5">
              <td className="px-4 py-3">{row.member.name}</td>
              <td className="px-4 py-3 text-white/60">{row.member.matricula ?? "-"}</td>
              <td className="px-4 py-3 text-white/60">{row.sessionCount}</td>
              <td className="px-4 py-3">{formatDuration(row.totalSeconds)}</td>
              <td className="px-4 py-3">
                {row.present ? (
                  <span className="rounded-full bg-green-500/20 px-2 py-1 text-xs text-green-400">
                    No lab
                  </span>
                ) : (
                  <span className="text-xs text-white/40">Fora</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
