import type { MemberTotal } from "../lib/aggregate";
import { formatDuration } from "../lib/aggregate";

export function TotalsTable({ rows }: { rows: MemberTotal[] }) {
  if (rows.length === 0) {
    return <p className="text-muted">Nenhum registro no período.</p>;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card">
      <table className="w-full text-left text-sm text-ink">
        <thead className="bg-navy text-white/80">
          <tr>
            <th className="px-3 py-3 font-medium sm:px-4">Integrante</th>
            <th className="hidden px-3 py-3 font-medium sm:table-cell sm:px-4">Matrícula</th>
            <th className="hidden px-3 py-3 font-medium sm:table-cell sm:px-4">Sessões</th>
            <th className="px-3 py-3 font-medium sm:px-4">Total</th>
            <th className="px-3 py-3 font-medium sm:px-4">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.member.id} className="border-t border-line">
              <td className="px-3 py-3 sm:px-4">{row.member.name}</td>
              <td className="hidden px-3 py-3 text-muted sm:table-cell sm:px-4">
                {row.member.matricula ?? "-"}
              </td>
              <td className="hidden px-3 py-3 text-muted sm:table-cell sm:px-4">{row.sessionCount}</td>
              <td className="px-3 py-3 sm:px-4">{formatDuration(row.totalSeconds)}</td>
              <td className="px-3 py-3 sm:px-4">
                {row.present ? (
                  <span className="rounded-full bg-green/15 px-2 py-1 text-xs font-medium text-green">
                    No lab
                  </span>
                ) : (
                  <span className="rounded-full bg-muted/15 px-2 py-1 text-xs font-medium text-muted">
                    Fora
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
