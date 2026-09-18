import { useEffect, useMemo, useState, useRef } from "react";
import type { Member, SessionRecord } from "../lib/reports";
import { formatDuration, sessionSeconds } from "../lib/aggregate";
import { rangeFor } from "../lib/period";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  members: Member[];
  sessions: SessionRecord[];
  tutorEmail: string;
}

interface WarningRecord {
  memberId: string;
  memberName: string;
  matricula?: string;
  hoursDone: string;
  hoursNeeded: string;
  date: string;
}

const STORAGE_KEY = "ailab_tutor_warnings";

export function TutorWarningModal({
  isOpen,
  onClose,
  members,
  sessions,
  tutorEmail,
}: Props) {
  const [filterMode, setFilterMode] = useState<"under" | "met" | "all">("under");
  const [search, setSearch] = useState("");
  const [warnings, setWarnings] = useState<Record<string, WarningRecord>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [batchCopied, setBatchCopied] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isCompactView, setIsCompactView] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

  // Carrega advertências persistidas
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setWarnings(JSON.parse(raw));
    } catch {
      // Ignora erro de parse
    }
  }, [isOpen]);

  // Salva advertências
  const saveWarning = (record: WarningRecord) => {
    const next = { ...warnings, [record.memberId]: record };
    setWarnings(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignora erro de quota
    }
  };

  const removeWarning = (memberId: string) => {
    const next = { ...warnings };
    delete next[memberId];
    setWarnings(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignora erro
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedElementRef.current = document.activeElement as HTMLElement | null;
    document.body.classList.add("modal-open");

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === "Tab" && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.classList.remove("modal-open");
      window.removeEventListener("keydown", handleKeyDown);
      if (previouslyFocusedElementRef.current) {
        previouslyFocusedElementRef.current.focus();
      }
    };
  }, [isOpen, onClose]);

  // Calcula sessões da semana atual
  const weeklyTotals = useMemo(() => {
    const weekRange = rangeFor("week");
    const now = new Date();

    // Filtra sessões válidas dentro da semana
    const weekSessions = sessions.filter((s) => {
      const checkInDate = new Date(s.checkIn);
      return checkInDate >= weekRange.from && checkInDate <= weekRange.to;
    });

    const secondsMap = new Map<string, number>();
    for (const m of members) {
      secondsMap.set(m.id, 0);
    }

    for (const s of weekSessions) {
      if (s.voidedAt != null) continue;
      const current = secondsMap.get(s.profileId) ?? 0;
      secondsMap.set(s.profileId, current + sessionSeconds(s, now));
    }

    const TARGET_SECONDS = 4 * 3600; // 4 horas = 14.400s

    return members.map((member) => {
      const totalSeconds = secondsMap.get(member.id) ?? 0;
      const metTarget = totalSeconds >= TARGET_SECONDS;
      const deficitSeconds = Math.max(0, TARGET_SECONDS - totalSeconds);
      const progressPercent = Math.min(100, Math.round((totalSeconds / TARGET_SECONDS) * 100));

      return {
        member,
        totalSeconds,
        metTarget,
        deficitSeconds,
        progressPercent,
      };
    });
  }, [members, sessions]);

  // Estatísticas do resumo
  const totalStudents = weeklyTotals.length;
  const underTargetStudents = useMemo(
    () => weeklyTotals.filter((item) => !item.metTarget),
    [weeklyTotals]
  );
  const metTargetCount = totalStudents - underTargetStudents.length;

  const neverPresentStudents = useMemo(
    () => weeklyTotals.filter((item) => item.totalSeconds === 0),
    [weeklyTotals]
  );

  // Filtragem e busca
  const filteredList = useMemo(() => {
    const q = search.trim().toLowerCase();
    return weeklyTotals
      .filter((item) => {
        if (filterMode === "under" && item.metTarget) return false;
        if (filterMode === "met" && !item.metTarget) return false;
        if (!q) return true;
        return (
          item.member.name.toLowerCase().includes(q) ||
          (item.member.matricula && item.member.matricula.includes(q))
        );
      })
      .sort((a, b) => a.totalSeconds - b.totalSeconds);
  }, [weeklyTotals, filterMode, search]);

  const generateNoticeText = (item: (typeof weeklyTotals)[0]) => {
    return `[AiLab Makers · Comunicado Acadêmico de Frequência]
Prezado(a) ${item.member.name} (Matrícula: ${item.member.matricula ?? "N/A"}):
Informamos que nesta semana você registrou ${formatDuration(item.totalSeconds)} de permanência no laboratório.
A meta obrigatória semanal é de 4h00 (débito restante de ${formatDuration(item.deficitSeconds)}).
Pedimos que regularize seu horário até o encerramento do ciclo semanal para manter sua situação acadêmica regular.
— Coordenação & Tutoria AiLab (${tutorEmail})`;
  };

  const handleCopyNotice = (item: (typeof weeklyTotals)[0]) => {
    const text = generateNoticeText(item);
    navigator.clipboard.writeText(text);
    setCopiedId(item.member.id);

    // Registra a advertência
    saveWarning({
      memberId: item.member.id,
      memberName: item.member.name,
      matricula: item.member.matricula ?? undefined,
      hoursDone: formatDuration(item.totalSeconds),
      hoursNeeded: formatDuration(item.deficitSeconds),
      date: new Date().toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
    });

    setTimeout(() => {
      setCopiedId(null);
    }, 3000);
  };

  const handleOpenWhatsApp = (item: (typeof weeklyTotals)[0]) => {
    const text = generateNoticeText(item);
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");

    saveWarning({
      memberId: item.member.id,
      memberName: item.member.name,
      matricula: item.member.matricula ?? undefined,
      hoursDone: formatDuration(item.totalSeconds),
      hoursNeeded: formatDuration(item.deficitSeconds),
      date: new Date().toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
    });
  };

  const toggleSelectMember = (id: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectAllUnderTarget = () => {
    const underIds = underTargetStudents.map((s) => s.member.id);
    setSelectedMemberIds(underIds);
  };

  const clearSelection = () => {
    setSelectedMemberIds([]);
  };

  const selectedItems = useMemo(() => {
    return weeklyTotals.filter((item) => selectedMemberIds.includes(item.member.id));
  }, [weeklyTotals, selectedMemberIds]);

  const generateBatchNoticeText = () => {
    const lines = [
      `[AiLab Makers · Relatório & Comunicado Coletivo de Frequência Semanal]`,
      `Emissão: ${new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}`,
      `Tutor Responsável: ${tutorEmail}`,
      `Meta Semanal Obrigatória: 4h 00m\n`,
      `Total de alunos selecionados em acompanhamento: ${selectedItems.length}`,
      `--------------------------------------------------`,
    ];

    selectedItems.forEach((item, index) => {
      lines.push(
        `${index + 1}. ${item.member.name} (Matrícula: ${item.member.matricula ?? "N/A"})` +
        `\n   • Horas registradas: ${formatDuration(item.totalSeconds)}` +
        `\n   • Débito restante: ${formatDuration(item.deficitSeconds)} (${item.progressPercent}% cumprido)`
      );
    });

    lines.push(
      `--------------------------------------------------`,
      `Solicitamos a regularização das horas até o encerramento da semana letiva.`,
      `— Coordenação AiLab Makers`
    );

    return lines.join("\n");
  };

  const handleCopyBatchNotice = () => {
    const text = generateBatchNoticeText();
    navigator.clipboard.writeText(text);
    setBatchCopied(true);

    const nextWarnings = { ...warnings };
    const dateStr = new Date().toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

    selectedItems.forEach((item) => {
      nextWarnings[item.member.id] = {
        memberId: item.member.id,
        memberName: item.member.name,
        matricula: item.member.matricula ?? undefined,
        hoursDone: formatDuration(item.totalSeconds),
        hoursNeeded: formatDuration(item.deficitSeconds),
        date: dateStr,
      };
    });

    setWarnings(nextWarnings);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextWarnings));
    } catch {
      // Ignora erro
    }

    setTimeout(() => {
      setBatchCopied(false);
    }, 3000);
  };

  const handleOpenBatchWhatsApp = () => {
    const text = generateBatchNoticeText();
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");

    const nextWarnings = { ...warnings };
    const dateStr = new Date().toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

    selectedItems.forEach((item) => {
      nextWarnings[item.member.id] = {
        memberId: item.member.id,
        memberName: item.member.name,
        matricula: item.member.matricula ?? undefined,
        hoursDone: formatDuration(item.totalSeconds),
        hoursNeeded: formatDuration(item.deficitSeconds),
        date: dateStr,
      };
    });

    setWarnings(nextWarnings);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextWarnings));
    } catch {
      // Ignora erro
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm overflow-hidden animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutor-modal-title"
    >
      <div
        ref={modalRef}
        className="relative w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-4xl bg-background sm:bg-background/98 sm:backdrop-blur-2xl sm:rounded-3xl border-0 sm:border sm:border-stone-200/80 dark:bg-slate-900 dark:sm:bg-slate-900/98 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-scale-up text-slate-900 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header estilo Editorial Claude com Safe-Area para Celular */}
        <div className="shrink-0 flex items-center justify-between border-b border-stone-200/70 dark:border-slate-800 bg-background/90 dark:bg-slate-900/90 pt-[max(env(safe-area-inset-top),16px)] pb-4 px-4 sm:px-6 gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white font-serif text-2xl shadow-md shadow-amber-500/20">
              §
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-editorial-italic text-xs sm:text-sm text-stone-500 dark:text-stone-400 hidden xs:inline">
                  Governança &bull;
                </span>
                <h2
                  id="tutor-modal-title"
                  className="font-editorial text-lg sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight truncate"
                >
                  Auditoria Semanal de Permanência
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 font-medium truncate mt-0.5">
                Tutor: <strong className="text-slate-800 dark:text-slate-200 font-mono-data">{tutorEmail}</strong> · Meta: <strong className="text-slate-800 dark:text-slate-200 font-mono-data">4h 00m / sem</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Fechar modal de auditoria"
            className="flex h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full bg-stone-100 dark:bg-slate-800 hover:bg-stone-200 dark:hover:bg-slate-700 text-stone-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer text-base font-bold"
          >
            ✕
          </button>
        </div>

        {/* Resumo de Indicadores Ampliado para Celular com Estilo Claude / Perplexity */}
        <div className="shrink-0 p-3 sm:p-5 border-b border-stone-200/70 dark:border-slate-800 bg-stone-100/50 dark:bg-slate-800/60 grid grid-cols-3 gap-2.5 sm:gap-4">
          {/* Total */}
          <div className="claude-card rounded-2xl p-3 sm:p-4 text-center sm:text-left dark:bg-slate-800 dark:border-slate-700">
            <span className="text-2xs sm:text-xs font-bold uppercase tracking-widest text-stone-500 dark:text-slate-400 block truncate font-sans">
              Total Alunos
            </span>
            <span className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-slate-100 mt-1 block font-mono-data tracking-apple-tightest">
              {totalStudents}
            </span>
            <span className="hidden sm:inline-block text-2xs text-stone-400 font-medium mt-0.5">
              {totalStudents > 0 ? Math.round((metTargetCount / totalStudents) * 100) : 0}% em conformidade
            </span>
          </div>

          {/* Abaixo da Meta */}
          <div className="claude-card rounded-2xl border-amber-500/30 dark:border-amber-700/30 bg-gradient-to-br from-amber-500/[0.12] via-amber-500/[0.04] to-white dark:from-amber-500/[0.15] dark:via-amber-500/[0.06] dark:to-transparent dark:bg-slate-800 p-3 sm:p-4 text-center sm:text-left">
            <span className="text-2xs sm:text-xs font-bold uppercase tracking-widest text-amber-800 dark:text-amber-300 block truncate font-sans">
              Em Débito
            </span>
            <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-2 mt-1">
              <span className="text-2xl sm:text-4xl font-extrabold text-amber-900 dark:text-amber-200 font-mono-data tracking-apple-tightest">
                {underTargetStudents.length}
              </span>
              <span className="inline-flex items-center justify-center rounded-full bg-amber-500/20 dark:bg-amber-500/30 px-2 py-0.5 text-2xs font-bold text-amber-900 dark:text-amber-200 font-mono-data">
                &lt; 4h
              </span>
            </div>
            <span className="hidden sm:inline-block text-2xs text-amber-700 dark:text-amber-400 font-medium mt-0.5">
              {totalStudents > 0 ? Math.round((underTargetStudents.length / totalStudents) * 100) : 0}% pendentes
            </span>
          </div>

          {/* Regularizados */}
          <div className="claude-card rounded-2xl border-emerald-500/30 dark:border-emerald-700/30 bg-gradient-to-br from-emerald-500/[0.12] via-emerald-500/[0.04] to-white dark:from-emerald-500/[0.15] dark:via-emerald-500/[0.06] dark:to-transparent dark:bg-slate-800 p-3 sm:p-4 text-center sm:text-left">
            <span className="text-2xs sm:text-xs font-bold uppercase tracking-widest text-emerald-800 dark:text-emerald-300 block truncate font-sans">
              Cumprida
            </span>
            <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-2 mt-1">
              <span className="text-2xl sm:text-4xl font-extrabold text-emerald-900 dark:text-emerald-200 font-mono-data tracking-apple-tightest">
                {metTargetCount}
              </span>
              <span className="inline-flex items-center justify-center rounded-full bg-emerald-500/20 dark:bg-emerald-500/30 px-2 py-0.5 text-2xs font-bold text-emerald-900 dark:text-emerald-200 font-mono-data">
                &ge; 4h
              </span>
            </div>
            <span className="hidden sm:inline-block text-2xs text-emerald-700 dark:text-emerald-400 font-bold mt-0.5">
              {totalStudents > 0 ? Math.round((metTargetCount / totalStudents) * 100) : 0}% da turma
            </span>
          </div>
        </div>

        {/* Alerta de Ausentes Completos */}
        {neverPresentStudents.length > 0 && (
          <div className="shrink-0 px-3 sm:px-5 py-2.5 border-b border-stone-200/70 dark:border-slate-800 bg-rose-50/60 dark:bg-rose-950/20 flex items-center gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-500/20 dark:bg-rose-500/30 text-sm">🚫</span>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-bold text-rose-800 dark:text-rose-300">
                {neverPresentStudents.length} {neverPresentStudents.length === 1 ? 'aluno ausente' : 'alunos ausentes'} esta semana
              </span>
              <span className="text-2xs text-rose-600/80 dark:text-rose-400/80 ml-1.5 font-sans">
                — sem nenhum registro de presença
              </span>
            </div>
            <span className="text-2xs font-mono-data text-rose-700 dark:text-rose-400 shrink-0 font-bold">
              {neverPresentStudents.map(s => s.member.name.split(' ')[0]).slice(0, 3).join(', ')}{neverPresentStudents.length > 3 ? ` +${neverPresentStudents.length - 3}` : ''}
            </span>
          </div>
        )}

        {/* Barra de Filtros e Busca estilo Perplexity Command Bar */}
        <div className="shrink-0 p-3 sm:p-4 border-b border-stone-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            {/* Segmented Control estilo Claude Pill */}
            <div className="flex items-center rounded-2xl bg-stone-200/60 dark:bg-slate-800 p-1 gap-1">
              <button
                type="button"
                onClick={() => setFilterMode("under")}
                className={`flex-1 sm:flex-none rounded-xl px-3.5 py-2 text-xs sm:text-sm font-bold transition-all cursor-pointer min-h-[38px] ${
                  filterMode === "under"
                    ? "bg-white dark:bg-slate-700 text-amber-900 dark:text-amber-300 shadow-sm font-extrabold"
                    : "text-stone-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium"
                }`}
              >
                ⚠️ Em Débito ({underTargetStudents.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode("met")}
                className={`flex-1 sm:flex-none rounded-xl px-3.5 py-2 text-xs sm:text-sm font-bold transition-all cursor-pointer min-h-[38px] ${
                  filterMode === "met"
                    ? "bg-white dark:bg-slate-700 text-emerald-900 dark:text-emerald-300 shadow-sm font-extrabold"
                    : "text-stone-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium"
                }`}
              >
                ✓ Cumprida ({metTargetCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode("all")}
                className={`flex-1 sm:flex-none rounded-xl px-3.5 py-2 text-xs sm:text-sm font-bold transition-all cursor-pointer min-h-[38px] ${
                  filterMode === "all"
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm font-extrabold"
                    : "text-stone-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium"
                }`}
              >
                Todos ({totalStudents})
              </button>
            </div>

            {/* Perplexity Spotlight Search */}
            <div className="relative flex-1 sm:max-w-xs group">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-stone-400 dark:text-slate-500 group-focus-within:text-teal-600 dark:group-focus-within:text-teal-400">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
              </div>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onPointerDown={(e) => e.stopPropagation()}
                placeholder="Buscar aluno ou matrícula..."
                className="w-full rounded-2xl border border-stone-200/90 dark:border-slate-700 bg-stone-50/70 dark:bg-slate-800 py-2.5 pl-10 pr-9 text-sm text-slate-900 dark:text-slate-100 placeholder:text-stone-400 dark:placeholder:text-slate-400 focus:border-teal-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-4 focus:ring-teal-500/10 shadow-inner transition-all font-medium"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-stone-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer text-sm"
                  aria-label="Limpar busca"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Barra de Ações Rápidas em Lote e Alternador de Densidade */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-100 dark:border-slate-800 text-xs font-sans">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (selectedMemberIds.length === underTargetStudents.length && underTargetStudents.length > 0) {
                    clearSelection();
                  } else {
                    selectAllUnderTarget();
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 hover:bg-stone-100 dark:hover:bg-slate-750 px-2.5 py-1.5 text-slate-700 dark:text-slate-200 font-medium transition-colors cursor-pointer"
              >
                <span>{selectedMemberIds.length === underTargetStudents.length && underTargetStudents.length > 0 ? "☑️" : "☐"}</span>
                <span>
                  {selectedMemberIds.length === underTargetStudents.length && underTargetStudents.length > 0
                    ? "Desmarcar todos"
                    : `Selecionar todos em débito (${underTargetStudents.length})`}
                </span>
              </button>

              {selectedMemberIds.length > 0 && (
                <button
                  type="button"
                  onClick={clearSelection}
                  className="text-2xs text-stone-500 hover:text-stone-800 dark:text-slate-400 dark:hover:text-slate-200 underline cursor-pointer"
                >
                  Limpar ({selectedMemberIds.length})
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsCompactView((prev) => !prev)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 px-2.5 py-1.5 text-2xs font-medium text-slate-700 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-700 cursor-pointer transition-colors"
              title="Alternar entre visualização densa ou cartões expandidos"
              aria-pressed={isCompactView}
            >
              <span>{isCompactView ? "📑 Modo Detalhado" : "⚡ Modo Compacto (50+ alunos)"}</span>
            </button>
          </div>
        </div>

        {/* Lista de Alunos com suporte a Modo Compacto e Seleção em Lote */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-5 space-y-3 bg-stone-100/30 dark:bg-slate-950/40">
          {filteredList.length === 0 ? (
            <div className="claude-card rounded-3xl p-8 sm:p-12 text-center bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800">
              <div className="font-editorial-italic text-3xl text-stone-400 mb-2">✦</div>
              <p className="font-editorial text-lg font-bold text-slate-800 dark:text-slate-100">
                Nenhum registro encontrado
              </p>
              <p className="text-xs sm:text-sm text-stone-500 dark:text-slate-400 mt-1">
                Ajuste os termos da busca ou altere o filtro de frequência semanal.
              </p>
            </div>
          ) : isCompactView ? (
            /* Modo Compacto: Linhas Densas para Leitura Rápida de 50+ Integrantes */
            <div className="space-y-2">
              {filteredList.map((item) => {
                const warning = warnings[item.member.id];
                const isCopied = copiedId === item.member.id;
                const isSelected = selectedMemberIds.includes(item.member.id);

                return (
                  <div
                    key={item.member.id}
                    className={`rounded-2xl border p-3 transition-all flex items-center justify-between gap-3 ${
                      isSelected
                        ? "border-amber-400 bg-amber-50/70 dark:bg-amber-950/40 dark:border-amber-600 shadow-sm"
                        : item.metTarget
                        ? "border-emerald-500/20 bg-white dark:bg-slate-900 dark:border-slate-800"
                        : "border-amber-500/30 bg-white dark:bg-slate-900 dark:border-amber-800/40"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectMember(item.member.id)}
                        aria-label={`Selecionar ${item.member.name}`}
                        className="h-4 w-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-sans font-semibold text-xs sm:text-sm text-slate-900 dark:text-slate-100 truncate block">
                            {item.member.name}
                          </span>
                          {item.member.matricula && (
                            <span className="text-2xs font-mono-data text-stone-500 dark:text-slate-400">
                              {item.member.matricula}
                            </span>
                          )}
                          {warning && (
                            <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.2 text-[10px] font-bold text-amber-900 dark:text-amber-300 font-mono-data">
                              ⚠️ Advertido
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-2xs text-stone-500 dark:text-slate-400 font-mono-data mt-0.5">
                          <span>Permanência: <strong className="text-slate-800 dark:text-slate-200">{formatDuration(item.totalSeconds)}</strong></span>
                          {!item.metTarget ? (
                            <span className="text-amber-700 dark:text-amber-400 font-bold">• Faltam {formatDuration(item.deficitSeconds)} ({item.progressPercent}%)</span>
                          ) : (
                            <span className="text-emerald-700 dark:text-emerald-400 font-bold">• Meta cumprida</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {!item.metTarget ? (
                        <button
                          type="button"
                          onClick={() => handleCopyNotice(item)}
                          className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer min-h-[34px] inline-flex items-center justify-center gap-1.5 ${
                            isCopied
                              ? "bg-emerald-600 text-white"
                              : "bg-amber-600 hover:bg-amber-700 text-white shadow-2xs"
                          }`}
                        >
                          {isCopied ? "✓ Copiado!" : "⚠️ Advertir"}
                        </button>
                      ) : (
                        <span className="text-emerald-700 dark:text-emerald-400 font-bold text-xs inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/10 rounded-lg">
                          ✓ Ok
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Modo Detalhado / Cards Expandidos */
            filteredList.map((item) => {
              const warning = warnings[item.member.id];
              const isCopied = copiedId === item.member.id;
              const isSelected = selectedMemberIds.includes(item.member.id);

              return (
                <div
                  key={item.member.id}
                  className={`claude-card rounded-3xl p-4 sm:p-5 transition-all space-y-3.5 bg-white dark:bg-slate-900 ${
                    isSelected
                      ? "ring-2 ring-amber-500 border-amber-400 dark:border-amber-600"
                      : item.metTarget
                      ? "border-emerald-500/25 dark:border-emerald-800/40 shadow-claude"
                      : "border-amber-500/35 dark:border-amber-800/50 shadow-claude"
                  }`}
                >
                  {/* Informações do Aluno com Checkbox de Seleção */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectMember(item.member.id)}
                        aria-label={`Selecionar ${item.member.name}`}
                        className="h-4 w-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer shrink-0"
                      />
                      {item.member.avatarUrl ? (
                        <img
                          src={item.member.avatarUrl}
                          alt={item.member.name}
                          className="h-12 w-12 sm:h-14 sm:w-14 shrink-0 rounded-2xl object-cover shadow-claude ring-1 ring-stone-200 dark:ring-slate-700"
                        />
                      ) : (
                        <div
                          className={`flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl text-base sm:text-xl font-editorial font-bold shadow-claude ${
                            item.metTarget
                              ? "bg-gradient-to-br from-emerald-600 to-teal-700 text-white"
                              : "bg-gradient-to-br from-amber-500 to-orange-600 text-white"
                          }`}
                        >
                          {item.member.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-editorial text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight truncate">
                            {item.member.name}
                          </h3>
                          {warning && (
                            <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-2xs font-bold text-amber-900 dark:text-amber-300 font-mono-data inline-flex items-center gap-1">
                              <span>⚠️</span>
                              <span>Advertido ({warning.date})</span>
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-stone-500 dark:text-slate-400 font-medium mt-0.5">
                          Matrícula:{" "}
                          <strong className="text-slate-800 dark:text-slate-200 font-mono-data">
                            {item.member.matricula ?? "Não informada"}
                          </strong>
                        </p>
                      </div>
                    </div>

                    {/* Badge ou Ação em Desktop */}
                    <div className="hidden sm:flex items-center gap-2 shrink-0">
                      {!item.metTarget ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleCopyNotice(item)}
                            className={`rounded-2xl px-4 py-2.5 text-xs sm:text-sm font-bold transition-all shadow-claude cursor-pointer min-h-[42px] inline-flex items-center justify-center gap-2 active:scale-95 ${
                              isCopied
                                ? "bg-emerald-600 text-white"
                                : "bg-gradient-to-r from-amber-600 to-orange-600 text-white hover:from-amber-700 hover:to-orange-700"
                            }`}
                          >
                            {isCopied ? "✓ Copiado!" : "⚠️ Advertir"}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenWhatsApp(item)}
                            title="Abrir WhatsApp com o comunicado pré-formatado"
                            className="rounded-2xl border border-emerald-600/30 dark:border-emerald-600/40 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100/70 dark:hover:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 px-3.5 py-2.5 text-xs sm:text-sm font-bold transition-all shadow-2xs cursor-pointer min-h-[42px] inline-flex items-center justify-center gap-1.5 active:scale-95"
                          >
                            <span>📲</span>
                            <span>WhatsApp</span>
                          </button>

                          {warning && (
                            <button
                              type="button"
                              onClick={() => removeWarning(item.member.id)}
                              className="text-xs text-stone-400 dark:text-slate-500 hover:text-amber-800 dark:hover:text-amber-400 underline font-medium cursor-pointer px-1"
                              title="Remover registro de advertência deste aluno"
                            >
                              Desfazer
                            </button>
                          )}
                        </>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 px-4 py-2 text-xs sm:text-sm font-bold text-emerald-800 dark:text-emerald-300">
                          <span>✓</span>
                          <span>Meta Cumprida</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Detalhes de Horas e Barra de Progresso Ampliada */}
                  <div className="rounded-2xl bg-stone-50 dark:bg-slate-800/80 p-3 sm:p-4 border border-stone-200/60 dark:border-slate-700 space-y-2.5">
                    <div className="flex items-center justify-between text-xs sm:text-sm font-bold">
                      <span className="text-stone-600 dark:text-slate-300">
                        Permanência semanal:{" "}
                        <strong className={`font-mono-data text-sm sm:text-base ${item.metTarget ? "text-emerald-700 dark:text-emerald-400" : "text-slate-900 dark:text-slate-100"}`}>
                          {formatDuration(item.totalSeconds)}
                        </strong>{" "}
                        <span className="text-stone-400 dark:text-slate-500 font-normal">/ 4h 00m</span>
                      </span>

                      {!item.metTarget ? (
                        <span className="inline-flex items-center gap-1 rounded-xl bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-2xs sm:text-xs font-extrabold text-amber-900 dark:text-amber-300 font-mono-data">
                          Faltam {formatDuration(item.deficitSeconds)} ({item.progressPercent}%)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-2xs sm:text-xs font-extrabold text-emerald-900 dark:text-emerald-300 font-mono-data">
                          100% atingido
                        </span>
                      )}
                    </div>

                    {/* Barra de Progresso */}
                    <div className="h-3 sm:h-2.5 w-full rounded-full bg-stone-200/80 dark:bg-slate-700 overflow-hidden shadow-inner">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          item.metTarget
                            ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                            : item.progressPercent > 50
                            ? "bg-gradient-to-r from-amber-500 to-orange-500"
                            : "bg-gradient-to-r from-rose-500 to-amber-500"
                        }`}
                        style={{ width: `${item.progressPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Botão de Ação em Largura Total no Celular */}
                  <div className="sm:hidden pt-1">
                    {!item.metTarget ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleCopyNotice(item)}
                          className={`flex-1 rounded-2xl py-3.5 px-3 text-xs sm:text-sm font-extrabold transition-all shadow-claude cursor-pointer min-h-[48px] inline-flex items-center justify-center gap-1.5 active:scale-98 ${
                            isCopied
                              ? "bg-emerald-600 text-white"
                              : "bg-gradient-to-r from-amber-600 to-orange-600 text-white"
                          }`}
                        >
                          {isCopied ? "✓ Copiado!" : "⚠️ Advertir"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenWhatsApp(item)}
                          title="Abrir no WhatsApp"
                          className="rounded-2xl py-3.5 px-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-600/30 text-emerald-800 dark:text-emerald-300 text-xs sm:text-sm font-extrabold min-h-[48px] inline-flex items-center justify-center gap-1 active:scale-98"
                        >
                          <span>📲</span>
                          <span>WhatsApp</span>
                        </button>
                        {warning && (
                          <button
                            type="button"
                            onClick={() => removeWarning(item.member.id)}
                            className="rounded-2xl border border-stone-200/90 dark:border-slate-700 bg-stone-100 dark:bg-slate-800 px-3 py-3 text-xs font-bold text-stone-600 dark:text-slate-300 hover:text-amber-800 min-h-[48px]"
                            title="Desfazer"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="w-full text-center py-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                        ✓ Aluno regularizado com a meta semanal de 4 horas
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Barra Flutuante de Ação em Lote */}
        {selectedMemberIds.length > 0 && (
          <div className="shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 sm:px-6 bg-amber-50/95 dark:bg-slate-900/95 backdrop-blur-xl border-t-2 border-amber-400 dark:border-amber-600 shadow-2xl animate-slide-up">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-600 text-white text-xs font-bold font-mono-data">
                {selectedMemberIds.length}
              </span>
              <div>
                <span className="text-xs sm:text-sm font-bold text-amber-950 dark:text-amber-200 block font-sans">
                  {selectedMemberIds.length === 1 ? "1 aluno selecionado" : `${selectedMemberIds.length} alunos selecionados`}
                </span>
                <span className="text-[11px] text-amber-800/80 dark:text-amber-400/80 font-sans">
                  Ação coletiva para emissão de comunicado institucional
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setIsPreviewOpen(true)}
                className="flex-1 sm:flex-none rounded-xl border border-amber-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-slate-700 transition-colors cursor-pointer min-h-[40px]"
              >
                👁️ Pré-visualizar
              </button>
              <button
                type="button"
                onClick={handleCopyBatchNotice}
                className={`flex-1 sm:flex-none rounded-xl px-4 py-2 text-xs font-bold text-white shadow-md active:scale-95 transition-all cursor-pointer min-h-[40px] inline-flex items-center justify-center gap-1.5 ${
                  batchCopied
                    ? "bg-emerald-600"
                    : "bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700"
                }`}
              >
                {batchCopied ? "✓ Copiado!" : `📋 Copiar (${selectedMemberIds.length})`}
              </button>
              <button
                type="button"
                onClick={handleOpenBatchWhatsApp}
                className="flex-1 sm:flex-none rounded-xl border border-emerald-600/40 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100/70 text-emerald-900 dark:text-emerald-200 px-4 py-2 text-xs font-bold shadow-2xs active:scale-95 transition-all cursor-pointer min-h-[40px] inline-flex items-center justify-center gap-1.5"
                title="Abrir WhatsApp com comunicado coletivo"
              >
                <span>📲</span>
                <span>WhatsApp</span>
              </button>
            </div>
          </div>
        )}

        {/* Modal de Pré-visualização do Comunicado em Lote */}
        {isPreviewOpen && (
          <div
            className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="preview-batch-title"
          >
            <div className="w-full max-w-lg rounded-3xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4 animate-scale-up text-slate-900 dark:text-slate-100">
              <div className="flex items-center justify-between border-b border-stone-200 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">📋</span>
                  <div>
                    <h4 id="preview-batch-title" className="font-editorial text-lg font-bold">
                      Pré-visualização do Comunicado em Lote
                    </h4>
                    <p className="text-xs text-stone-500 dark:text-slate-400">
                      {selectedItems.length} integrantes selecionados
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPreviewOpen(false)}
                  className="rounded-full h-8 w-8 flex items-center justify-center bg-stone-100 dark:bg-slate-800 text-stone-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                  aria-label="Fechar pré-visualização"
                >
                  ✕
                </button>
              </div>

              <textarea
                readOnly
                rows={12}
                value={generateBatchNoticeText()}
                className="w-full rounded-2xl border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800/80 p-3.5 font-mono-data text-xs leading-relaxed text-slate-900 dark:text-slate-100 focus:outline-none select-all"
              />

              <div className="flex items-center justify-between gap-3 pt-2">
                <span className="text-2xs text-stone-400 dark:text-slate-500 font-sans">
                  Texto pronto para transmissão via WhatsApp ou e-mail.
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPreviewOpen(false)}
                    className="rounded-xl border border-stone-200 dark:border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-stone-50 dark:hover:bg-slate-800 cursor-pointer min-h-[38px]"
                  >
                    Fechar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleCopyBatchNotice();
                      setIsPreviewOpen(false);
                    }}
                    className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 text-xs font-bold shadow-2xs cursor-pointer min-h-[38px]"
                  >
                    Copiar e Registrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer com Safe-Area para Celular */}
        <div className="shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-stone-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 pt-3 pb-[max(env(safe-area-inset-top),14px)] px-4 sm:px-6 text-xs text-stone-500 dark:text-slate-400">
          <span className="hidden sm:inline font-medium">
            * O comunicado formal é formatado automaticamente para notificação direta via WhatsApp ou e-mail.
          </span>
          <button
            onClick={onClose}
            className="w-full sm:w-auto rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 dark:from-slate-100 dark:to-slate-200 dark:text-slate-950 px-7 py-3 min-h-[46px] text-sm font-bold text-white shadow-sm hover:from-black hover:to-slate-900 active:scale-98 transition-all cursor-pointer shrink-0 flex items-center justify-center"
          >
            Concluir Auditoria
          </button>
        </div>
      </div>
    </div>
  );
}
