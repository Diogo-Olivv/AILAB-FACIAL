import type { MemberTotal } from "../lib/aggregate";
import { formatDuration } from "../lib/aggregate";

export function TotalsTable({ rows }: { rows: MemberTotal[] }) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-line bg-card p-12 text-center shadow-xs">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-navy/5 text-xl">
          📋
        </div>
        <p className="text-base font-medium text-ink">Nenhum registro no período</p>
        <p className="text-sm text-muted mt-1">Selecione outro período ou verifique se há sessões registradas.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-card shadow-sm transition-all">
      <table className="w-full text-left text-sm text-ink">
        <thead className="sticky top-0 z-10 bg-navy text-white/90">
          <tr>
            <th className="px-4 py-3.5 font-semibold sm:px-5">Integrante</th>
            <th className="hidden px-4 py-3.5 font-semibold sm:table-cell sm:px-5">Matrícula</th>
            <th className="hidden px-4 py-3.5 font-semibold sm:table-cell sm:px-5 text-center">Sessões</th>
            <th className="whitespace-nowrap px-4 py-3.5 font-semibold sm:px-5">Total</th>
            <th className="whitespace-nowrap px-4 py-3.5 font-semibold sm:px-5">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line/60">
          {rows.map((row) => (
            <tr
              key={row.member.id}
              className="transition-colors duration-150 hover:bg-navy/[0.03]"
            >
              <td className="px-4 py-3.5 font-medium sm:px-5 text-ink">{row.member.name}</td>
              <td className="hidden px-4 py-3.5 text-muted sm:table-cell sm:px-5">
                {row.member.matricula ?? "-"}
              </td>
              <td className="hidden px-4 py-3.5 text-muted sm:table-cell sm:px-5 text-center">
                {row.sessionCount}
              </td>
              <td className="whitespace-nowrap px-4 py-3.5 font-medium sm:px-5">
                {formatDuration(row.totalSeconds)}
              </td>
              <td className="px-4 py-3.5 sm:px-5">
                {row.present ? (
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-green/15 px-2.5 py-1 text-xs font-semibold text-green ring-1 ring-green/20">
                    <span className="h-2 w-2 rounded-full bg-green animate-pulse" />
                    No lab
                  </span>
                ) : (
                  <span className="inline-flex items-center whitespace-nowrap rounded-full bg-muted/10 px-2.5 py-1 text-xs font-medium text-muted">
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
