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

function RankBadge({ rank }: { rank: 1 | 2 | 3 }) {
  if (rank === 1) {
    return (
      <span
        title="1º lugar em permanência"
        className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 dark:bg-amber-400/10 border border-amber-500/25 px-1.5 py-0.5 text-[10.5px] font-mono-data font-semibold text-amber-800 dark:text-amber-200 select-none shadow-[0_1px_3px_rgba(217,119,6,0.06)]"
      >
        <svg className="h-3 w-3 text-amber-600 dark:text-amber-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="6" />
          <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" />
        </svg>
        <span>1º</span>
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span
        title="2º lugar em permanência"
        className="inline-flex items-center gap-1 rounded-md bg-slate-500/10 dark:bg-slate-400/10 border border-slate-400/30 px-1.5 py-0.5 text-[10.5px] font-mono-data font-semibold text-slate-700 dark:text-slate-300 select-none shadow-[0_1px_3px_rgba(100,116,139,0.06)]"
      >
        <svg className="h-3 w-3 text-slate-500 dark:text-slate-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="6" />
          <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" />
        </svg>
        <span>2º</span>
      </span>
    );
  }
  return (
    <span
      title="3º lugar em permanência"
      className="inline-flex items-center gap-1 rounded-md bg-orange-500/10 dark:bg-orange-400/10 border border-orange-500/25 px-1.5 py-0.5 text-[10.5px] font-mono-data font-semibold text-[#8F4321] dark:text-orange-200 select-none shadow-[0_1px_3px_rgba(193,95,61,0.06)]"
    >
      <svg className="h-3 w-3 text-[#C15F3D] dark:text-orange-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="6" />
        <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" />
      </svg>
      <span>3º</span>
    </span>
  );
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
        <span className="hidden sm:inline">
          Exibindo <strong className="font-mono-data font-semibold text-[#171715] dark:text-slate-100">{sortedRows.length}</strong> integrantes (clique no nome para abrir o histórico detalhado)
        </span>
        <span className="sm:hidden text-[11px]">
          <strong className="font-mono-data font-semibold text-[#171715] dark:text-slate-100">{sortedRows.length}</strong> integrantes · toque para detalhes
        </span>
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
                className="group transition-colors duration-150 hover:bg-[#FAF9F5] dark:hover:bg-slate-800/50 cursor-pointer focus-visible:bg-[#FAF9F5] dark:focus-visible:bg-slate-800/60"
                role="button"
                aria-label={`Ver sessões e histórico de ${row.member.name}`}
              >
                <td className="px-3 py-2.5 sm:px-5 sm:py-3.5 text-[#171715] dark:text-slate-100 overflow-hidden">
                  <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
                    {row.member.avatarUrl ? (
                      <img
                        src={row.member.avatarUrl}
                        alt={row.member.name}
                        className="h-7 w-7 sm:h-9 sm:w-9 shrink-0 rounded-full object-cover ring-1.5 sm:ring-2 ring-white dark:ring-slate-900 shadow-2xs transition-transform duration-200 group-hover:scale-105"
                      />
                    ) : (
                      <div
                        className={`flex h-7 w-7 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${getAvatarStyle(row.member.name)} text-[10px] sm:text-xs font-bold ring-1.5 sm:ring-2 ring-white dark:ring-slate-900 shadow-2xs transition-transform duration-200 group-hover:scale-105`}
                      >
                        {row.member.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-sans font-medium text-[#171715] dark:text-slate-100 group-hover:text-[#C15F3D] dark:group-hover:text-amber-400 transition-colors text-xs sm:text-sm truncate">
                          {row.member.name}
                        </span>
                        {isDurationDesc && idx < 3 && (
                          <RankBadge rank={(idx + 1) as 1 | 2 | 3} />
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
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">
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
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/80 px-2.5 py-1 text-[11px] font-medium text-emerald-800 dark:text-emerald-300 shadow-2xs">
                        <span className="relative flex h-1.5 w-1.5 shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                        </span>
                        <span>Presente</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[#FAF9F5] dark:bg-slate-800/80 border border-[#E5E2DC] dark:border-slate-700 px-2.5 py-1 text-[11px] font-medium text-[#706E6A] dark:text-slate-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#706E6A]/40 dark:bg-slate-500 shrink-0" />
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
