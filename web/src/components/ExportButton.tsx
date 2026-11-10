import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import type { MemberTotal } from "../lib/aggregate";
import { formatDuration } from "../lib/aggregate";
import type { DateRange } from "../lib/reports";

interface Props {
  rows: MemberTotal[];
  range: DateRange;
  period: string;
}

function formatDateForFilename(date: Date): string {
  return date
    .toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
    .replace(/\//g, "-");
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
      setTimeout(() => setIsExporting(false), 900);
    }
  };

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={isExporting || rows.length === 0}
      title={`Exportar ${rows.length} integrantes para CSV`}
      className="btn-secondary select-none"
      aria-label="Exportar dados de presença como CSV"
    >
      {isExporting ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin text-orange-500" />
          <span>Exportando…</span>
        </>
      ) : (
        <>
          <Download className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
          <span>Exportar CSV</span>
        </>
      )}
    </button>
  );
}
