import { useMemo, useState } from "react";
import type { MemberTotal } from "../lib/aggregate";
import { formatDuration } from "../lib/aggregate";

type SortField = "name" | "matricula" | "sessions" | "duration" | "status";
type SortDirection = "asc" | "desc";

const AVATAR_GRADIENTS = [
  "from-blue-500 to-indigo-600 text-white shadow-blue-500/25",
  "from-purple-500 to-pink-600 text-white shadow-purple-500/25",
  "from-emerald-500 to-teal-600 text-white shadow-emerald-500/25",
  "from-amber-500 to-orange-600 text-white shadow-amber-500/25",
  "from-rose-500 to-red-600 text-white shadow-rose-500/25",
  "from-cyan-500 to-blue-600 text-white shadow-cyan-500/25",
  "from-violet-600 to-purple-700 text-white shadow-violet-500/25",
  "from-teal-500 to-emerald-600 text-white shadow-teal-500/25",
];

function getAvatarStyle(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

interface Props {
  rows: MemberTotal[];
  onSelectMember?: (row: MemberTotal) => void;
}

export function TotalsTable({ rows, onSelectMember }: Props) {
  const [sortField, setSortField] = useState<SortField>("duration");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection(field === "name" || field === "matricula" ? "asc" : "desc");
    }
  };

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "name":
          comparison = a.member.name.localeCompare(b.member.name);
          break;
        case "matricula":
          comparison = (a.member.matricula ?? "").localeCompare(b.member.matricula ?? "");
          break;
        case "sessions":
          comparison = a.sessionCount - b.sessionCount;
          break;
        case "duration":
          comparison = a.totalSeconds - b.totalSeconds;
          break;
        case "status":
          comparison = (a.present ? 1 : 0) - (b.present ? 1 : 0);
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [rows, sortField, sortDirection]);

  if (sortedRows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-line bg-card p-12 text-center shadow-xs">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-navy/5 text-xl">
          📋
        </div>
        <p className="text-base font-bold text-ink">Nenhum integrante encontrado</p>
        <p className="text-sm text-muted mt-1">
          Verifique o termo de busca ou altere o período selecionado.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1 text-xs text-muted font-semibold">
        <span>
          Exibindo <strong>{sortedRows.length}</strong> integrantes (clique no nome para ver sessões detalhadas)
        </span>
      </div>

      <div className="overflow-hidden rounded-3xl border border-white/80 bg-white/70 backdrop-blur-xl shadow-apple transition-all duration-300 sm:overflow-x-auto">
        <table className="w-full table-fixed text-left text-sm text-ink" aria-label="Tabela de permanência dos integrantes">
          <thead className="sticky top-0 z-10 glass-table-header select-none">
            <tr>
              <th
                scope="col"
                aria-sort={sortField === "name" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                onClick={() => handleSort("name")}
                className="w-[48%] sm:w-auto px-3 py-3 font-semibold text-muted text-xs sm:px-5 sm:py-3.5 cursor-pointer hover:text-ink transition-colors"
              >
                <div className="flex items-center gap-1">
                  <span>Integrante</span>
                  <span className="text-2xs opacity-60">
                    {sortField === "name" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                  </span>
                </div>
              </th>
              <th
                scope="col"
                aria-sort={sortField === "matricula" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                onClick={() => handleSort("matricula")}
                className="hidden sm:table-cell sm:w-36 px-4 py-3.5 font-semibold text-muted text-xs sm:px-5 cursor-pointer hover:text-ink transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span>Matrícula</span>
                  <span className="text-2xs opacity-60">
                    {sortField === "matricula" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                  </span>
                </div>
              </th>
              <th
                scope="col"
                aria-sort={sortField === "sessions" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                onClick={() => handleSort("sessions")}
                className="hidden sm:table-cell sm:w-28 px-4 py-3.5 font-semibold text-muted text-xs sm:px-5 text-center cursor-pointer hover:text-ink transition-colors"
              >
                <div className="flex items-center justify-center gap-1.5">
                  <span>Sessões</span>
                  <span className="text-2xs opacity-60">
                    {sortField === "sessions" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                  </span>
                </div>
              </th>
              <th
                scope="col"
                aria-sort={sortField === "duration" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                onClick={() => handleSort("duration")}
                className="w-[26%] sm:w-36 whitespace-nowrap px-2 py-3 sm:px-5 sm:py-3.5 font-semibold text-muted text-xs cursor-pointer hover:text-ink transition-colors text-right sm:text-left"
              >
                <div className="flex items-center justify-end sm:justify-start gap-1">
                  <span className="hidden sm:inline">Total Permanência</span>
                  <span className="sm:hidden">Tempo</span>
                  <span className="text-2xs opacity-60">
                    {sortField === "duration" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                  </span>
                </div>
              </th>
              <th
                scope="col"
                aria-sort={sortField === "status" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                onClick={() => handleSort("status")}
                className="w-[26%] sm:w-32 whitespace-nowrap px-2 py-3 sm:px-5 sm:py-3.5 font-semibold text-muted text-xs cursor-pointer hover:text-ink transition-colors text-right sm:text-left"
              >
                <div className="flex items-center justify-end sm:justify-start gap-1">
                  <span>Status</span>
                  <span className="text-2xs opacity-60">
                    {sortField === "status" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                  </span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.04]">
            {sortedRows.map((row) => (
              <tr
                key={row.member.id}
                onClick={() => onSelectMember && onSelectMember(row)}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectMember && onSelectMember(row);
                  }
                }}
                className="group transition-all duration-150 hover:bg-white/90 hover:backdrop-blur-md cursor-pointer focus-visible:bg-black/[0.03] focus-visible:outline-2 focus-visible:outline-navy"
                role="button"
                aria-label={`Ver sessões e histórico de ${row.member.name}`}
              >
                <td className="px-2.5 py-2.5 sm:px-5 sm:py-3.5 text-ink overflow-hidden">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    {/* Avatar estilo Apple com gradiente dinâmico vibrante */}
                    <div
                      className={`flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${getAvatarStyle(row.member.name)} text-2xs sm:text-xs font-bold ring-2 ring-white shadow-xs transition-transform duration-200 group-hover:scale-105`}
                    >
                      {row.member.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <span className="font-semibold text-ink group-hover:text-navy transition-colors block text-xs sm:text-sm truncate">
                        {row.member.name}
                      </span>
                      {row.member.matricula && (
                        <span className="text-2xs text-muted block sm:hidden font-mono truncate">
                          {row.member.matricula}
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="hidden px-4 py-3.5 text-muted sm:table-cell sm:px-5 font-mono text-xs">
                  {row.member.matricula ?? "—"}
                </td>
                <td className="hidden px-4 py-3.5 text-ink sm:table-cell sm:px-5 text-center font-medium">
                  {row.sessionCount}
                </td>
                <td className="whitespace-nowrap px-2 py-2.5 sm:px-5 sm:py-3.5 text-right sm:text-left text-xs sm:text-sm tabular-nums">
                  {row.present ? (
                    <span className="font-mono font-extrabold text-emerald-600">
                      {formatDuration(row.totalSeconds, true)}
                    </span>
                  ) : (
                    <span className="font-semibold text-ink/80">
                      {formatDuration(row.totalSeconds)}
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-2 py-2.5 sm:px-5 sm:py-3.5 text-right sm:text-left">
                  {row.present ? (
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 text-2xs sm:text-xs font-bold text-emerald-800 shadow-[0_2px_6px_rgba(16,185,129,0.12)] backdrop-blur-md">
                      <span className="relative flex h-2 w-2 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                      </span>
                      <span>Presente</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-slate-500/[0.06] border border-slate-400/20 px-2.5 py-1 text-2xs sm:text-xs font-medium text-slate-500">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400/40 shrink-0" />
                      <span>Ausente</span>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
