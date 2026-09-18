import { useState, useEffect, useRef, useMemo } from "react";
import type { Member } from "../lib/reports";
import { fetchMemberSessionsOnDate, tutorRegisterManualSession } from "../lib/reports";
import { combineDateTime, overlaps, validateManualSession } from "../lib/manualSession";
import { formatTime } from "../lib/aggregate";
import { getAvatarStyle } from "./TotalsTable";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  members: Member[];
  onRegistered: () => Promise<void> | void;
}

export function ManualAttendanceModal({ isOpen, onClose, members, onRegistered }: Props) {
  const [profileId, setProfileId] = useState("");
  const [search, setSearch] = useState("");
  const [date, setDate] = useState("");
  const [entryTime, setEntryTime] = useState("");
  const [exitTime, setExitTime] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const modalRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedElementRef.current = document.activeElement as HTMLElement | null;
    document.body.classList.add("modal-open");

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
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
        } else if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
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
  }, [isOpen]);

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        (m.matricula && m.matricula.toLowerCase().includes(q))
    );
  }, [members, search]);

  const selectedMember = useMemo(
    () => members.find((m) => m.id === profileId) ?? null,
    [members, profileId]
  );

  if (!isOpen) return null;

  // Data máxima = hoje (local), para o seletor não permitir dia futuro.
  const todayStr = new Date().toLocaleDateString("en-CA");

  const resetForm = () => {
    setProfileId("");
    setSearch("");
    setDate("");
    setEntryTime("");
    setExitTime("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const validation = validateManualSession({ profileId, date, entryTime, exitTime });
    if (!validation.ok) {
      setError(validation.error ?? "Dados inválidos.");
      return;
    }

    const checkIn = combineDateTime(date, entryTime);
    const checkOut = combineDateTime(date, exitTime);

    setBusy(true);
    try {
      // Bloqueia se houver sessão sobreposta no mesmo dia
      const dayStart = combineDateTime(date, "00:00");
      const dayEnd = new Date(`${date}T23:59:59`).toISOString();
      const existing = await fetchMemberSessionsOnDate(profileId, dayStart, dayEnd);
      const conflict = existing.find((s) => overlaps({ checkIn, checkOut }, [s]));
      if (conflict) {
        const conflictLabel = conflict.checkOut
          ? `${formatTime(conflict.checkIn)} às ${formatTime(conflict.checkOut)}`
          : `${formatTime(conflict.checkIn)} (em andamento)`;
        setError(
          `Já existe uma sessão neste dia que conflita com o horário informado (${conflictLabel}). Ajuste ou anule a sessão existente antes de registrar.`
        );
        setBusy(false);
        return;
      }

      await tutorRegisterManualSession(profileId, checkIn, checkOut);
      setSuccess(
        `Presença de ${selectedMember?.name ?? "integrante"} registrada: ${formatTime(checkIn)} às ${formatTime(checkOut)}.`
      );
      resetForm();
      await onRegistered();
      setTimeout(() => setSuccess(""), 4000);
    } catch (err: any) {
      setError(err?.message || "Falha ao registrar a presença manual.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="manual-attendance-title"
    >
      <div
        ref={modalRef}
        className="w-full max-w-md rounded-3xl border border-white/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/95 backdrop-blur-2xl p-6 sm:p-7 shadow-apple animate-scale-up space-y-5 text-slate-900 dark:text-slate-100 max-h-[92vh] overflow-y-auto overscroll-contain"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-[#C15F3D] text-white text-xl shadow-md shadow-orange-500/25">
              📝
            </span>
            <div>
              <h2
                id="manual-attendance-title"
                className="font-editorial text-lg sm:text-xl font-normal text-[#171715] dark:text-slate-100"
              >
                Registrar Presença Manual
              </h2>
              <p className="text-xs text-[#706E6A] dark:text-slate-400">
                Contingência para a lista de papel (queda de internet ou totem)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar registro de presença manual"
            className="flex h-10 w-10 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full bg-black/[0.05] hover:bg-black/[0.1] dark:bg-white/10 dark:hover:bg-white/20 text-[#706E6A] dark:text-slate-300 hover:text-[#171715] dark:hover:text-white transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Seletor de integrante */}
          <div className="space-y-1.5">
            <label htmlFor="manual-member-search" className="text-xs font-bold text-[#706E6A] dark:text-slate-300">
              Integrante
            </label>
            {selectedMember ? (
              <div className="flex items-center justify-between gap-2 rounded-2xl border border-[#E5E2DC] dark:border-slate-700 bg-[#FAF9F5] dark:bg-slate-800/80 px-3 py-2.5 shadow-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  {selectedMember.avatarUrl ? (
                    <img
                      src={selectedMember.avatarUrl}
                      alt={selectedMember.name}
                      className="h-9 w-9 rounded-xl object-cover ring-1 ring-black/5 dark:ring-white/10"
                    />
                  ) : (
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${getAvatarStyle(selectedMember.name)} text-sm font-bold`}
                    >
                      {selectedMember.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-[#171715] dark:text-slate-100">
                      {selectedMember.name}
                    </span>
                    {selectedMember.matricula && (
                      <span className="block truncate text-2xs font-mono-data text-[#706E6A] dark:text-slate-400">
                        {selectedMember.matricula}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setProfileId("");
                    setSearch("");
                  }}
                  className="shrink-0 rounded-lg border border-[#E5E2DC] dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-2xs font-medium text-[#706E6A] dark:text-slate-300 hover:text-[#171715] dark:hover:text-white cursor-pointer"
                >
                  Trocar
                </button>
              </div>
            ) : (
              <>
                <input
                  id="manual-member-search"
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nome ou matrícula..."
                  autoComplete="off"
                  className="w-full rounded-2xl border border-[#E5E2DC] dark:border-slate-700 bg-white dark:bg-slate-800/80 px-3.5 py-2.5 text-sm text-[#171715] dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-[#C15F3D] focus:ring-4 focus:ring-[#C15F3D]/15 shadow-xs transition-all"
                />
                <div className="max-h-44 overflow-y-auto overscroll-contain rounded-2xl border border-[#E5E2DC] dark:border-slate-700 divide-y divide-[#E5E2DC]/70 dark:divide-slate-800">
                  {filteredMembers.length === 0 ? (
                    <p className="px-3 py-4 text-center text-xs text-[#706E6A] dark:text-slate-400">
                      Nenhum integrante encontrado.
                    </p>
                  ) : (
                    filteredMembers.map((m) => (
                      <button
                        type="button"
                        key={m.id}
                        onClick={() => {
                          setProfileId(m.id);
                          setError("");
                        }}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-[#FAF9F5] dark:hover:bg-slate-800/70 transition-colors cursor-pointer"
                      >
                        {m.avatarUrl ? (
                          <img
                            src={m.avatarUrl}
                            alt={m.name}
                            className="h-8 w-8 rounded-lg object-cover ring-1 ring-black/5 dark:ring-white/10"
                          />
                        ) : (
                          <span
                            className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${getAvatarStyle(m.name)} text-xs font-bold`}
                          >
                            {m.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-[#171715] dark:text-slate-100">
                            {m.name}
                          </span>
                          {m.matricula && (
                            <span className="block truncate text-2xs font-mono-data text-[#706E6A] dark:text-slate-400">
                              {m.matricula}
                            </span>
                          )}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          {/* Dia */}
          <div className="space-y-1.5">
            <label htmlFor="manual-date" className="text-xs font-bold text-[#706E6A] dark:text-slate-300">
              Dia
            </label>
            <input
              id="manual-date"
              type="date"
              value={date}
              max={todayStr}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-2xl border border-[#E5E2DC] dark:border-slate-700 bg-white dark:bg-slate-800/80 px-3.5 py-2.5 text-sm font-mono-data text-[#171715] dark:text-slate-100 outline-none focus:border-[#C15F3D] focus:ring-4 focus:ring-[#C15F3D]/15 shadow-xs transition-all"
            />
          </div>

          {/* Entrada e saída */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="manual-entry" className="text-xs font-bold text-[#706E6A] dark:text-slate-300">
                Hora de entrada
              </label>
              <input
                id="manual-entry"
                type="time"
                value={entryTime}
                onChange={(e) => setEntryTime(e.target.value)}
                className="w-full rounded-2xl border border-[#E5E2DC] dark:border-slate-700 bg-white dark:bg-slate-800/80 px-3.5 py-2.5 text-sm font-mono-data text-[#171715] dark:text-slate-100 outline-none focus:border-[#C15F3D] focus:ring-4 focus:ring-[#C15F3D]/15 shadow-xs transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="manual-exit" className="text-xs font-bold text-[#706E6A] dark:text-slate-300">
                Hora de saída
              </label>
              <input
                id="manual-exit"
                type="time"
                value={exitTime}
                onChange={(e) => setExitTime(e.target.value)}
                className="w-full rounded-2xl border border-[#E5E2DC] dark:border-slate-700 bg-white dark:bg-slate-800/80 px-3.5 py-2.5 text-sm font-mono-data text-[#171715] dark:text-slate-100 outline-none focus:border-[#C15F3D] focus:ring-4 focus:ring-[#C15F3D]/15 shadow-xs transition-all"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300 font-semibold text-center animate-fade-in">
              ⚠️ {error}
            </div>
          )}

          {success && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-800 dark:text-emerald-300 font-semibold text-center animate-fade-in">
              ✅ {success}
            </div>
          )}

          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="flex-1 rounded-2xl border border-black/10 dark:border-slate-700 bg-white/80 dark:bg-slate-800 py-3 text-xs sm:text-sm font-bold text-[#706E6A] dark:text-slate-300 hover:bg-white hover:text-[#171715] dark:hover:bg-slate-700 dark:hover:text-white transition-all cursor-pointer min-h-[44px]"
            >
              Fechar
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex-1 rounded-2xl bg-[#171715] hover:bg-[#2A2925] dark:bg-white dark:hover:bg-slate-100 py-3 text-xs sm:text-sm font-bold text-[#FAF9F5] dark:text-slate-900 shadow-sm active:scale-98 disabled:opacity-50 transition-all cursor-pointer min-h-[44px]"
            >
              {busy ? "Registrando..." : "Registrar Presença"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
