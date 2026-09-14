import { useMemo, useState } from "react";
import type { MemberTotal } from "../lib/aggregate";
import { formatDuration } from "../lib/aggregate";

type SortField = "name" | "matricula" | "sessions" | "duration" | "status";
type SortDirection = "asc" | "desc";

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

      <div className="overflow-x-auto rounded-2xl border border-line bg-card shadow-sm transition-all">
        <table className="w-full text-left text-sm text-ink" aria-label="Tabela de permanência dos integrantes">
          <thead className="sticky top-0 z-10 bg-navy text-white select-none">
            <tr>
              <th
                scope="col"
                aria-sort={sortField === "name" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                onClick={() => handleSort("name")}
                className="px-4 py-3.5 font-bold sm:px-5 cursor-pointer hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span>Integrante</span>
                  <span className="text-xs opacity-70">
                    {sortField === "name" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                  </span>
                </div>
              </th>
              <th
                scope="col"
                aria-sort={sortField === "matricula" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                onClick={() => handleSort("matricula")}
                className="hidden px-4 py-3.5 font-bold sm:table-cell sm:px-5 cursor-pointer hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span>Matrícula</span>
                  <span className="text-xs opacity-70">
                    {sortField === "matricula" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                  </span>
                </div>
              </th>
              <th
                scope="col"
                aria-sort={sortField === "sessions" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                onClick={() => handleSort("sessions")}
                className="hidden px-4 py-3.5 font-bold sm:table-cell sm:px-5 text-center cursor-pointer hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center justify-center gap-1.5">
                  <span>Sessões</span>
                  <span className="text-xs opacity-70">
                    {sortField === "sessions" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                  </span>
                </div>
              </th>
              <th
                scope="col"
                aria-sort={sortField === "duration" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                onClick={() => handleSort("duration")}
                className="whitespace-nowrap px-4 py-3.5 font-bold sm:px-5 cursor-pointer hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span>Total Permanência</span>
                  <span className="text-xs opacity-70">
                    {sortField === "duration" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                  </span>
                </div>
              </th>
              <th
                scope="col"
                aria-sort={sortField === "status" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                onClick={() => handleSort("status")}
                className="whitespace-nowrap px-4 py-3.5 font-bold sm:px-5 cursor-pointer hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span>Status</span>
                  <span className="text-xs opacity-70">
                    {sortField === "status" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                  </span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
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
                className="group transition-colors duration-150 hover:bg-navy/[0.04] cursor-pointer focus-visible:bg-navy/[0.06] focus-visible:outline-2 focus-visible:outline-navy"
                role="button"
                aria-label={`Ver sessões e histórico de ${row.member.name}`}
              >
                <td className="px-4 py-3.5 sm:px-5 text-ink">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy/10 text-xs font-extrabold text-navy transition-colors group-hover:bg-navy group-hover:text-white">
                      {row.member.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <span className="font-bold text-ink group-hover:text-navy group-hover:underline transition-colors block">
                        {row.member.name}
                      </span>
                      {/* Subtítulo para telas mobile com matrícula e contagem de sessões */}
                      <div className="sm:hidden text-2xs text-muted flex items-center gap-1.5 mt-0.5">
                        <span>Matrícula: {row.member.matricula ?? "—"}</span>
                        <span>•</span>
                        <span>{row.sessionCount} sessões</span>
                      </div>
                    </div>
                  </div>
                </td>
                <td className="hidden px-4 py-3.5 text-muted sm:table-cell sm:px-5 font-mono text-xs">
                  {row.member.matricula ?? "—"}
                </td>
                <td className="hidden px-4 py-3.5 text-ink sm:table-cell sm:px-5 text-center font-semibold">
                  {row.sessionCount}
                </td>
                <td className="whitespace-nowrap px-4 py-3.5 font-extrabold sm:px-5 text-navy">
                  {formatDuration(row.totalSeconds)}
                </td>
                <td className="px-4 py-3.5 sm:px-5">
                  {row.present ? (
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-green/15 px-3 py-1 text-xs font-bold text-green ring-1 ring-green/20">
                      <span className="h-2 w-2 rounded-full bg-green animate-pulse" />
                      No lab
                    </span>
                  ) : (
                    <span className="inline-flex items-center whitespace-nowrap rounded-full bg-muted/10 px-3 py-1 text-xs font-medium text-muted">
                      Fora
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
