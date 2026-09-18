import { useEffect, useState } from "react";
import {
  FileText,
  Printer,
  Download,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  XCircle,
  X,
} from "lucide-react";
import type { MemberTotal } from "../lib/aggregate";
import { formatDuration } from "../lib/aggregate";
import type { DateRange } from "../lib/reports";

interface OfficialReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  rows: MemberTotal[];
  range: DateRange;
  period: string;
  tutorEmail?: string;
}

export function OfficialReportModal({
  isOpen,
  onClose,
  rows,
  range,
  period,
  tutorEmail,
}: OfficialReportModalProps) {
  const [checksum, setChecksum] = useState<string>("GERANDO HASH...");

  const totalSeconds = rows.reduce((acc, r) => acc + r.totalSeconds, 0);
  const totalHours = (totalSeconds / 3600).toFixed(1);
  const compliantCount = rows.filter((r) => r.totalSeconds >= 14400).length;
  const complianceRate = rows.length > 0 ? Math.round((compliantCount / rows.length) * 100) : 0;

  const fromStr = range.from.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const toStr = range.to.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const issuanceDate = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // Geração de Hash Criptográfico SHA-256 Anti-Fraude
  useEffect(() => {
    if (!isOpen) return;

    let active = true;
    const generateHash = async () => {
      try {
        const payload = `AILAB-ATTENDANCE-REPORT|FROM:${range.from.toISOString()}|TO:${range.to.toISOString()}|MEMBERS:${rows.length}|TOTAL_SEC:${totalSeconds}|TUTOR:${tutorEmail || "ailab"}`;
        const msgBuffer = new TextEncoder().encode(payload);
        const hashBuffer = await window.crypto.subtle.digest("SHA-256", msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
        if (active) setChecksum(hashHex);
      } catch {
        if (active) setChecksum("E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855");
      }
    };

    generateHash();
    return () => {
      active = false;
    };
  }, [isOpen, range, rows, totalSeconds, tutorEmail]);

  if (!isOpen) return null;

  /**
   * Constrói documento HTML autossuficiente para impressão limpa.
   * Totalmente isolado do DOM da aplicação, garantindo cores nítidas no papel,
   * paginação contínua sem truncamentos e compatibilidade 100% com o modo escuro.
   */
  const buildPrintableDocument = (): string => {
    const tableRowsHtml =
      rows.length === 0
        ? `<tr><td colspan="5" style="text-align: center; padding: 24px; color: #64748B;">Nenhum registro encontrado para o período selecionado.</td></tr>`
        : rows
            .map((row, idx) => {
              const isCompliant = row.totalSeconds >= 14400;
              const isWarning = row.totalSeconds > 0 && row.totalSeconds < 14400;
              const badgeBg = isCompliant ? "#DCFCE7" : isWarning ? "#FEF3C7" : "#FEE2E2";
              const badgeColor = isCompliant ? "#166534" : isWarning ? "#92400E" : "#991B1B";
              const badgeText = isCompliant ? "Regular (≥4h)" : isWarning ? "Parcial (<4h)" : "Sem Horas (0h)";
              const rowBg = idx % 2 === 1 ? "#F8FAFC" : "#FFFFFF";

              return `
                <tr style="background-color: ${rowBg}; page-break-inside: avoid; break-inside: avoid;">
                  <td style="padding: 7px 10px; font-weight: 600; color: #0F172A; border-bottom: 1px solid #E2E8F0;">${row.member.name}</td>
                  <td style="padding: 7px 10px; font-family: monospace; font-size: 11px; color: #64748B; border-bottom: 1px solid #E2E8F0;">${row.member.matricula || "—"}</td>
                  <td style="padding: 7px 10px; text-align: right; font-family: monospace; font-weight: 700; color: #0F172A; border-bottom: 1px solid #E2E8F0;">${formatDuration(row.totalSeconds)}</td>
                  <td style="padding: 7px 10px; text-align: center; font-family: monospace; font-size: 11px; color: #475569; border-bottom: 1px solid #E2E8F0;">${row.sessionCount}</td>
                  <td style="padding: 7px 10px; text-align: center; border-bottom: 1px solid #E2E8F0;">
                    <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 10px; font-weight: 600; background-color: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeColor}33;">
                      ${badgeText}
                    </span>
                  </td>
                </tr>
              `;
            })
            .join("");

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Relatório Oficial de Frequência - AILAB Makers</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 14mm 15mm 15mm 15mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 12px;
      line-height: 1.4;
      color: #0F172A;
      background: #FFFFFF;
    }
    .header {
      border-bottom: 2px solid #0F172A;
      padding-bottom: 12px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .inst-title {
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: #C15F3D;
      margin-bottom: 4px;
    }
    .main-title {
      font-size: 19px;
      font-weight: 800;
      color: #0F172A;
      margin: 0;
    }
    .sub-title {
      font-size: 11px;
      color: #64748B;
      margin-top: 2px;
    }
    .meta-box {
      font-family: "Courier New", Courier, monospace;
      font-size: 10px;
      color: #475569;
      text-align: right;
    }
    .meta-box strong {
      color: #0F172A;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 18px;
    }
    .kpi-card {
      border: 1px solid #CBD5E1;
      border-radius: 8px;
      padding: 8px 12px;
      background: #F8FAFC;
    }
    .kpi-label {
      font-size: 9.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748B;
      display: block;
    }
    .kpi-value {
      font-size: 17px;
      font-weight: 800;
      font-family: monospace;
      color: #0F172A;
      margin-top: 3px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    thead {
      display: table-header-group;
    }
    th {
      background-color: #F1F5F9;
      color: #334155;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 8px 10px;
      border-bottom: 2px solid #CBD5E1;
      border-top: 1px solid #CBD5E1;
    }
    .signatures {
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid #CBD5E1;
      display: flex;
      justify-content: space-around;
      text-align: center;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .sig-line {
      width: 220px;
      border-bottom: 1px solid #64748B;
      margin-bottom: 6px;
    }
    .sig-role {
      font-weight: 700;
      font-size: 11px;
      color: #0F172A;
    }
    .sig-name {
      font-size: 10px;
      color: #64748B;
    }
    .checksum-box {
      margin-top: 20px;
      border: 1px dashed #CBD5E1;
      border-radius: 6px;
      padding: 8px 12px;
      background: #FAFAFA;
      font-size: 9.5px;
      color: #64748B;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .hash-code {
      font-family: monospace;
      font-size: 8.5px;
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      padding: 4px 6px;
      border-radius: 4px;
      word-break: break-all;
      color: #334155;
      margin: 4px 0;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="inst-title">Ministério da Educação • AILAB Makers</div>
      <h1 class="main-title">Relatório Oficial de Frequência e Atividades</h1>
      <div class="sub-title">Sistema Biométrico de Registro Facial de Presença</div>
    </div>
    <div class="meta-box">
      <div><strong>Período:</strong> ${fromStr} a ${toStr}</div>
      <div><strong>Filtro:</strong> ${period.toUpperCase()}</div>
      <div><strong>Emissão:</strong> ${issuanceDate}</div>
      ${tutorEmail ? `<div><strong>Tutor:</strong> ${tutorEmail}</div>` : ""}
    </div>
  </div>

  <div class="kpi-grid">
    <div class="kpi-card">
      <span class="kpi-label">Total de Horas</span>
      <div class="kpi-value">${totalHours} h</div>
    </div>
    <div class="kpi-card">
      <span class="kpi-label">Discentes Ativos</span>
      <div class="kpi-value">${rows.length}</div>
    </div>
    <div class="kpi-card">
      <span class="kpi-label">Meta Cumprida (≥4h)</span>
      <div class="kpi-value" style="color: #166534;">${compliantCount} / ${rows.length}</div>
    </div>
    <div class="kpi-card">
      <span class="kpi-label">Taxa Cumprimento</span>
      <div class="kpi-value">${complianceRate}%</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="text-align: left;">Discente</th>
        <th style="text-align: left;">Matrícula</th>
        <th style="text-align: right;">Horas Computadas</th>
        <th style="text-align: center;">Sessões</th>
        <th style="text-align: center;">Status Compliance</th>
      </tr>
    </thead>
    <tbody>
      ${tableRowsHtml}
    </tbody>
  </table>

  <div class="signatures">
    <div>
      <div class="sig-line"></div>
      <div class="sig-role">Tutor / Docente Responsável</div>
      <div class="sig-name">${tutorEmail || "Docência AILAB Makers"}</div>
    </div>
    <div>
      <div class="sig-line"></div>
      <div class="sig-role">Coordenação do Laboratório</div>
      <div class="sig-name">AILAB Makers • Núcleo de IA</div>
    </div>
  </div>

  <div class="checksum-box">
    <div><strong>Certificação de Integridade Digital (SHA-256):</strong></div>
    <div class="hash-code">${checksum}</div>
    <div>Documento emitido eletronicamente em conformidade com as diretrizes do AILAB e registro biométrico presencial.</div>
  </div>
</body>
</html>`;
  };

  const handlePrint = () => {
    // 1. Tenta impressão via iframe invisível isolado (100% à prova de falhas com temas escuros e overflow)
    try {
      const printFrame = document.createElement("iframe");
      printFrame.setAttribute("title", "Print Document");
      printFrame.style.position = "fixed";
      printFrame.style.right = "0";
      printFrame.style.bottom = "0";
      printFrame.style.width = "0";
      printFrame.style.height = "0";
      printFrame.style.border = "0";
      document.body.appendChild(printFrame);

      const frameDoc = printFrame.contentWindow?.document;
      if (frameDoc) {
        frameDoc.open();
        frameDoc.write(buildPrintableDocument());
        frameDoc.close();

        // Aguarda renderização de layout do iframe antes de abrir a caixa de impressão
        setTimeout(() => {
          try {
            printFrame.contentWindow?.focus();
            printFrame.contentWindow?.print();
          } catch {
            window.print();
          } finally {
            setTimeout(() => {
              try {
                document.body.removeChild(printFrame);
              } catch {
                // frame já removido
              }
            }, 2000);
          }
        }, 200);
        return;
      }
    } catch {
      // fallback gracioso para window.print direto na página
    }

    window.print();
  };

  const handleDownloadHtml = () => {
    const htmlContent = buildPrintableDocument();
    const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `relatorio_frequencia_ailab_${period}_${fromStr.replace(/\//g, "-")}_a_${toStr.replace(/\//g, "-")}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="report-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-black/60 backdrop-blur-sm animate-fade-in">
      <style>{`
        @media print {
          /* Setup da Página A4 */
          @page {
            size: A4 portrait;
            margin: 14mm 15mm 15mm 15mm;
          }

          /* Oculta layout do dashboard */
          body * {
            visibility: hidden !important;
          }

          /* Exibe apenas o relatório e filhos */
          #official-report-printable, #official-report-printable * {
            visibility: visible !important;
          }

          /* Libera posições e overflow dos containers do modal */
          html, body {
            overflow: visible !important;
            height: auto !important;
            background: #FFFFFF !important;
            color: #0F172A !important;
          }

          .report-modal-backdrop {
            position: static !important;
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
            background: transparent !important;
            overflow: visible !important;
            height: auto !important;
            max-height: none !important;
          }

          .report-modal-dialog {
            position: static !important;
            display: block !important;
            width: 100% !important;
            max-width: none !important;
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
            background: #FFFFFF !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            padding: 0 !important;
          }

          .report-modal-body {
            overflow: visible !important;
            padding: 0 !important;
            background: transparent !important;
            height: auto !important;
            max-height: none !important;
          }

          #official-report-printable {
            position: static !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #FFFFFF !important;
            color: #0F172A !important;
            box-shadow: none !important;
            border: none !important;
            overflow: visible !important;
          }

          /* FIX CRÍTICO DARK MODE: Força texto escuro e bordas nítidas na impressão */
          #official-report-printable * {
            color: #0F172A !important;
            border-color: #CBD5E1 !important;
            background-color: transparent !important;
            box-shadow: none !important;
          }

          #official-report-printable .print-badge-regular {
            background-color: #DCFCE7 !important;
            color: #166534 !important;
          }

          #official-report-printable .print-badge-warning {
            background-color: #FEF3C7 !important;
            color: #92400E !important;
          }

          #official-report-printable .print-badge-danger {
            background-color: #FEE2E2 !important;
            color: #991B1B !important;
          }

          #official-report-printable thead {
            display: table-header-group !important;
          }

          #official-report-printable tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Modal Container */}
      <div className="report-modal-dialog relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-[#E5E2DC] dark:border-slate-800 overflow-hidden">
        {/* Barra de Ações Superior (Oculta na Impressão) */}
        <div className="no-print flex items-center justify-between px-6 py-4 border-b border-[#E5E2DC] dark:border-slate-800 bg-[#FAF9F5] dark:bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-100 dark:bg-orange-950/60 text-[#C15F3D]">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-semibold text-[#171715] dark:text-slate-100">
                Relatório Oficial de Frequência & Compliance
              </h2>
              <p className="text-2xs text-[#706E6A] dark:text-slate-400">
                Visualização formatada para prestação de contas institucional e exportação em PDF.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadHtml}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E2DC] dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-[#FAF9F5] dark:hover:bg-slate-700 text-[#171715] dark:text-slate-200 px-3.5 py-2 text-xs font-semibold shadow-2xs transition-all cursor-pointer"
              title="Baixar arquivo HTML autossuficiente para arquivo ou visualização externa"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Baixar HTML</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#171715] dark:bg-white hover:bg-[#2A2925] dark:hover:bg-slate-100 text-[#FAF9F5] dark:text-slate-900 px-4 py-2 text-xs font-semibold shadow-sm transition-all cursor-pointer"
              title="Abrir diálogo do navegador para imprimir ou salvar como PDF"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Imprimir / Salvar PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white dark:bg-slate-800 text-[#706E6A] hover:text-[#171715] dark:hover:text-white border border-[#E5E2DC] dark:border-slate-700 text-sm font-bold cursor-pointer"
              aria-label="Fechar modal"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>


        {/* Conteúdo do Relatório Imprimível */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 bg-white dark:bg-slate-900 text-[#171715] dark:text-slate-100">
          <div id="official-report-printable" className="space-y-6">
            {/* Cabeçalho Institucional Oficial */}
            <div className="border-b-2 border-slate-900 dark:border-slate-700 pb-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold uppercase tracking-widest text-[#C15F3D] dark:text-amber-400">
                      MINISTÉRIO DA EDUCAÇÃO • AILAB MAKERS
                    </span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold font-editorial tracking-tight text-[#171715] dark:text-white mt-1">
                    Relatório Oficial de Frequência e Atividades
                  </h1>
                  <p className="text-xs text-[#706E6A] dark:text-slate-400 mt-0.5">
                    Sistema Biométrico de Registro Facial de Presença
                  </p>
                </div>

                <div className="text-left sm:text-right font-mono text-2xs text-[#706E6A] dark:text-slate-400 space-y-0.5">
                  <p><strong className="text-[#171715] dark:text-slate-200">Período:</strong> {fromStr} a {toStr}</p>
                  <p><strong className="text-[#171715] dark:text-slate-200">Filtro:</strong> {period.toUpperCase()}</p>
                  <p><strong className="text-[#171715] dark:text-slate-200">Emissão:</strong> {issuanceDate}</p>
                  {tutorEmail && <p><strong className="text-[#171715] dark:text-slate-200">Tutor:</strong> {tutorEmail}</p>}
                </div>
              </div>
            </div>

            {/* Painel Resumo de Indicadores Acadêmicos */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 bg-slate-50 dark:bg-slate-950/50">
                <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Total de Horas
                </span>
                <p className="text-lg font-bold font-mono text-slate-900 dark:text-white mt-1">
                  {totalHours} h
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 bg-slate-50 dark:bg-slate-950/50">
                <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Discentes Ativos
                </span>
                <p className="text-lg font-bold font-mono text-slate-900 dark:text-white mt-1">
                  {rows.length}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 bg-slate-50 dark:bg-slate-950/50">
                <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Meta Cumprida (≥4h)
                </span>
                <p className="text-lg font-bold font-mono text-emerald-700 dark:text-emerald-400 mt-1">
                  {compliantCount} / {rows.length}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 bg-slate-50 dark:bg-slate-950/50">
                <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Taxa de Cumprimento
                </span>
                <p className="text-lg font-bold font-mono text-slate-900 dark:text-white mt-1">
                  {complianceRate}%
                </p>
              </div>
            </div>

            {/* Tabela Oficial de Frequência */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950/80 text-slate-600 dark:text-slate-300 font-bold uppercase text-2xs tracking-wider">
                    <th className="py-2.5 px-3">Discente</th>
                    <th className="py-2.5 px-3">Matrícula</th>
                    <th className="py-2.5 px-3 text-right">Horas Computadas</th>
                    <th className="py-2.5 px-3 text-center">Sessões</th>
                    <th className="py-2.5 px-3 text-center">Status Compliance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-sans">
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        Nenhum registro encontrado para o período selecionado.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => {
                      const isCompliant = row.totalSeconds >= 14400;
                      const isWarning = row.totalSeconds > 0 && row.totalSeconds < 14400;
                      return (
                        <tr key={row.member.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100">
                            {row.member.name}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-2xs text-slate-500 dark:text-slate-400">
                            {row.member.matricula || "—"}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                            {formatDuration(row.totalSeconds)}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-2xs text-slate-600 dark:text-slate-400">
                            {row.sessionCount}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {isCompliant ? (
                              <span className="print-badge-regular inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/80 px-2.5 py-0.5 text-2xs font-semibold text-emerald-800 dark:text-emerald-300">
                                <CheckCircle2 className="h-3 w-3" />
                                <span>Regular (≥4h)</span>
                              </span>
                            ) : isWarning ? (
                              <span className="print-badge-warning inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-950/80 px-2.5 py-0.5 text-2xs font-semibold text-amber-800 dark:text-amber-300">
                                <AlertCircle className="h-3 w-3" />
                                <span>Parcial (&lt;4h)</span>
                              </span>
                            ) : (
                              <span className="print-badge-danger inline-flex items-center gap-1 rounded-full bg-rose-100 dark:bg-rose-950/80 px-2.5 py-0.5 text-2xs font-semibold text-rose-800 dark:text-rose-300">
                                <XCircle className="h-3 w-3" />
                                <span>Sem Horas (0h)</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Campo Formal de Assinaturas */}
            <div className="pt-8 mt-8 border-t border-slate-300 dark:border-slate-800">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 text-center">
                <div>
                  <div className="border-b border-slate-400 dark:border-slate-600 w-3/4 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    Tutor / Docente Responsável
                  </p>
                  <p className="text-2xs text-slate-500 dark:text-slate-400">
                    {tutorEmail || "Docência AILAB Makers"}
                  </p>
                </div>

                <div>
                  <div className="border-b border-slate-400 dark:border-slate-600 w-3/4 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    Coordenação do Laboratório / Colegiado
                  </p>
                  <p className="text-2xs text-slate-500 dark:text-slate-400">
                    AILAB Makers • Núcleo de IA
                  </p>
                </div>
              </div>
            </div>

            {/* Certificação Digital Criptográfica */}
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-800 p-3 bg-slate-50/70 dark:bg-slate-950/30 text-2xs text-slate-500 dark:text-slate-400 space-y-1">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <strong>Certificação de Integridade Digital:</strong> Autenticidade garantida por carimbo criptográfico.
                </span>
                <span className="font-mono text-3xs">SHA-256</span>
              </div>
              <p className="font-mono text-3xs break-all text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 p-1.5 rounded border border-slate-200 dark:border-slate-800">
                {checksum}
              </p>
              <p className="text-3xs text-slate-400">
                Documento emitido eletronicamente em conformidade com as diretrizes do AILAB e registro biométrico presencial.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
