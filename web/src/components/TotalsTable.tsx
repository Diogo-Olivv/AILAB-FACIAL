import { useMemo, useState } from "react";
import {
  SearchX,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  GraduationCap,
  ChevronRight,
  Award,
  RotateCcw,
} from "lucide-react";
import type { MemberTotal } from "../lib/aggregate";
import { formatDuration } from "../lib/aggregate";
import { MemberAvatar } from "./MemberAvatar";

export { getAvatarStyle } from "./MemberAvatar";

type SortField = "name" | "matricula" | "sessions" | "duration" | "status";
type SortDirection = "asc" | "desc";
type QuickFilter = "all" | "present" | "tutors" | "goalMet";

interface Props {
  rows: MemberTotal[];
  totalCount?: number;
  searchActive?: boolean;
  onClearSearch?: () => void;
  onSelectMember?: (row: MemberTotal) => void;
}

function RankBadge({ rank }: { rank: 1 | 2 | 3 }) {
  if (rank === 1) {
    return (
      <span
        title="1º lugar em permanência no período"
        className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/30 px-1.5 py-0.5 text-[10px] font-mono-data tabular-nums font-bold select-none"
      >
        <Award className="h-3 w-3 text-amber-500 dark:text-amber-400 shrink-0" />
        <span>1º</span>
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span
        title="2º lugar em permanência no período"
        className="inline-flex items-center gap-1 rounded-md bg-slate-400/15 text-slate-700 dark:text-slate-300 ring-1 ring-slate-400/30 px-1.5 py-0.5 text-[10px] font-mono-data tabular-nums font-bold select-none"
      >
        <Award className="h-3 w-3 text-slate-500 dark:text-slate-300 shrink-0" />
        <span>2º</span>
      </span>
    );
  }
  return (
    <span
      title="3º lugar em permanência no período"
      className="inline-flex items-center gap-1 rounded-md bg-orange-600/15 text-orange-800 dark:text-orange-300 ring-1 ring-orange-500/30 px-1.5 py-0.5 text-[10px] font-mono-data tabular-nums font-bold select-none"
    >
      <Award className="h-3 w-3 text-orange-600 dark:text-orange-400 shrink-0" />
      <span>3º</span>
    </span>
  );
}

export function TotalsTable({
  rows,
  totalCount,
  searchActive = false,
  onClearSearch,
  onSelectMember,
}: Props) {
  const [sortField, setSortField] = useState<SortField>("duration");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection(field === "name" || field === "matricula" ? "asc" : "desc");
    }
  };

  // Contadores rápidos para os chips de filtro (H6 — Reconhecimento em vez de Memorização)
  const filterCounts = useMemo(() => {
    return {
      all: rows.length,
      present: rows.filter((r) => r.present).length,
      tutors: rows.filter((r) => r.member.isTutor).length,
      goalMet: rows.filter((r) => r.totalSeconds >= 4 * 3600).length,
    };
  }, [rows]);

  const filteredByChip = useMemo(() => {
    switch (quickFilter) {
      case "present":
        return rows.filter((r) => r.present);
      case "tutors":
        return rows.filter((r) => r.member.isTutor);
      case "goalMet":
        return rows.filter((r) => r.totalSeconds >= 4 * 3600);
      default:
        return rows;
    }
  }, [rows, quickFilter]);

  const sortedRows = useMemo(() => {
    return [...filteredByChip].sort((a, b) => {
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
  }, [filteredByChip, sortField, sortDirection]);

  // Maior tempo para barra proporcional de permanência
  const maxSeconds = useMemo(() => {
    const highest = Math.max(...rows.map((r) => r.totalSeconds), 4 * 3600);
    return highest > 0 ? highest : 4 * 3600;
  }, [rows]);

  const universeTotal = typeof totalCount === "number" ? totalCount : rows.length;
  const hasAnyFilter = quickFilter !== "all" || searchActive;

  const resetAllFilters = () => {
    setQuickFilter("all");
    onClearSearch?.();
  };

  const isDurationDesc = sortField === "duration" && sortDirection === "desc" && quickFilter === "all";

  const getSortAriaLabel = (field: SortField, label: string) => {
    if (sortField !== field) return `Ordenar por ${label}`;
    return `Ordenar por ${label}, atualmente em ordem ${sortDirection === "asc" ? "crescente" : "decrescente"}`;
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3 w-3 opacity-40 group-hover:opacity-100 transition-opacity shrink-0" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="h-3 w-3 text-orange-500 dark:text-amber-400 shrink-0" />
    ) : (
      <ArrowDown className="h-3 w-3 text-orange-500 dark:text-amber-400 shrink-0" />
    );
  };

  return (
    <div className="space-y-3">
      {/* Barra de Filtros Rápidos + Contador de Visibilidade (H3, H6, H7) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-0.5">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5" role="group" aria-label="Filtros rápidos de integrantes">
          {(
            [
              { id: "all", label: "Todos", count: filterCounts.all },
              { id: "present", label: "Ao Vivo", count: filterCounts.present, dot: "bg-emerald-500" },
              { id: "goalMet", label: "Meta ≥ 4h", count: filterCounts.goalMet },
              { id: "tutors", label: "Tutores", count: filterCounts.tutors },
            ] as const
          ).map((chip) => {
            const active = quickFilter === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setQuickFilter(chip.id)}
                className={`inline-flex min-h-[38px] sm:min-h-[32px] items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  active
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-2xs"
                    : "bg-slate-100/80 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900 dark:bg-[#161F30] dark:text-slate-300 dark:hover:bg-white/[0.1] dark:hover:text-white border border-slate-200/80 dark:border-white/[0.08]"
                }`}
              >
                {"dot" in chip && chip.dot && (
                  <span className={`h-1.5 w-1.5 rounded-full ${chip.dot}`} />
                )}
                <span>{chip.label}</span>
                <span
                  className={`rounded px-1.5 py-px text-[10px] font-mono-data tabular-nums ${
                    active
                      ? "bg-white/20 text-white dark:bg-slate-900/15 dark:text-slate-900"
                      : "bg-white/80 text-slate-500 dark:bg-[#0F1623] dark:text-slate-400"
                  }`}
                >
                  {chip.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span className="tabular-nums">
            Exibindo{" "}
            <strong className="font-mono-data font-bold text-slate-900 dark:text-white">
              {sortedRows.length}
            </strong>{" "}
            de{" "}
            <strong className="font-mono-data font-semibold text-slate-700 dark:text-slate-200">
              {universeTotal}
            </strong>{" "}
            integrantes
          </span>
          {hasAnyFilter && (
            <button
              type="button"
              onClick={resetAllFilters}
              className="inline-flex items-center gap-1 rounded-lg bg-orange-500/10 ring-1 ring-orange-500/25 px-2.5 py-1 text-2xs font-semibold text-orange-600 dark:text-amber-400 hover:bg-orange-500/20 transition-colors cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Limpar filtros</span>
            </button>
          )}
        </div>
      </div>

      {sortedRows.length === 0 ? (
        <div className="surface-card flex flex-col items-center justify-center p-12 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100/80 border border-slate-200/80 text-slate-500 dark:bg-[#161F30] dark:border-white/[0.08] dark:text-slate-400">
            <SearchX className="h-5 w-5" />
          </div>
          <p className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
            Nenhum integrante encontrado
          </p>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
            Não há registros correspondentes ao filtro atual. Limpe a busca ou selecione outro período.
          </p>
          {hasAnyFilter && (
            <button
              type="button"
              onClick={resetAllFilters}
              className="mt-4 btn-secondary"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Restaurar todos os integrantes</span>
            </button>
          )}
        </div>
      ) : (
        <div className="surface-card overflow-hidden">
          <div className="overflow-x-auto">
            <table
              className="w-full text-left text-sm text-slate-700 dark:text-slate-200"
              aria-label="Tabela de permanência dos integrantes"
            >
              <thead className="sticky top-0 z-10 glass-table-header select-none">
                <tr>
                  <th
                    scope="col"
                    aria-sort={sortField === "name" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                    className="px-3.5 py-3 sm:px-5 eyebrow"
                  >
                    <button
                      type="button"
                      onClick={() => handleSort("name")}
                      aria-label={getSortAriaLabel("name", "integrante")}
                      className="group inline-flex items-center gap-1.5 text-left hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer rounded-md py-0.5"
                    >
                      <span>Integrante</span>
                      {renderSortIcon("name")}
                    </button>
                  </th>
                  <th
                    scope="col"
                    aria-sort={sortField === "matricula" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                    className="hidden md:table-cell w-36 px-4 py-3 eyebrow"
                  >
                    <button
                      type="button"
                      onClick={() => handleSort("matricula")}
                      aria-label={getSortAriaLabel("matricula", "matrícula")}
                      className="group inline-flex items-center gap-1.5 text-left hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer rounded-md py-0.5"
                    >
                      <span>Matrícula</span>
                      {renderSortIcon("matricula")}
                    </button>
                  </th>
                  <th
                    scope="col"
                    aria-sort={sortField === "sessions" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                    className="hidden sm:table-cell w-28 px-4 py-3 eyebrow text-right"
                  >
                    <button
                      type="button"
                      onClick={() => handleSort("sessions")}
                      aria-label={getSortAriaLabel("sessions", "sessões")}
                      className="group inline-flex items-center justify-end gap-1.5 w-full hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer rounded-md py-0.5"
                    >
                      <span>Sessões</span>
                      {renderSortIcon("sessions")}
                    </button>
                  </th>
                  <th
                    scope="col"
                    aria-sort={sortField === "duration" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                    className="w-40 sm:w-52 whitespace-nowrap px-3 py-3 sm:px-5 eyebrow text-right"
                  >
                    <button
                      type="button"
                      onClick={() => handleSort("duration")}
                      aria-label={getSortAriaLabel("duration", "total de permanência")}
                      className="group inline-flex items-center justify-end gap-1.5 w-full text-right hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer rounded-md py-0.5"
                    >
                      <span className="hidden sm:inline">Permanência</span>
                      <span className="sm:hidden">Horas</span>
                      {renderSortIcon("duration")}
                    </button>
                  </th>
                  <th
                    scope="col"
                    aria-sort={sortField === "status" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                    className="w-28 sm:w-36 whitespace-nowrap pl-2 pr-3.5 py-3 sm:px-5 eyebrow text-right"
                  >
                    <button
                      type="button"
                      onClick={() => handleSort("status")}
                      aria-label={getSortAriaLabel("status", "status de presença")}
                      className="group inline-flex items-center justify-end gap-1.5 w-full hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer rounded-md py-0.5"
                    >
                      <span>Status</span>
                      {renderSortIcon("status")}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 dark:divide-white/[0.05]">
                {sortedRows.map((row, idx) => {
                  const pct = Math.min(100, Math.round((row.totalSeconds / maxSeconds) * 100));
                  const metFourHours = row.totalSeconds >= 4 * 3600;
                  return (
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
                      className="cursor-pointer hover:bg-slate-50/90 dark:hover:bg-white/[0.03] transition-colors group"
                      role="button"
                      aria-label={`Ver sessões e histórico de ${row.member.name}`}
                    >
                      {/* Coluna 1: Avatar Blindado + Nome + Pódio + TUTOR + Metadados Mobile */}
                      <td className="px-3.5 py-3 sm:px-5 sm:py-3.5 min-w-0">
                        <div className="flex items-center gap-3 min-w-0">
                          <MemberAvatar
                            name={row.member.name}
                            src={row.member.avatarUrl}
                            size="md"
                            highlight={Boolean(row.member.isTutor)}
                            present={row.present}
                            className="transition-transform duration-150 group-hover:scale-105"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                title={row.member.name}
                                className="font-semibold text-slate-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-amber-400 transition-colors text-xs sm:text-sm truncate max-w-[160px] xs:max-w-[210px] sm:max-w-xs md:max-w-sm"
                              >
                                {row.member.name}
                              </span>
                              {isDurationDesc && idx < 3 && row.totalSeconds > 0 && (
                                <RankBadge rank={(idx + 1) as 1 | 2 | 3} />
                              )}
                              {row.member.isTutor && (
                                <span
                                  title="Tutor Oficial do Laboratório"
                                  className="inline-flex items-center gap-1 bg-orange-500/10 text-orange-600 dark:text-orange-400 ring-1 ring-orange-500/25 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md select-none"
                                >
                                  <GraduationCap className="h-3 w-3 shrink-0" />
                                  <span>TUTOR</span>
                                </span>
                              )}
                            </div>

                            {/* Sub-linha responsiva em telas pequenas (< 768px): Matrícula + Sessões sem corte */}
                            <div className="flex items-center gap-2 mt-0.5 text-2xs text-slate-500 dark:text-slate-400 font-mono-data tabular-nums md:hidden">
                              <span>{row.member.matricula ? `#${row.member.matricula}` : "Discente"}</span>
                              <span className="sm:hidden">· {row.sessionCount} {row.sessionCount === 1 ? "sessão" : "sessões"}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Coluna 2: Matrícula (Desktop) */}
                      <td className="hidden md:table-cell px-4 py-3.5 font-mono-data tabular-nums text-xs text-slate-500 dark:text-slate-400">
                        {row.member.matricula ? (
                          <span className="inline-block rounded-md bg-slate-100/80 dark:bg-[#161F30] border border-slate-200/80 dark:border-white/[0.08] px-2 py-0.5 text-slate-700 dark:text-slate-300">
                            {row.member.matricula}
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-600">—</span>
                        )}
                      </td>

                      {/* Coluna 3: Sessões (Tablet/Desktop) */}
                      <td className="hidden sm:table-cell px-4 py-3.5 text-right font-mono-data tabular-nums text-sm font-medium text-slate-700 dark:text-slate-200">
                        {row.sessionCount}
                      </td>

                      {/* Coluna 4: Permanência + Barra Proporcional */}
                      <td className="whitespace-nowrap px-3 py-3 sm:px-5 sm:py-3.5 text-right font-mono-data tabular-nums">
                        <div className="flex flex-col items-end gap-1">
                          <span
                            className={`text-xs sm:text-sm font-bold ${
                              row.present
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-slate-900 dark:text-white"
                            }`}
                          >
                            {row.present
                              ? formatDuration(row.totalSeconds, true)
                              : formatDuration(row.totalSeconds)}
                          </span>
                          <div
                            className="hidden sm:flex h-1.5 w-24 md:w-28 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.07]"
                            role="progressbar"
                            aria-valuenow={pct}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label={`Progresso de permanência de ${row.member.name}: ${pct}%`}
                          >
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                row.present
                                  ? "bg-emerald-500"
                                  : metFourHours
                                  ? "bg-orange-500 dark:bg-amber-400"
                                  : "bg-slate-400 dark:bg-slate-500"
                              }`}
                              style={{ width: `${row.totalSeconds > 0 ? Math.max(pct, 6) : 0}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Coluna 5: Status Semântico + Chevron Interativo */}
                      <td className="whitespace-nowrap pl-2 pr-3.5 py-3 sm:px-5 sm:py-3.5 text-right">
                        <div className="inline-flex items-center justify-end gap-2">
                          {row.present ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500/20 px-2.5 py-1 text-2xs font-bold">
                              <span className="relative flex h-2 w-2 items-center justify-center shrink-0">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                              </span>
                              <span>Ao vivo</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100/80 dark:bg-[#161F30] text-slate-500 dark:text-slate-400 ring-1 ring-slate-200/80 dark:ring-white/[0.08] px-2.5 py-1 text-2xs font-medium">
                              <span className="h-1.5 w-1.5 rounded-full bg-slate-400 dark:bg-slate-500 shrink-0" />
                              <span>Ausente</span>
                            </span>
                          )}
                          <ChevronRight
                            className="h-4 w-4 text-slate-400 dark:text-slate-500 group-hover:text-orange-500 dark:group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all shrink-0"
                            aria-hidden="true"
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
