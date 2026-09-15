import { useEffect, useMemo, useState } from "react";
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
  const [filterMode, setFilterMode] = useState<"all" | "under" | "met">("under");
  const [search, setSearch] = useState("");
  const [warnings, setWarnings] = useState<Record<string, WarningRecord>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
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

  const handleCopyNotice = (item: (typeof weeklyTotals)[0]) => {
    const text = `[AiLab Makers · Aviso Acadêmico de Frequência]
Prezado(a) ${item.member.name} (Matrícula: ${item.member.matricula ?? "N/A"}):
Informamos que nesta semana você acumulou ${formatDuration(item.totalSeconds)} de permanência no laboratório.
A meta semanal mínima obrigatória é de 4h00 (débito restante de ${formatDuration(item.deficitSeconds)}).
Pedimos que regularize suas horas até o encerramento da semana para manter sua regularidade acadêmica.
— Coordenação / Tutoria AiLab (${tutorEmail})`;

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

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-ink/75 backdrop-blur-xs overflow-y-auto animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutor-modal-title"
    >
      <div
        className="relative w-full max-w-3xl max-h-[90vh] bg-white/95 backdrop-blur-2xl rounded-3xl border border-white/80 shadow-2xl flex flex-col overflow-hidden animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header com Identificação do Tutor estilo Apple Glass */}
        <div className="flex items-center justify-between border-b border-black/[0.05] bg-gradient-to-b from-slate-50/90 to-white/95 px-5 py-4 sm:px-6 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white font-bold text-lg shadow-sm shadow-amber-500/25">
              🎓
            </div>
            <div className="min-w-0">
              <h2 id="tutor-modal-title" className="text-base sm:text-lg font-black text-slate-900 truncate">
                Auditoria Semanal & Advertências do Tutor
              </h2>
              <p className="text-xs text-slate-500 truncate">
                Tutor ativo: <strong className="text-slate-700">{tutorEmail}</strong> · Meta semanal: <strong className="text-slate-700">4h 00m</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar auditoria do tutor"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/[0.05] hover:bg-black/[0.1] text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Resumo de Metas e Indicadores estilo Apple Glass */}
        <div className="p-4 sm:p-5 border-b border-black/[0.05] bg-white/50 grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-black/[0.06] bg-slate-50/80 p-3.5 shadow-2xs">
            <span className="text-2xs sm:text-xs font-bold uppercase tracking-wider text-slate-500 block">
              Total de Alunos
            </span>
            <span className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5 block tabular-nums">
              {totalStudents}
            </span>
          </div>

          <div className="rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/[0.08] to-orange-500/[0.03] p-3.5 shadow-2xs">
            <span className="text-2xs sm:text-xs font-bold uppercase tracking-wider text-amber-800 block">
              Abaixo da Meta (&lt; 4h)
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl sm:text-2xl font-black text-amber-900 tabular-nums">
                {underTargetStudents.length}
              </span>
              <span className="text-2xs text-amber-800/80 font-bold">em débito</span>
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.08] to-teal-500/[0.03] p-3.5 shadow-2xs col-span-2 sm:col-span-1">
            <span className="text-2xs sm:text-xs font-bold uppercase tracking-wider text-emerald-800 block">
              Meta Cumprida (&ge; 4h)
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl sm:text-2xl font-black text-emerald-900 tabular-nums">
                {metTargetCount}
              </span>
              <span className="text-2xs text-emerald-800/80 font-bold">regularizados</span>
            </div>
          </div>
        </div>

        {/* Barra de Filtros e Busca estilo Apple Spotlight */}
        <div className="p-3 sm:p-4 border-b border-black/[0.05] bg-white/70 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex gap-1.5">
            <button
              onClick={() => setFilterMode("under")}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                filterMode === "under"
                  ? "bg-amber-500 text-white shadow-2xs"
                  : "border border-black/[0.08] bg-white text-slate-600 hover:text-slate-900"
              }`}
            >
              Em Débito (&lt; 4h) ({underTargetStudents.length})
            </button>
            <button
              onClick={() => setFilterMode("met")}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                filterMode === "met"
                  ? "bg-emerald-600 text-white shadow-2xs"
                  : "border border-black/[0.08] bg-white text-slate-600 hover:text-slate-900"
              }`}
            >
              Meta Cumprida ({metTargetCount})
            </button>
            <button
              onClick={() => setFilterMode("all")}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                filterMode === "all"
                  ? "bg-blue-600 text-white shadow-2xs"
                  : "border border-black/[0.08] bg-white text-slate-600 hover:text-slate-900"
              }`}
            >
              Todos ({totalStudents})
            </button>
          </div>

          <div className="relative flex-1 min-w-[200px] max-w-xs group">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400 group-focus-within:text-blue-600">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar aluno na auditoria..."
              className="w-full rounded-xl border border-black/15 bg-white py-1.5 pl-8 pr-8 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/15 shadow-2xs"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-muted hover:text-ink cursor-pointer text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Lista de Alunos e Ações de Advertência */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {filteredList.length === 0 ? (
            <div className="rounded-2xl border border-line bg-white p-8 text-center text-sm text-muted">
              Nenhum aluno encontrado para os filtros selecionados.
            </div>
          ) : (
            filteredList.map((item) => {
              const warning = warnings[item.member.id];
              const isCopied = copiedId === item.member.id;

              return (
                <div
                  key={item.member.id}
                  className={`rounded-2xl border p-4 shadow-2xs transition-all space-y-3 ${
                    item.metTarget
                      ? "border-green/20 bg-green/[0.02]"
                      : "border-warn/25 bg-warn/[0.03]"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${
                          item.metTarget
                            ? "bg-green/15 text-green"
                            : "bg-warn/15 text-warn"
                        }`}
                      >
                        {item.member.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-ink">
                            {item.member.name}
                          </h3>
                          {warning && (
                            <span className="rounded-full bg-warn/15 px-2 py-0.5 text-2xs font-bold text-warn ring-1 ring-warn/30">
                              ⚠️ Advertido ({warning.date})
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted">
                          Matrícula: <strong>{item.member.matricula ?? "Não informada"}</strong>
                        </p>
                      </div>
                    </div>

                    {/* Ações de Advertência */}
                    <div className="flex items-center gap-2">
                      {!item.metTarget ? (
                        <>
                          <button
                            onClick={() => handleCopyNotice(item)}
                            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all shadow-2xs cursor-pointer ${
                              isCopied
                                ? "bg-green text-white"
                                : "bg-warn text-white hover:bg-warn/90 active:scale-95"
                            }`}
                            title="Registra a advertência e copia a mensagem formatada para WhatsApp ou e-mail"
                          >
                            {isCopied ? "✓ Mensagem Copiada!" : "⚠️ Aplicar Advertência"}
                          </button>

                          {warning && (
                            <button
                              onClick={() => removeWarning(item.member.id)}
                              className="text-2xs text-muted hover:text-warn underline cursor-pointer"
                              title="Remover registro desta advertência"
                            >
                              Desfazer
                            </button>
                          )}
                        </>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green/15 px-3 py-1 text-xs font-bold text-green">
                          ✓ Meta Cumprida
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Barra de Progresso em Relação a 4 Horas */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-muted">
                        Horas cumpridas:{" "}
                        <strong className={item.metTarget ? "text-green font-bold" : "text-ink"}>
                          {formatDuration(item.totalSeconds)}
                        </strong>{" "}
                        / 4h 00m
                      </span>
                      <span className="font-bold text-xs text-muted">
                        {!item.metTarget
                          ? `Faltam ${formatDuration(item.deficitSeconds)} (${item.progressPercent}%)`
                          : `100% atingido`}
                      </span>
                    </div>

                    <div className="h-2 w-full rounded-full bg-line overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          item.metTarget
                            ? "bg-green"
                            : item.progressPercent > 50
                            ? "bg-warn"
                            : "bg-warn/70"
                        }`}
                        style={{ width: `${item.progressPercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer com instruções estilo Apple */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-black/[0.05] bg-white/80 px-5 py-4 sm:px-6 text-xs text-slate-500">
          <span>
            * O botão de advertência copia automaticamente o comunicado formatado para envio direto ao aluno.
          </span>
          <button
            onClick={onClose}
            className="w-full sm:w-auto rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-2.5 text-xs sm:text-sm font-bold text-white shadow-sm shadow-blue-500/25 hover:shadow-md hover:from-blue-700 hover:to-indigo-700 active:scale-98 transition-all cursor-pointer shrink-0"
          >
            Concluir Auditoria
          </button>
        </div>
      </div>
    </div>
  );
}
