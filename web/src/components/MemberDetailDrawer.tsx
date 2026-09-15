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
        {/* Drawer Header estilo Apple Sheet com tipografia Claude */}
        <div className="flex items-start justify-between border-b border-[#E5E2DC] bg-[#FAF9F5]/90 p-5 gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${getAvatarStyle(member.name)} text-base font-bold ring-2 ring-white shadow-md`}
            >
              {member.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <span className="text-[10.5px] font-sans font-semibold uppercase tracking-wider text-[#706E6A] block">
                Ficha do Integrante
              </span>
              <h2 id="drawer-member-name" className="font-editorial text-xl sm:text-2xl font-normal text-[#171715] truncate">
                {member.name}
              </h2>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {member.matricula && (
                  <span className="rounded-md bg-white border border-[#E5E2DC] px-2 py-0.5 text-2xs font-mono-data font-medium text-[#706E6A]">
                    {member.matricula}
                  </span>
                )}
                {isPresent ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 text-[10.5px] font-medium text-emerald-800 shadow-2xs">
                    <span className="relative flex h-1.5 w-1.5 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                    </span>
                    Presente
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#FAF9F5] border border-[#E5E2DC] px-2.5 py-0.5 text-[10.5px] font-medium text-[#706E6A]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#706E6A]/40 shrink-0" />
                    Ausente
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar detalhes do integrante"
            className="flex h-10 w-10 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full bg-black/[0.04] hover:bg-black/[0.08] text-[#706E6A] hover:text-[#171715] transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Painel de Gestão de Presença do Tutor */}
        {user && isPresent && (
          <div className="border-b border-[#E5E2DC] bg-[#FAF5F0]/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-sans font-semibold uppercase tracking-wider text-[#C15F3D] flex items-center gap-1.5">
                <span>🛡️</span> Ações de Presença do Tutor
              </span>
              <span className="text-[10.5px] text-[#706E6A] font-medium">
                Mitigação de esquecimentos
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => handleTutorAction("checkout")}
                disabled={busyAction !== null}
                className="flex flex-col items-center justify-center p-3 rounded-2xl border border-emerald-600/20 bg-emerald-50 hover:bg-emerald-100/60 active:scale-98 transition-all cursor-pointer disabled:opacity-50 text-center shadow-2xs min-h-[54px]"
              >
                <span className="text-xs font-bold text-emerald-800">
                  {busyAction === "checkout" ? "Registrando..." : "🚪 Registrar Saída"}
                </span>
                <span className="text-[10px] text-emerald-700/80 font-medium mt-0.5">
                  Computa horas até agora
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleTutorAction("void")}
                disabled={busyAction !== null}
                className="flex flex-col items-center justify-center p-3 rounded-2xl border border-rose-600/20 bg-rose-50 hover:bg-rose-100/60 active:scale-98 transition-all cursor-pointer disabled:opacity-50 text-center shadow-2xs min-h-[54px]"
              >
                <span className="text-xs font-bold text-rose-800">
                  {busyAction === "void" ? "Cancelando..." : "🛑 Cancelar Entrada"}
                </span>
                <span className="text-[10px] text-rose-700/80 font-medium mt-0.5">
                  Zera horas (esquecimento)
                </span>
              </button>
            </div>

            {actionMessage && (
              <div className="rounded-xl border border-[#E5E2DC] bg-white p-2.5 text-xs font-medium text-center text-[#171715] shadow-2xs animate-fade-in">
                {actionMessage}
              </div>
            )}
          </div>
        )}

        {/* Total stats card estilo Perplexity Mono + Claude Paper */}
        <div className="p-5 border-b border-[#E5E2DC] bg-[#FAF9F5]/40 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-[#E5E2DC] bg-white p-3.5 shadow-2xs">
            <span className="text-[10px] font-sans font-semibold uppercase tracking-wider text-[#706E6A] block">Total de Permanência</span>
            <span className="text-2xl font-semibold text-[#171715] mt-1 block font-mono-data">
              {formatDuration(totalSeconds)}
            </span>
          </div>
          <div className="rounded-2xl border border-[#E5E2DC] bg-white p-3.5 shadow-2xs">
            <span className="text-[10px] font-sans font-semibold uppercase tracking-wider text-[#706E6A] block">Sessões no Período</span>
            <span className="text-2xl font-semibold text-[#171715] mt-1 block font-mono-data">
              {memberSessions.length}
            </span>
          </div>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          <h3 className="text-[11px] font-sans font-semibold uppercase tracking-wider text-[#706E6A]">
            Histórico de Sessões no Período
          </h3>

          {memberSessions.length === 0 ? (
            <div className="rounded-2xl border border-[#E5E2DC] bg-[#FAF9F5] p-8 text-center text-[#706E6A] text-sm">
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
                    className="rounded-2xl border border-[#E5E2DC] bg-white p-3.5 shadow-2xs space-y-2 transition-all hover:border-[#706E6A]/30"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-editorial font-medium text-sm text-[#171715] capitalize">{dateLabel}</span>
                      {isVoided ? (
                        <span className="rounded-full bg-[#FAF5F0] border border-[#F0DCD3] px-2 py-0.5 font-medium text-[#C15F3D] text-[10px]">
                          ⚠️ Saída esquecida
                        </span>
                      ) : isOpenSession ? (
                        <span className="rounded-full bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 font-medium text-emerald-800 text-[10px] animate-pulse">
                          ● Em andamento
                        </span>
                      ) : (
                        <span className="font-mono-data font-semibold text-[#171715] text-xs sm:text-sm">
                          {s.durationS ? formatDuration(s.durationS) : "0 min"}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs text-[#706E6A] font-mono-data">
                      <span>
                        Entrada: <strong className="text-[#171715] font-semibold">{formatTime(s.checkIn)}</strong>
                      </span>
                      <span>
                        Saída:{" "}
                        <strong className="text-[#171715] font-semibold">
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
        <div className="border-t border-[#E5E2DC] bg-[#FAF9F5] p-4">
          <button
            onClick={onClose}
            className="w-full rounded-2xl bg-[#171715] hover:bg-[#2A2925] py-3.5 px-4 min-h-[48px] text-sm font-sans font-medium text-[#FAF9F5] shadow-xs active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center tracking-tight"
          >
            Fechar Detalhes
          </button>
        </div>
      </div>
    </div>
  );
}
