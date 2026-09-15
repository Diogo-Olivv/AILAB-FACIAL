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

export function getAvatarStyle(name: string): string {
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
      <div className="flex flex-col items-center justify-center rounded-3xl border border-[#E5E2DC] bg-white/80 p-12 text-center shadow-xs dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FAF9F5] border border-[#E5E2DC] text-xl text-[#706E6A] dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400">
          📋
        </div>
        <p className="font-editorial text-lg text-[#171715] dark:text-slate-100">Nenhum integrante encontrado</p>
        <p className="text-xs sm:text-sm text-[#706E6A] dark:text-slate-400 mt-1 max-w-xs">
          Verifique o termo de busca ou altere o período selecionado no topo da página.
        </p>
      </div>
    );
  }

  const isDurationDesc = sortField === "duration" && sortDirection === "desc";

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between px-1 text-xs text-[#706E6A] dark:text-slate-400 font-sans">
        <div className="inline-flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-100/80 dark:bg-orange-950/60 border border-orange-200 dark:border-orange-800/60 px-2.5 py-0.5 font-mono-data text-xs font-bold text-[#C15F3D] dark:text-orange-300">
            {sortedRows.length} integrantes
          </span>
          <span className="hidden sm:inline text-xs text-[#706E6A] dark:text-slate-400">
            (clique no nome para abrir o histórico detalhado)
          </span>
        </div>
        {isDurationDesc && (
          <span className="hidden sm:inline-flex items-center gap-1 text-2xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400 bg-amber-100/80 dark:bg-amber-950/40 border border-amber-300/80 dark:border-amber-800/50 px-2.5 py-0.5 rounded-full shadow-2xs">
            🏆 Ranking por Permanência
          </span>
        )}
      </div>

      <div className="overflow-hidden rounded-3xl border border-[#E5E2DC] bg-white/85 backdrop-blur-xl shadow-[0_4px_24px_rgba(23,23,21,0.03)] dark:border-slate-800 dark:bg-slate-900/85 dark:shadow-[0_4px_24px_rgba(0,0,0,0.3)] transition-all duration-300 sm:overflow-x-auto">
        <table className="w-full table-fixed text-left text-sm text-[#171715] dark:text-slate-100" aria-label="Tabela de permanência dos integrantes">
          <thead className="sticky top-0 z-10 glass-table-header select-none border-b border-[#E5E2DC] dark:border-slate-800 dark:bg-slate-900/90">
            <tr>
              <th
                scope="col"
                aria-sort={sortField === "name" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                onClick={() => handleSort("name")}
                className="w-[45%] sm:w-auto px-3 py-3 sm:px-5 sm:py-3.5 font-sans font-semibold text-[#706E6A] dark:text-slate-400 text-[11px] uppercase tracking-wider cursor-pointer hover:text-[#171715] dark:hover:text-slate-200 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span>Integrante</span>
                  <span className="text-2xs opacity-60 font-mono-data">
                    {sortField === "name" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                  </span>
                </div>
              </th>
              <th
                scope="col"
                aria-sort={sortField === "matricula" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                onClick={() => handleSort("matricula")}
                className="hidden sm:table-cell sm:w-36 px-4 py-3.5 font-sans font-semibold text-[#706E6A] dark:text-slate-400 text-[11px] uppercase tracking-wider sm:px-5 cursor-pointer hover:text-[#171715] dark:hover:text-slate-200 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span>Matrícula</span>
                  <span className="text-2xs opacity-60 font-mono-data">
                    {sortField === "matricula" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                  </span>
                </div>
              </th>
              <th
                scope="col"
                aria-sort={sortField === "sessions" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                onClick={() => handleSort("sessions")}
                className="hidden sm:table-cell sm:w-28 px-4 py-3.5 font-sans font-semibold text-[#706E6A] dark:text-slate-400 text-[11px] uppercase tracking-wider sm:px-5 text-center cursor-pointer hover:text-[#171715] dark:hover:text-slate-200 transition-colors"
              >
                <div className="flex items-center justify-center gap-1.5">
                  <span>Sessões</span>
                  <span className="text-2xs opacity-60 font-mono-data">
                    {sortField === "sessions" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                  </span>
                </div>
              </th>
              <th
                scope="col"
                aria-sort={sortField === "duration" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                onClick={() => handleSort("duration")}
                className="w-[27%] sm:w-40 whitespace-nowrap px-2 py-3 sm:px-5 sm:py-3.5 font-sans font-semibold text-[#706E6A] dark:text-slate-400 text-[11px] uppercase tracking-wider cursor-pointer hover:text-[#171715] dark:hover:text-slate-200 transition-colors text-right sm:text-left"
              >
                <div className="flex items-center justify-end sm:justify-start gap-1.5">
                  <span className="hidden sm:inline">Total Permanência</span>
                  <span className="sm:hidden">Tempo</span>
                  <span className="text-2xs opacity-60 font-mono-data">
                    {sortField === "duration" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                  </span>
                </div>
              </th>
              <th
                scope="col"
                aria-sort={sortField === "status" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                onClick={() => handleSort("status")}
                className="w-[28%] sm:w-32 whitespace-nowrap pl-1 pr-3 py-3 sm:px-5 sm:py-3.5 font-sans font-semibold text-[#706E6A] dark:text-slate-400 text-[11px] uppercase tracking-wider cursor-pointer hover:text-[#171715] dark:hover:text-slate-200 transition-colors text-right sm:text-left"
              >
                <div className="flex items-center justify-end sm:justify-start gap-1.5">
                  <span>Status</span>
                  <span className="text-2xs opacity-60 font-mono-data">
                    {sortField === "status" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                  </span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E2DC]/70 dark:divide-slate-800/70">
            {sortedRows.map((row, idx) => (
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
                className={`group transition-all duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#C15F3D] ${
                  isDurationDesc && idx === 0
                    ? "bg-gradient-to-r from-amber-100/40 via-amber-50/20 to-transparent dark:from-amber-950/25 dark:via-transparent dark:to-transparent border-l-4 border-l-amber-500 hover:bg-amber-100/60 dark:hover:bg-amber-950/40"
                    : isDurationDesc && idx === 1
                    ? "bg-gradient-to-r from-slate-100/60 via-slate-50/20 to-transparent dark:from-slate-800/30 dark:via-transparent dark:to-transparent border-l-4 border-l-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/50"
                    : isDurationDesc && idx === 2
                    ? "bg-gradient-to-r from-orange-100/40 via-orange-50/20 to-transparent dark:from-orange-950/25 dark:via-transparent dark:to-transparent border-l-4 border-l-[#C15F3D] hover:bg-orange-100/60 dark:hover:bg-orange-950/40"
                    : "border-l-4 border-l-transparent hover:bg-[#FAF9F5] dark:hover:bg-slate-800/50 focus-visible:bg-[#FAF9F5] dark:focus-visible:bg-slate-800/60"
                }`}
                role="button"
                aria-label={`Ver sessões e histórico de ${row.member.name}`}
              >
                <td className="px-3 py-2.5 sm:px-5 sm:py-3.5 text-[#171715] dark:text-slate-100 overflow-hidden">
                  <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
                    <div
                      className={`flex h-7 w-7 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${getAvatarStyle(row.member.name)} text-[10px] sm:text-xs font-bold ring-2 ring-white dark:ring-slate-900 shadow-2xs transition-transform duration-200 group-hover:scale-105`}
                    >
                      {row.member.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-sans font-medium text-[#171715] dark:text-slate-100 group-hover:text-[#C15F3D] dark:group-hover:text-amber-400 transition-colors text-xs sm:text-sm truncate">
                          {row.member.name}
                        </span>
                        {isDurationDesc && idx === 0 && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-400 text-amber-950 font-bold px-1.5 py-0.2 text-[10px] shadow-2xs leading-none">
                            🥇 1º
                          </span>
                        )}
                        {isDurationDesc && idx === 1 && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-slate-200 text-slate-800 font-bold px-1.5 py-0.2 text-[10px] shadow-2xs leading-none">
                            🥈 2º
                          </span>
                        )}
                        {isDurationDesc && idx === 2 && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-orange-200 text-[#7A2E14] font-bold px-1.5 py-0.2 text-[10px] shadow-2xs leading-none">
                            🥉 3º
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="hidden px-4 py-3.5 sm:table-cell sm:px-5 font-mono-data text-xs text-[#706E6A] dark:text-slate-400">
                  {row.member.matricula ? (
                    <span className="inline-block rounded-md bg-[#FAF9F5] dark:bg-slate-800 border border-[#E5E2DC] dark:border-slate-700 px-2 py-0.5 text-[#706E6A] dark:text-slate-300">
                      {row.member.matricula}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="hidden px-4 py-3.5 text-[#171715] dark:text-slate-200 sm:table-cell sm:px-5 text-center font-mono-data text-xs sm:text-sm font-medium">
                  {row.sessionCount}
                </td>
                <td className="whitespace-nowrap px-2 py-2.5 sm:px-5 sm:py-3.5 text-right sm:text-left text-xs sm:text-sm font-mono-data">
                  {row.present ? (
                    <span className="inline-block font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200/80 dark:border-emerald-800/60">
                      {formatDuration(row.totalSeconds, true)}
                    </span>
                  ) : (
                    <span className="font-medium text-[#171715] dark:text-slate-200">
                      {formatDuration(row.totalSeconds)}
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap pl-1 pr-3 py-2.5 sm:px-5 sm:py-3.5 text-right sm:text-left">
                  <div className="flex items-center justify-end sm:justify-start">
                    {row.present ? (
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-emerald-500 text-white dark:bg-emerald-950/80 dark:text-emerald-300 dark:border dark:border-emerald-700/80 px-2.5 py-1 text-[11px] font-semibold shadow-2xs">
                        <span className="relative flex h-1.5 w-1.5 shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white dark:bg-emerald-400" />
                        </span>
                        <span>Presente</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400 dark:bg-slate-500 shrink-0" />
                        <span>Ausente</span>
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
