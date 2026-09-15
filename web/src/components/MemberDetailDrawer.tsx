import { useState } from "react";
import type { Member, SessionRecord } from "../lib/reports";
import {
  tutorCloseSession,
  tutorRegisterEntry,
  tutorRemoveMember,
  tutorVoidSession,
  tutorUnvoidSession,
  tutorDeleteSession,
} from "../lib/reports";
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
  onMemberRemoved?: () => Promise<void> | void;
}

export function MemberDetailDrawer({
  member,
  sessions,
  isOpen,
  isPresent,
  totalSeconds,
  onClose,
  onSessionUpdated,
  onMemberRemoved,
}: Props) {
  const { user } = useAuth();
  const [busyAction, setBusyAction] = useState<"checkout" | "void" | "checkin" | "remove" | null>(null);
  const [busySessionId, setBusySessionId] = useState<number | null>(null);
  const [confirmDeleteSessionId, setConfirmDeleteSessionId] = useState<number | null>(null);
  const [isConfirmingRemove, setIsConfirmingRemove] = useState(false);
  const [actionMessage, setActionMessage] = useState("");

  if (!isOpen || !member) return null;

  const handleVoidSpecificSession = async (sessionId: number, isCurrentlyVoided: boolean) => {
    setBusySessionId(sessionId);
    setActionMessage("");
    try {
      if (isCurrentlyVoided) {
        await tutorUnvoidSession(sessionId);
        setActionMessage("✅ Sessão reativada! Horas restauradas.");
      } else {
        await tutorVoidSession(sessionId, "anomalous_or_over_10h");
        setActionMessage("✅ Sessão anulada com sucesso! Horas zeradas (0h 00m).");
      }
      if (onSessionUpdated) {
        await onSessionUpdated();
      }
      setTimeout(() => setActionMessage(""), 3500);
    } catch (err: any) {
      setActionMessage(`⚠️ Falha: ${err?.message || "Erro desconhecido"}`);
    } finally {
      setBusySessionId(null);
    }
  };

  const handleDeleteSpecificSession = async (sessionId: number) => {
    setBusySessionId(sessionId);
    setActionMessage("");
    try {
      await tutorDeleteSession(sessionId);
      setActionMessage("✅ Sessão excluída permanentemente do histórico.");
      setConfirmDeleteSessionId(null);
      if (onSessionUpdated) {
        await onSessionUpdated();
      }
      setTimeout(() => setActionMessage(""), 3500);
    } catch (err: any) {
      setActionMessage(`⚠️ Falha ao excluir sessão: ${err?.message || "Erro desconhecido"}`);
    } finally {
      setBusySessionId(null);
    }
  };

  const handleTutorAction = async (action: "checkout" | "void" | "checkin" | "remove") => {
    setBusyAction(action);
    setActionMessage("");
    try {
      if (action === "checkin") {
        await tutorRegisterEntry(member.id);
        setActionMessage("✅ Entrada registrada com sucesso! Presença iniciada.");
        if (onSessionUpdated) {
          await onSessionUpdated();
        }
      } else if (action === "remove") {
        await tutorRemoveMember(member.id, false);
        setActionMessage("✅ Integrante descadastrado com sucesso!");
        if (onMemberRemoved) {
          await onMemberRemoved();
        }
        return;
      } else {
        await tutorCloseSession(member.id, action);
        setActionMessage(
          action === "checkout"
            ? "✅ Saída registrada computando as horas até agora!"
            : "✅ Entrada cancelada com sucesso (0 horas computadas)!"
        );
        if (onSessionUpdated) {
          await onSessionUpdated();
        }
      }
      setTimeout(() => {
        setActionMessage("");
      }, 3500);
    } catch (err: any) {
      setActionMessage(`⚠️ Falha: ${err?.message || "Erro desconhecido"}`);
    } finally {
      setBusyAction(null);
      setIsConfirmingRemove(false);
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

        {/* Painel de Gestão da Tutoria */}
        {user && (
          <div className="border-b border-[#E5E2DC] bg-[#FAF5F0]/70 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-sans font-semibold uppercase tracking-wider text-[#C15F3D] flex items-center gap-1.5">
                <span>🛡️</span> Ações da Tutoria
              </span>
              <span className="text-[10.5px] text-[#706E6A] font-medium">
                Controle de presença & cadastro
              </span>
            </div>

            {/* Ações de Presença (Presente vs Ausente) */}
            {isPresent ? (
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
            ) : (
              <div>
                <button
                  type="button"
                  onClick={() => handleTutorAction("checkin")}
                  disabled={busyAction !== null}
                  className="w-full flex items-center justify-between p-3.5 rounded-2xl border border-emerald-600/25 bg-emerald-50/90 hover:bg-emerald-100/70 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50 shadow-2xs min-h-[52px]"
                >
                  <div className="flex items-center gap-2.5 text-left">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white text-sm shadow-2xs">
                      🚪
                    </span>
                    <div>
                      <span className="text-xs font-bold text-emerald-900 block font-sans">
                        {busyAction === "checkin" ? "Registrando Entrada..." : "Registrar Entrada Manual"}
                      </span>
                      <span className="text-[10.5px] text-emerald-700 font-medium">
                        Contingência para reconhecimento facial
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-mono-data font-semibold text-emerald-800 bg-white/90 border border-emerald-200 px-2.5 py-1 rounded-full">
                    Iniciar agora →
                  </span>
                </button>
              </div>
            )}

            {/* Ação de Descadastrar Integrante (Desistente) */}
            <div className="pt-1">
              {!isConfirmingRemove ? (
                <button
                  type="button"
                  onClick={() => setIsConfirmingRemove(true)}
                  disabled={busyAction !== null}
                  className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-rose-200/70 bg-white hover:bg-rose-50/50 text-[11px] font-sans font-medium text-rose-700 hover:text-rose-800 transition-all cursor-pointer min-h-[36px]"
                >
                  <span>🗑️</span>
                  <span>Descadastrar integrante (desistente)</span>
                </button>
              ) : (
                <div className="rounded-2xl border border-rose-300 bg-rose-50/90 p-3.5 space-y-2.5 animate-fade-in">
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-rose-900 block font-sans">
                      Confirmar Descadastramento?
                    </span>
                    <p className="text-[11px] text-rose-800/90 leading-relaxed font-sans">
                      O integrante <strong>{member.name}</strong> será desativado e sua biometria facial excluída permanentemente (LGPD). Ele deixará de constar na lista de presença.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => setIsConfirmingRemove(false)}
                      disabled={busyAction !== null}
                      className="rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-[#706E6A] hover:text-[#171715] transition-all cursor-pointer min-h-[34px]"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTutorAction("remove")}
                      disabled={busyAction !== null}
                      className="rounded-xl bg-rose-700 hover:bg-rose-800 px-3.5 py-1.5 text-xs font-sans font-bold text-white shadow-2xs active:scale-95 transition-all cursor-pointer min-h-[34px]"
                    >
                      {busyAction === "remove" ? "Descadastrando..." : "Sim, Descadastrar"}
                    </button>
                  </div>
                </div>
              )}
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
                const isOver10h =
                  (s.durationS != null && s.durationS > 36000) ||
                  (isOpenSession && (Date.now() - new Date(s.checkIn).getTime()) / 1000 > 36000);

                return (
                  <div
                    key={s.id || idx}
                    className={`rounded-2xl border p-3.5 shadow-2xs space-y-2.5 transition-all ${
                      isOver10h
                        ? "border-amber-300 bg-amber-50/20 hover:border-amber-400"
                        : "border-[#E5E2DC] bg-white hover:border-[#706E6A]/30"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs flex-wrap gap-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-editorial font-medium text-sm text-[#171715] capitalize">
                          {dateLabel}
                        </span>
                        {isOver10h && (
                          <span className="rounded-full bg-amber-100/90 border border-amber-300 px-2 py-0.5 font-bold text-amber-900 text-[10px] font-mono-data">
                            ⚠️ Anômala (&gt; 10h)
                          </span>
                        )}
                      </div>

                      {isVoided ? (
                        <span className="rounded-full bg-[#FAF5F0] border border-[#F0DCD3] px-2 py-0.5 font-medium text-[#C15F3D] text-[10px]">
                          🚫 Anulada (0h)
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

                    {/* Controles Administrativos do Tutor */}
                    {Boolean(user) && s.id != null && (
                      <div className="border-t border-[#E5E2DC]/80 pt-2 flex items-center justify-between gap-2">
                        {confirmDeleteSessionId === s.id ? (
                          <div className="w-full flex items-center justify-between gap-2 bg-rose-50 border border-rose-200 rounded-xl p-2 animate-fade-in">
                            <span className="text-[11px] font-medium text-rose-800 font-sans">
                              Excluir permanentemente?
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteSessionId(null)}
                                disabled={busySessionId !== null}
                                className="px-2 py-1 rounded-lg border border-stone-200 bg-white text-[10px] font-medium text-[#706E6A] cursor-pointer"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteSpecificSession(s.id!)}
                                disabled={busySessionId !== null}
                                className="px-2.5 py-1 rounded-lg bg-rose-700 hover:bg-rose-800 text-white text-[10px] font-bold shadow-2xs cursor-pointer"
                              >
                                {busySessionId === s.id ? "..." : "Sim, excluir"}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handleVoidSpecificSession(s.id!, isVoided)}
                              disabled={busySessionId !== null}
                              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-[11px] font-sans font-medium transition-all cursor-pointer ${
                                isVoided
                                  ? "border-emerald-200 bg-emerald-50/80 text-emerald-800 hover:bg-emerald-100"
                                  : "border-amber-200 bg-amber-50/80 text-amber-800 hover:bg-amber-100"
                              }`}
                              title={isVoided ? "Restaurar horas computadas da sessão" : "Anular sessão e zerar horas"}
                            >
                              {busySessionId === s.id ? (
                                <span>Processando...</span>
                              ) : isVoided ? (
                                <>
                                  <span>↺</span>
                                  <span>Reativar sessão</span>
                                </>
                              ) : (
                                <>
                                  <span>🚫</span>
                                  <span>Anular (zerar horas)</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => setConfirmDeleteSessionId(s.id!)}
                              disabled={busySessionId !== null}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-rose-200/80 bg-rose-50/60 hover:bg-rose-100/80 text-rose-700 text-[11px] font-sans font-medium transition-all cursor-pointer"
                              title="Excluir permanentemente do histórico"
                            >
                              <span>🗑️</span>
                              <span>Excluir</span>
                            </button>
                          </>
                        )}
                      </div>
                    )}
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
