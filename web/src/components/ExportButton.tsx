import { useState } from "react";
import type { MemberTotal } from "../lib/aggregate";
import { formatDuration } from "../lib/aggregate";
import type { DateRange } from "../lib/reports";

interface Props {
  rows: MemberTotal[];
  range: DateRange;
  period: string;
}

function formatDateForFilename(date: Date): string {
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).replace(/\//g, "-");
}

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function ExportButton({ rows, range, period }: Props) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (isExporting || rows.length === 0) return;
    setIsExporting(true);

    try {
      const now = new Date();
      const fromStr = formatDateForFilename(range.from);
      const toStr = formatDateForFilename(range.to);
      const filename = `ailab-presenca_${fromStr}_a_${toStr}.csv`;

      // Cabeçalho CSV com BOM para compatibilidade com Excel
      const bom = "\uFEFF";
      const header = [
        "Nome",
        "Matrícula",
        "Sessões",
        "Total de Horas",
        "Total (segundos)",
        "Presente Agora",
        "Período",
        "Gerado em",
      ].join(",");

      const periodLabel =
        period === "day"
          ? "Hoje"
          : period === "week"
          ? "Esta semana"
          : period === "month"
          ? "Este mês"
          : `${fromStr} a ${toStr}`;

      const generatedAt = now.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      const csvRows = rows.map((row) => {
        return [
          escapeCsvField(row.member.name),
          escapeCsvField(row.member.matricula ?? ""),
          String(row.sessionCount),
          escapeCsvField(formatDuration(row.totalSeconds)),
          String(row.totalSeconds),
          row.present ? "Sim" : "Não",
          escapeCsvField(periodLabel),
          escapeCsvField(generatedAt),
        ].join(",");
      });

      const csvContent = bom + [header, ...csvRows].join("\r\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      // Silencia erros de download
    } finally {
      setTimeout(() => setIsExporting(false), 1200);
    }
  };

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={isExporting || rows.length === 0}
      title={`Exportar ${rows.length} integrantes para CSV`}
      className="inline-flex items-center gap-1.5 rounded-2xl border border-[#E5E2DC] dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs font-sans font-medium text-[#706E6A] dark:text-slate-300 hover:border-[#706E6A]/50 hover:text-[#171715] dark:hover:text-slate-100 hover:bg-[#FAF9F5] dark:hover:bg-slate-700 active:scale-[0.97] shadow-2xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none h-11"
      aria-label="Exportar dados de presença como CSV"
    >
      {isExporting ? (
        <>
          <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span>Exportando…</span>
        </>
      ) : (
        <>
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <span>Exportar CSV</span>
        </>
      )}
    </button>
  );
}
