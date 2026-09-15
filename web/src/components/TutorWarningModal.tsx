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
  const [filterMode, setFilterMode] = useState<"under" | "met" | "all">("under");
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
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-md overflow-hidden animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutor-modal-title"
    >
      <div
        className="relative w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-4xl bg-white sm:bg-white/95 sm:backdrop-blur-2xl sm:rounded-3xl border-0 sm:border sm:border-white/80 shadow-2xl flex flex-col overflow-hidden animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header estilo Apple Glass com Safe-Area para Celular */}
        <div className="shrink-0 flex items-center justify-between border-b border-black/[0.06] bg-gradient-to-b from-slate-50/95 to-white/90 pt-[max(env(safe-area-inset-top),16px)] pb-4 px-4 sm:px-6 gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white font-black text-xl shadow-md shadow-amber-500/25">
              🎓
            </div>
            <div className="min-w-0">
              <h2
                id="tutor-modal-title"
                className="text-lg sm:text-2xl font-black text-slate-900 tracking-apple-tight truncate"
              >
                Auditoria Semanal & Metas
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 font-medium truncate mt-0.5">
                Tutor: <strong className="text-slate-800">{tutorEmail}</strong> · Meta: <strong className="text-slate-800">4h 00m / sem</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Fechar modal de auditoria"
            className="flex h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full bg-black/[0.05] hover:bg-black/[0.1] text-slate-600 hover:text-slate-900 transition-colors cursor-pointer text-base font-bold"
          >
            ✕
          </button>
        </div>

        {/* Resumo de Indicadores Ampliado para Celular */}
        <div className="shrink-0 p-3 sm:p-5 border-b border-black/[0.06] bg-slate-50/70 grid grid-cols-3 gap-2 sm:gap-4">
          {/* Total */}
          <div className="rounded-2xl border border-black/[0.06] bg-white p-3 sm:p-4 shadow-xs text-center sm:text-left">
            <span className="text-2xs sm:text-xs font-bold uppercase tracking-apple-caps text-slate-500 block truncate">
              Total Alunos
            </span>
            <span className="text-2xl sm:text-4xl font-extrabold text-slate-900 mt-1 block tabular-nums tracking-apple-tightest">
              {totalStudents}
            </span>
            <span className="hidden sm:inline-block text-2xs text-slate-400 font-medium mt-0.5">
              cadastrados
            </span>
          </div>

          {/* Abaixo da Meta */}
          <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/[0.10] via-amber-500/[0.04] to-transparent p-3 sm:p-4 shadow-xs text-center sm:text-left">
            <span className="text-2xs sm:text-xs font-bold uppercase tracking-apple-caps text-amber-800 block truncate">
              Em Débito
            </span>
            <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-2 mt-1">
              <span className="text-2xl sm:text-4xl font-extrabold text-amber-900 tabular-nums tracking-apple-tightest">
                {underTargetStudents.length}
              </span>
              <span className="inline-flex items-center justify-center rounded-full bg-amber-500/20 px-1.5 py-0.5 text-2xs font-bold text-amber-800">
                &lt; 4h
              </span>
            </div>
          </div>

          {/* Regularizados */}
          <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.10] via-emerald-500/[0.04] to-transparent p-3 sm:p-4 shadow-xs text-center sm:text-left">
            <span className="text-2xs sm:text-xs font-bold uppercase tracking-apple-caps text-emerald-800 block truncate">
              Cumprida
            </span>
            <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-2 mt-1">
              <span className="text-2xl sm:text-4xl font-extrabold text-emerald-900 tabular-nums tracking-apple-tightest">
                {metTargetCount}
              </span>
              <span className="inline-flex items-center justify-center rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-2xs font-bold text-emerald-800">
                &ge; 4h
              </span>
            </div>
          </div>
        </div>

        {/* Barra de Filtros e Busca estilo Apple Segmented Control */}
        <div className="shrink-0 p-3 sm:p-4 border-b border-black/[0.06] bg-white space-y-2.5">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            {/* iOS Segmented Control */}
            <div className="flex items-center rounded-2xl bg-black/[0.05] p-1 gap-1">
              <button
                type="button"
                onClick={() => setFilterMode("under")}
                className={`flex-1 sm:flex-none rounded-xl px-3 py-2 text-xs sm:text-sm font-bold transition-all cursor-pointer min-h-[38px] ${
                  filterMode === "under"
                    ? "bg-white text-amber-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                ⚠️ Em Débito ({underTargetStudents.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode("met")}
                className={`flex-1 sm:flex-none rounded-xl px-3 py-2 text-xs sm:text-sm font-bold transition-all cursor-pointer min-h-[38px] ${
                  filterMode === "met"
                    ? "bg-white text-emerald-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                ✓ Cumprida ({metTargetCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode("all")}
                className={`flex-1 sm:flex-none rounded-xl px-3 py-2 text-xs sm:text-sm font-bold transition-all cursor-pointer min-h-[38px] ${
                  filterMode === "all"
                    ? "bg-white text-blue-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Todos ({totalStudents})
              </button>
            </div>

            {/* Apple Spotlight Search */}
            <div className="relative flex-1 sm:max-w-xs group">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400 group-focus-within:text-blue-600">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
              </div>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar aluno ou matrícula..."
                className="w-full rounded-2xl border border-black/15 bg-white py-2.5 pl-10 pr-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/15 shadow-xs transition-all font-medium"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-900 cursor-pointer text-sm"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Lista de Alunos Ampliada para Celular */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-3 sm:space-y-3.5 bg-slate-50/40">
          {filteredList.length === 0 ? (
            <div className="rounded-3xl border border-black/[0.06] bg-white p-8 sm:p-12 text-center shadow-xs">
              <div className="text-3xl mb-2">🔍</div>
              <p className="text-base font-bold text-slate-800">
                Nenhum aluno encontrado
              </p>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Tente ajustar os termos da busca ou mudar o filtro selecionado.
              </p>
            </div>
          ) : (
            filteredList.map((item) => {
              const warning = warnings[item.member.id];
              const isCopied = copiedId === item.member.id;

              return (
                <div
                  key={item.member.id}
                  className={`rounded-3xl border p-4 sm:p-5 shadow-xs transition-all space-y-3.5 bg-white ${
                    item.metTarget
                      ? "border-emerald-500/25 shadow-emerald-500/[0.02]"
                      : "border-amber-500/30 shadow-amber-500/[0.03]"
                  }`}
                >
                  {/* Informações do Aluno */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className={`flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl text-base sm:text-lg font-black shadow-xs ${
                          item.metTarget
                            ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white"
                            : "bg-gradient-to-br from-amber-500 to-orange-600 text-white"
                        }`}
                      >
                        {item.member.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-apple-tight truncate">
                            {item.member.name}
                          </h3>
                          {warning && (
                            <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-2xs font-bold text-amber-900 inline-flex items-center gap-1">
                              <span>⚠️</span>
                              <span>Advertido ({warning.date})</span>
                            </span>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
                          Matrícula:{" "}
                          <strong className="text-slate-800 font-bold">
                            {item.member.matricula ?? "Não cadastrada"}
                          </strong>
                        </p>
                      </div>
                    </div>

                    {/* Badge ou Ação em Desktop */}
                    <div className="hidden sm:flex items-center gap-2 shrink-0">
                      {!item.metTarget ? (
                        <>
                          <button
                            onClick={() => handleCopyNotice(item)}
                            className={`rounded-2xl px-4 py-2.5 text-xs sm:text-sm font-bold transition-all shadow-xs cursor-pointer min-h-[42px] inline-flex items-center justify-center gap-1.5 active:scale-95 ${
                              isCopied
                                ? "bg-emerald-600 text-white"
                                : "bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:from-amber-600 hover:to-orange-700"
                            }`}
                          >
                            {isCopied ? "✓ Mensagem Copiada!" : "⚠️ Aplicar Advertência"}
                          </button>

                          {warning && (
                            <button
                              onClick={() => removeWarning(item.member.id)}
                              className="text-xs text-slate-400 hover:text-amber-700 underline font-medium cursor-pointer px-1"
                              title="Remover registro de advertência deste aluno"
                            >
                              Desfazer
                            </button>
                          )}
                        </>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 px-3.5 py-2 text-xs sm:text-sm font-bold text-emerald-800">
                          <span>✓</span>
                          <span>Meta Cumprida</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Detalhes de Horas e Barra de Progresso Ampliada */}
                  <div className="rounded-2xl bg-slate-50 p-3 sm:p-3.5 border border-black/[0.04] space-y-2">
                    <div className="flex items-center justify-between text-xs sm:text-sm font-bold">
                      <span className="text-slate-600">
                        Horas cumpridas:{" "}
                        <strong className={`text-sm sm:text-base ${item.metTarget ? "text-emerald-700" : "text-slate-900"}`}>
                          {formatDuration(item.totalSeconds)}
                        </strong>{" "}
                        <span className="text-slate-400 font-normal">/ 4h 00m</span>
                      </span>

                      {!item.metTarget ? (
                        <span className="inline-flex items-center gap-1 rounded-xl bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-2xs sm:text-xs font-extrabold text-amber-900 tabular-nums">
                          Faltam {formatDuration(item.deficitSeconds)} ({item.progressPercent}%)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-2xs sm:text-xs font-extrabold text-emerald-900">
                          100% atingido
                        </span>
                      )}
                    </div>

                    {/* Barra de Progresso Espessa estilo Apple */}
                    <div className="h-3 sm:h-2.5 w-full rounded-full bg-slate-200/80 overflow-hidden shadow-inner">
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
                          onClick={() => handleCopyNotice(item)}
                          className={`flex-1 rounded-2xl py-3 px-4 text-sm font-extrabold transition-all shadow-xs cursor-pointer min-h-[46px] inline-flex items-center justify-center gap-2 active:scale-98 ${
                            isCopied
                              ? "bg-emerald-600 text-white"
                              : "bg-gradient-to-r from-amber-500 to-orange-600 text-white"
                          }`}
                        >
                          {isCopied ? "✓ Mensagem Copiada!" : "⚠️ Aplicar Advertência ao Aluno"}
                        </button>
                        {warning && (
                          <button
                            onClick={() => removeWarning(item.member.id)}
                            className="rounded-2xl border border-black/10 bg-slate-100 px-3 py-3 text-xs font-bold text-slate-600 hover:text-amber-800 min-h-[46px]"
                            title="Desfazer"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="w-full text-center py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-800">
                        ✓ Aluno em dia com as 4 horas obrigatórias
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer com Safe-Area para Celular */}
        <div className="shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-black/[0.06] bg-white pt-3 pb-[max(env(safe-area-inset-bottom),14px)] px-4 sm:px-6 text-xs text-slate-500">
          <span className="hidden sm:inline">
            * O botão de advertência copia o aviso formatado pronto para envio pelo WhatsApp ou e-mail.
          </span>
          <button
            onClick={onClose}
            className="w-full sm:w-auto rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 min-h-[46px] text-sm font-bold text-white shadow-sm shadow-blue-500/25 hover:shadow-md hover:from-blue-700 hover:to-indigo-700 active:scale-98 transition-all cursor-pointer shrink-0 flex items-center justify-center"
          >
            Concluir Auditoria
          </button>
        </div>
      </div>
    </div>
  );
}
