import type { MemberTotal } from "../lib/aggregate";
import { formatDuration } from "../lib/aggregate";

export function TotalsTable({ rows }: { rows: MemberTotal[] }) {
  if (rows.length === 0) {
    return <p className="text-muted">Nenhum registro no periodo.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-card">
      <table className="w-full text-left text-sm text-ink">
        <thead className="bg-navy text-white/80">
          <tr>
            <th className="px-4 py-3 font-medium">Integrante</th>
            <th className="px-4 py-3 font-medium">Matricula</th>
            <th className="px-4 py-3 font-medium">Sessoes</th>
            <th className="px-4 py-3 font-medium">Total</th>
            <th className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.member.id} className="border-t border-line">
              <td className="px-4 py-3">{row.member.name}</td>
              <td className="px-4 py-3 text-muted">{row.member.matricula ?? "-"}</td>
              <td className="px-4 py-3 text-muted">{row.sessionCount}</td>
              <td className="px-4 py-3">{formatDuration(row.totalSeconds)}</td>
              <td className="px-4 py-3">
                {row.present ? (
                  <span className="rounded-full bg-green/15 px-2 py-1 text-xs font-medium text-green">
                    No lab
                  </span>
                ) : (
                  <span className="text-xs text-muted">Fora</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
