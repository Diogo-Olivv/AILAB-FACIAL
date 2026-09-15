import { useState } from "react";
import type { Member, SessionRecord } from "../lib/reports";
import { tutorCloseSession } from "../lib/reports";
import { formatDuration, formatTime } from "../lib/aggregate";
import { getAvatarStyle } from "./TotalsTable";
import { useAuth } from "../auth/useAuth";

interface Props {
  member: Member | null;
  sessions: SessionRecord[];
  isOpen: boolean;
  isPresent: boolean;
  totalSeconds: number;
  onClose: () => void;
  onSessionUpdated?: () => Promise<void> | void;
}

export function MemberDetailDrawer({
  member,
  sessions,
  isOpen,
  isPresent,
  totalSeconds,
  onClose,
  onSessionUpdated,
}: Props) {
  const { user } = useAuth();
  const [busyAction, setBusyAction] = useState<"checkout" | "void" | null>(null);
  const [actionMessage, setActionMessage] = useState("");

  if (!isOpen || !member) return null;

  const handleTutorAction = async (action: "checkout" | "void") => {
    setBusyAction(action);
    setActionMessage("");
    try {
      await tutorCloseSession(member.id, action);
      setActionMessage(
        action === "checkout"
          ? "✅ Saída registrada computando as horas até agora!"
          : "✅ Entrada cancelada com sucesso (0 horas computadas)!"
      );
      if (onSessionUpdated) {
        await onSessionUpdated();
      }
      setTimeout(() => {
        setActionMessage("");
      }, 3000);
    } catch (err: any) {
      setActionMessage(`⚠️ Falha ao atualizar: ${err?.message || "Erro desconhecido"}`);
    } finally {
      setBusyAction(null);
    }
  };

  const memberSessions = sessions
    .filter((s) => s.profileId === member.id)
    .sort((a, b) => new Date(b.checkIn).getTime() - new Date(a.checkIn).getTime());

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-end bg-black/40 backdrop-blur-xs transition-opacity animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-member-name"
    >
      <div
        className="h-full w-full max-w-full sm:max-w-md bg-white/95 backdrop-blur-2xl border-l border-white/80 shadow-2xl flex flex-col overflow-hidden animate-slide-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header estilo Apple Sheet */}
        <div className="flex items-start justify-between border-b border-black/[0.05] bg-gradient-to-b from-slate-50/90 to-white/95 p-5 gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            {/* Avatar estilo Apple com gradiente e sombra */}
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${getAvatarStyle(member.name)} text-base font-bold ring-2 ring-white shadow-md`}
            >
              {member.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 block">
                Ficha do Integrante
              </span>
              <h2 id="drawer-member-name" className="text-lg sm:text-xl font-black text-slate-900 truncate">
                {member.name}
              </h2>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {member.matricula && (
                  <span className="rounded-full bg-slate-100 border border-black/[0.06] px-2 py-0.5 text-2xs font-mono font-semibold text-slate-600">
                    {member.matricula}
                  </span>
                )}
                {isPresent ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 border border-emerald-500/25 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-700 shadow-2xs">
                    <span className="relative flex h-1.5 w-1.5 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                    </span>
                    Presente
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/[0.05] border border-slate-400/15 px-2 py-0.5 text-[10.5px] font-medium text-slate-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-400/50 shrink-0" />
                    Ausente
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar detalhes do integrante"
            className="flex h-10 w-10 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full bg-black/[0.05] hover:bg-black/[0.1] text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Painel de Gestão de Presença do Tutor */}
        {user && isPresent && (
          <div className="border-b border-black/[0.06] bg-gradient-to-br from-indigo-500/[0.06] via-blue-500/[0.03] to-slate-50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold uppercase tracking-wider text-indigo-950 flex items-center gap-1.5">
                <span>🛡️</span> Ações de Presença do Tutor
              </span>
              <span className="text-[10.5px] text-indigo-700/80 font-medium">
                Mitigação de esquecimentos
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => handleTutorAction("checkout")}
                disabled={busyAction !== null}
                className="flex flex-col items-center justify-center p-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.08] hover:bg-emerald-500/[0.16] active:scale-98 transition-all cursor-pointer disabled:opacity-50 text-center shadow-2xs min-h-[54px]"
              >
                <span className="text-xs font-black text-emerald-800">
                  {busyAction === "checkout" ? "Registrando..." : "🚪 Registrar Saída"}
                </span>
                <span className="text-[10px] text-emerald-700/90 font-medium mt-0.5">
                  Computa horas até agora
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleTutorAction("void")}
                disabled={busyAction !== null}
                className="flex flex-col items-center justify-center p-3 rounded-2xl border border-rose-500/20 bg-rose-500/[0.08] hover:bg-rose-500/[0.16] active:scale-98 transition-all cursor-pointer disabled:opacity-50 text-center shadow-2xs min-h-[54px]"
              >
                <span className="text-xs font-black text-rose-800">
                  {busyAction === "void" ? "Cancelando..." : "🛑 Cancelar Entrada"}
                </span>
                <span className="text-[10px] text-rose-700/90 font-medium mt-0.5">
                  Zera horas (esquecimento)
                </span>
              </button>
            </div>

            {actionMessage && (
              <div className="rounded-xl border border-black/5 bg-white/90 p-2 text-2xs font-semibold text-center text-slate-800 shadow-2xs animate-fade-in">
                {actionMessage}
              </div>
            )}
          </div>
        )}

        {/* Total stats card estilo Apple Glass */}
        <div className="p-5 border-b border-black/[0.05] bg-white/50 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-500/[0.08] to-indigo-500/[0.03] p-3.5 shadow-2xs">
            <span className="text-2xs font-bold uppercase tracking-wider text-blue-800 block">Total de Permanência</span>
            <span className="text-2xl font-black text-blue-950 mt-1 block font-mono">
              {formatDuration(totalSeconds)}
            </span>
          </div>
          <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/[0.08] to-orange-500/[0.03] p-3.5 shadow-2xs">
            <span className="text-2xs font-bold uppercase tracking-wider text-amber-800 block">Sessões Registradas</span>
            <span className="text-2xl font-black text-slate-900 mt-1 block tabular-nums">
              {memberSessions.length}
            </span>
          </div>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Histórico de Sessões no Período
          </h3>

          {memberSessions.length === 0 ? (
            <div className="rounded-2xl border border-black/[0.05] bg-white/60 p-8 text-center text-slate-500 text-sm">
              Nenhuma sessão registrada para este integrante nas datas selecionadas.
            </div>
          ) : (
            <div className="space-y-2.5">
              {memberSessions.map((s, idx) => {
                const checkInDate = new Date(s.checkIn);
                const dateLabel = checkInDate.toLocaleDateString("pt-BR", {
                  weekday: "short",
                  day: "2-digit",
                  month: "short",
                });
                const isOpenSession = s.checkOut === null;
                const isVoided = Boolean(s.voidedAt);

                return (
                  <div
                    key={idx}
                    className="rounded-2xl border border-black/[0.06] bg-white/80 p-3.5 shadow-2xs space-y-1.5 transition-all hover:border-black/15"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-900 capitalize">{dateLabel}</span>
                      {isVoided ? (
                        <span className="rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 font-semibold text-amber-800 text-2xs">
                          ⚠️ Saída esquecida
                        </span>
                      ) : isOpenSession ? (
                        <span className="rounded-full bg-emerald-500/12 border border-emerald-500/25 px-2 py-0.5 font-semibold text-emerald-700 text-2xs animate-pulse">
                          ● Em andamento
                        </span>
                      ) : (
                        <span className="font-mono font-bold text-slate-900">
                          {s.durationS ? formatDuration(s.durationS) : "0 min"}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>
                        Entrada: <strong className="text-slate-800 font-semibold">{formatTime(s.checkIn)}</strong>
                      </span>
                      <span>
                        Saída:{" "}
                        <strong className="text-slate-800 font-semibold">
                          {isOpenSession ? "—" : formatTime(s.checkOut!)}
                        </strong>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="border-t border-black/[0.05] bg-white/80 p-4">
          <button
            onClick={onClose}
            className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3 px-4 min-h-[46px] text-sm font-bold text-white shadow-sm shadow-blue-500/25 hover:shadow-md hover:from-blue-700 hover:to-indigo-700 active:scale-98 transition-all cursor-pointer flex items-center justify-center"
          >
            Fechar Detalhes
          </button>
        </div>
      </div>
    </div>
  );
}
