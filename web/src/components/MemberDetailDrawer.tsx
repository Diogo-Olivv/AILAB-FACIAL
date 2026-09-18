import { useState, useEffect, useRef } from "react";
import type { Member, SessionRecord } from "../lib/reports";
import {
  tutorCloseSession,
  tutorRegisterEntry,
  tutorRemoveMember,
  tutorVoidSession,
  tutorUnvoidSession,
  tutorDeleteSession,
  updateMemberAvatar,
  compressImageToBase64,
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
  const [typedMemberName, setTypedMemberName] = useState("");
  const [sessionToVoid, setSessionToVoid] = useState<{ id: number; isCurrentlyVoided: boolean } | null>(null);
  const [actionMessage, setActionMessage] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(member?.avatarUrl ?? null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const drawerRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setAvatarUrl(member?.avatarUrl ?? null);
    setIsConfirmingRemove(false);
    setTypedMemberName("");
  }, [member?.id, member?.avatarUrl]);

  useEffect(() => {
    if (!isOpen || !member) return;

    previouslyFocusedElementRef.current = document.activeElement as HTMLElement | null;
    document.body.classList.add("modal-open");

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === "Tab" && drawerRef.current) {
        const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
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
  }, [isOpen, Boolean(member), onClose]);

  if (!isOpen || !member) return null;

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setActionMessage("⚠️ Por favor selecione um arquivo de imagem válido (JPG, PNG, WebP).");
      return;
    }
    setIsUploadingAvatar(true);
    setActionMessage("");
    try {
      const base64 = await compressImageToBase64(file, 256);
      await updateMemberAvatar(member.id, base64);
      setAvatarUrl(base64);
      setActionMessage("✅ Foto de perfil atualizada com sucesso!");
      if (onSessionUpdated) {
        await onSessionUpdated();
      }
      setTimeout(() => setActionMessage(""), 3500);
    } catch (err: any) {
      setActionMessage(`⚠️ Falha ao salvar foto: ${err?.message || "Erro desconhecido"}`);
    } finally {
      setIsUploadingAvatar(false);
      e.target.value = "";
    }
  };

  const handleRemoveAvatar = async () => {
    if (!window.confirm("Deseja realmente remover a foto de perfil deste integrante?")) return;
    setIsUploadingAvatar(true);
    setActionMessage("");
    try {
      await updateMemberAvatar(member.id, null);
      setAvatarUrl(null);
      setActionMessage("✅ Foto de perfil removida com sucesso!");
      if (onSessionUpdated) {
        await onSessionUpdated();
      }
      setTimeout(() => setActionMessage(""), 3500);
    } catch (err: any) {
      setActionMessage(`⚠️ Falha ao remover foto: ${err?.message || "Erro desconhecido"}`);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

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

  const openSession = memberSessions.find((s) => s.checkOut === null && s.voidedAt === null);
  const openSessionSeconds = openSession
    ? Math.max(0, Math.floor((Date.now() - new Date(openSession.checkIn).getTime()) / 1000))
    : 0;
  const isLongSession = isPresent && openSessionSeconds >= 6 * 3600;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-end bg-black/50 backdrop-blur-xs transition-opacity animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-member-name"
    >
      <div
        ref={drawerRef}
        className="h-full w-full max-w-full sm:max-w-md bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border-l border-white/80 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-slide-left text-[#171715] dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header estilo Apple Sheet com tipografia Claude */}
        <div className="flex items-start justify-between border-b border-[#E5E2DC] dark:border-slate-800 bg-[#FAF9F5]/90 dark:bg-slate-800/90 p-5 gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            {/* Avatar com upload e foto interativa */}
            <div className="relative group shrink-0">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={member.name}
                  onError={() => setAvatarUrl(null)}
                  className="h-14 w-14 rounded-2xl object-cover ring-2 ring-white dark:ring-slate-800 shadow-md transition-transform duration-200 group-hover:scale-102"
                />
              ) : (
                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${getAvatarStyle(member.name)} text-lg font-bold ring-2 ring-white dark:ring-slate-800 shadow-md`}
                >
                  {member.name.charAt(0).toUpperCase()}
                </div>
              )}

              {/* Botão de upload sobreposto em hover */}
              <label
                className={`absolute inset-0 rounded-2xl bg-black/50 text-white flex flex-col items-center justify-center transition-opacity cursor-pointer ${
                  isUploadingAvatar ? "opacity-100 bg-black/70" : "opacity-0 group-hover:opacity-100"
                }`}
                title="Alterar foto de perfil"
              >
                {isUploadingAvatar ? (
                  <span className="text-xs animate-spin">⏳</span>
                ) : (
                  <>
                    <span className="text-sm leading-none">📷</span>
                    <span className="text-[9px] font-semibold mt-0.5">Editar</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  disabled={isUploadingAvatar}
                  className="hidden"
                />
              </label>

              {/* Ícone de câmera de fácil toque no mobile */}
              <label
                className="sm:hidden absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-white dark:bg-slate-800 border border-[#E5E2DC] dark:border-slate-700 shadow-xs text-xs cursor-pointer text-slate-700 dark:text-slate-200"
                title="Alterar foto"
              >
                📷
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  disabled={isUploadingAvatar}
                  className="hidden"
                />
              </label>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10.5px] font-sans font-semibold uppercase tracking-wider text-[#706E6A] dark:text-slate-400 block">
                  Ficha do Integrante
                </span>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    disabled={isUploadingAvatar}
                    className="text-[10px] text-rose-500 hover:text-rose-700 dark:hover:text-rose-400 underline transition-colors cursor-pointer"
                    title="Remover foto personalizada"
                  >
                    remover foto
                  </button>
                )}
              </div>
              <h2 id="drawer-member-name" className="font-editorial text-xl sm:text-2xl font-normal text-[#171715] dark:text-slate-100 truncate">
                {member.name}
              </h2>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {member.matricula && (
                  <span className="rounded-md bg-white dark:bg-slate-800 border border-[#E5E2DC] dark:border-slate-700 px-2 py-0.5 text-2xs font-mono-data font-medium text-[#706E6A] dark:text-slate-300">
                    {member.matricula}
                  </span>
                )}
                {isPresent ? (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/80 pl-2 pr-2.5 py-0.5 text-[10.5px] font-medium text-emerald-800 dark:text-emerald-300 shadow-2xs">
                      <span className="relative flex h-2 w-2 items-center justify-center shrink-0">
                        <span className="absolute h-1.5 w-1.5 rounded-full bg-emerald-400 opacity-75 animate-live-ping" />
                        <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      </span>
                      Presente
                    </span>
                    {isLongSession && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100/90 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700/70 px-2 py-0.5 text-[10px] font-semibold text-amber-900 dark:text-amber-300 font-mono-data shadow-2xs" title="Sessão aberta há mais de 6 horas">
                        ⚠️ Sessão longa (&gt; 6h)
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#FAF9F5] dark:bg-slate-800 border border-[#E5E2DC] dark:border-slate-700 px-2.5 py-0.5 text-[10.5px] font-medium text-[#706E6A] dark:text-slate-400">
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
            className="flex h-10 w-10 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full bg-black/[0.04] hover:bg-black/[0.08] dark:bg-white/10 dark:hover:bg-white/20 text-[#706E6A] dark:text-slate-300 hover:text-[#171715] dark:hover:text-white transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Painel de Gestão da Tutoria */}
        {user && (
          <div className="border-b border-[#E5E2DC] dark:border-slate-800 bg-[#FAF5F0]/70 dark:bg-slate-800/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-sans font-semibold uppercase tracking-wider text-[#C15F3D] dark:text-amber-400 flex items-center gap-1.5">
                <span>🛡️</span> Ações da Tutoria
              </span>
              <span className="text-[10.5px] text-[#706E6A] dark:text-slate-400 font-medium">
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
                  className="flex flex-col items-center justify-center p-3 rounded-2xl border border-emerald-600/20 dark:border-emerald-700/40 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100/60 dark:hover:bg-emerald-900/40 active:scale-98 transition-all cursor-pointer disabled:opacity-50 text-center shadow-2xs min-h-[54px]"
                >
                  <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                    {busyAction === "checkout" ? "Registrando..." : "🚪 Registrar Saída"}
                  </span>
                  <span className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80 font-medium mt-0.5">
                    Computa horas até agora
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTutorAction("void")}
                  disabled={busyAction !== null}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl border border-rose-600/20 dark:border-rose-700/40 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100/60 dark:hover:bg-rose-900/40 active:scale-98 transition-all cursor-pointer disabled:opacity-50 text-center shadow-2xs min-h-[54px]"
                >
                  <span className="text-xs font-bold text-rose-800 dark:text-rose-300">
                    {busyAction === "void" ? "Cancelando..." : "🛑 Cancelar Entrada"}
                  </span>
                  <span className="text-[10px] text-rose-700/80 dark:text-rose-400/80 font-medium mt-0.5">
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
                  className="w-full flex items-center justify-between p-3.5 rounded-2xl border border-emerald-600/25 dark:border-emerald-700/40 bg-emerald-50/90 dark:bg-emerald-950/40 hover:bg-emerald-100/70 dark:hover:bg-emerald-900/40 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50 shadow-2xs min-h-[52px]"
                >
                  <div className="flex items-center gap-2.5 text-left">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-600 dark:bg-emerald-700 text-white text-sm shadow-2xs">
                      🚪
                    </span>
                    <div>
                      <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200 block font-sans">
                        {busyAction === "checkin" ? "Registrando Entrada..." : "Registrar Entrada Manual"}
                      </span>
                      <span className="text-[10.5px] text-emerald-700 dark:text-emerald-400 font-medium">
                        Contingência para reconhecimento facial
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-mono-data font-semibold text-emerald-800 dark:text-emerald-300 bg-white/90 dark:bg-slate-800 border border-emerald-200 dark:border-emerald-700/60 px-2.5 py-1 rounded-full">
                    Iniciar agora →
                  </span>
                </button>
              </div>
            )}

            {actionMessage && (
              <div className="rounded-xl border border-[#E5E2DC] dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-xs font-medium text-center text-[#171715] dark:text-slate-100 shadow-2xs animate-fade-in">
                {actionMessage}
              </div>
            )}
          </div>
        )}

        {/* Total stats card estilo Perplexity Mono + Claude Paper */}
        <div className="p-5 border-b border-[#E5E2DC] dark:border-slate-800 bg-[#FAF9F5]/40 dark:bg-slate-900/40 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-[#E5E2DC] dark:border-slate-700 bg-white dark:bg-slate-800/80 p-3.5 shadow-2xs">
            <span className="text-[10px] font-sans font-semibold uppercase tracking-wider text-[#706E6A] dark:text-slate-400 block">Total de Permanência</span>
            <span className="text-2xl font-semibold text-[#171715] dark:text-slate-100 mt-1 block font-mono-data">
              {formatDuration(totalSeconds)}
            </span>
          </div>
          <div className="rounded-2xl border border-[#E5E2DC] dark:border-slate-700 bg-white dark:bg-slate-800/80 p-3.5 shadow-2xs">
            <span className="text-[10px] font-sans font-semibold uppercase tracking-wider text-[#706E6A] dark:text-slate-400 block">Sessões no Período</span>
            <span className="text-2xl font-semibold text-[#171715] dark:text-slate-100 mt-1 block font-mono-data">
              {memberSessions.length}
            </span>
          </div>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-5 space-y-4">
          <h3 className="text-[11px] font-sans font-semibold uppercase tracking-wider text-[#706E6A] dark:text-slate-400">
            Histórico de Sessões no Período
          </h3>

          {memberSessions.length === 0 ? (
            <div className="rounded-2xl border border-[#E5E2DC] dark:border-slate-800 bg-[#FAF9F5] dark:bg-slate-800/50 p-8 text-center text-[#706E6A] dark:text-slate-400 text-sm">
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
                        ? "border-amber-300 dark:border-amber-700/80 bg-amber-50/20 dark:bg-amber-950/20 hover:border-amber-400"
                        : "border-[#E5E2DC] dark:border-slate-700 bg-white dark:bg-slate-800/80 hover:border-[#706E6A]/30 dark:hover:border-slate-600"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs flex-wrap gap-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-editorial font-medium text-sm text-[#171715] dark:text-slate-100 capitalize">
                          {dateLabel}
                        </span>
                        {isOver10h ? (
                          <span className="rounded-full bg-amber-100/90 dark:bg-amber-900/60 border border-amber-300 dark:border-amber-700 px-2 py-0.5 font-bold text-amber-900 dark:text-amber-300 text-[10px] font-mono-data">
                            ⚠️ Anômala (&gt; 10h)
                          </span>
                        ) : isOpenSession && (Date.now() - new Date(s.checkIn).getTime()) / 1000 > 21600 ? (
                          <span className="rounded-full bg-amber-100/90 dark:bg-amber-900/60 border border-amber-300 dark:border-amber-700 px-2 py-0.5 font-bold text-amber-900 dark:text-amber-300 text-[10px] font-mono-data">
                            ⚠️ Sessão longa (&gt; 6h)
                          </span>
                        ) : null}
                      </div>

                      {isVoided ? (
                        <span className="rounded-full bg-[#FAF5F0] dark:bg-amber-950/40 border border-[#F0DCD3] dark:border-amber-800/50 px-2 py-0.5 font-medium text-[#C15F3D] dark:text-amber-400 text-[10px]">
                          🚫 Anulada (0h)
                        </span>
                      ) : isOpenSession ? (
                        <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/80 px-2 py-0.5 font-medium text-emerald-800 dark:text-emerald-300 text-[10px] animate-pulse">
                          ● Em andamento
                        </span>
                      ) : (
                        <span className="font-mono-data font-semibold text-[#171715] dark:text-slate-200 text-xs sm:text-sm">
                          {s.durationS ? formatDuration(s.durationS) : "0 min"}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs text-[#706E6A] dark:text-slate-400 font-mono-data">
                      <span>
                        Entrada: <strong className="text-[#171715] dark:text-slate-200 font-semibold">{formatTime(s.checkIn)}</strong>
                      </span>
                      <span>
                        Saída:{" "}
                        <strong className="text-[#171715] dark:text-slate-200 font-semibold">
                          {isOpenSession ? "—" : formatTime(s.checkOut!)}
                        </strong>
                      </span>
                    </div>

                    {/* Controles Administrativos do Tutor */}
                    {Boolean(user) && s.id != null && (
                      <div className="border-t border-[#E5E2DC]/80 dark:border-slate-700/80 pt-2 flex items-center justify-between gap-2">
                        {confirmDeleteSessionId === s.id ? (
                          <div className="w-full flex items-center justify-between gap-2 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl p-2 animate-fade-in">
                            <span className="text-[11px] font-medium text-rose-800 dark:text-rose-300 font-sans">
                              Excluir permanentemente?
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteSessionId(null)}
                                disabled={busySessionId !== null}
                                className="px-2 py-1 rounded-lg border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[10px] font-medium text-[#706E6A] dark:text-slate-300 cursor-pointer"
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
                              onClick={() => {
                                if (isVoided) {
                                  handleVoidSpecificSession(s.id!, true);
                                } else {
                                  setSessionToVoid({ id: s.id!, isCurrentlyVoided: false });
                                }
                              }}
                              disabled={busySessionId !== null}
                              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-[11px] font-sans font-medium transition-all cursor-pointer ${
                                isVoided
                                  ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100"
                                  : "border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 hover:bg-amber-100"
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
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-rose-200/80 dark:border-rose-800/80 bg-rose-50/60 dark:bg-rose-950/50 hover:bg-rose-100/80 text-rose-700 dark:text-rose-300 text-[11px] font-sans font-medium transition-all cursor-pointer"
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

          {/* Zona de Perigo Isolada (Exclusão / Descadastramento de Integrante) */}
          {user && (
            <div className="mt-8 pt-4 border-t border-rose-200/60 dark:border-rose-950/60">
              <div className="rounded-2xl border border-rose-200/80 dark:border-rose-900/40 bg-rose-50/30 dark:bg-rose-950/20 p-4 space-y-3">
                <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300">
                  <span className="text-base select-none">⚠️</span>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider font-sans">
                      Zona de Perigo · Descadastramento
                    </h4>
                    <p className="text-2xs text-rose-700/80 dark:text-rose-400 font-sans">
                      Ação irreversível de exclusão de cadastro e dados biométricos (LGPD).
                    </p>
                  </div>
                </div>

                {!isConfirmingRemove ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsConfirmingRemove(true);
                      setTypedMemberName("");
                    }}
                    disabled={busyAction !== null}
                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-rose-300 dark:border-rose-800 bg-white dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-sans font-semibold text-rose-700 dark:text-rose-400 transition-all cursor-pointer min-h-[40px] shadow-2xs"
                  >
                    <span>🗑️</span>
                    <span>Descadastrar este integrante do laboratório</span>
                  </button>
                ) : (
                  <div className="rounded-xl border border-rose-300 dark:border-rose-800 bg-white dark:bg-slate-900 p-3.5 space-y-3 animate-scale-up">
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-rose-900 dark:text-rose-200 block font-sans">
                        Confirmar Descadastramento Permanente
                      </span>
                      <p className="text-[11.5px] text-rose-800 dark:text-rose-300 leading-relaxed font-sans">
                        O integrante <strong>{member.name}</strong> será desativado e sua biometria facial excluída permanentemente.
                      </p>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <label htmlFor="confirm-member-name" className="text-2xs font-bold text-slate-700 dark:text-slate-300 block font-sans">
                        Para confirmar, digite exatamente <code className="bg-rose-100 dark:bg-rose-950/80 text-rose-900 dark:text-rose-200 px-1 py-0.5 rounded font-mono-data select-all">{member.name}</code>:
                      </label>
                      <input
                        id="confirm-member-name"
                        type="text"
                        value={typedMemberName}
                        onChange={(e) => setTypedMemberName(e.target.value)}
                        placeholder={member.name}
                        className="w-full rounded-xl border border-rose-300 dark:border-rose-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </div>

                    <div className="flex items-center gap-2 justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setIsConfirmingRemove(false);
                          setTypedMemberName("");
                        }}
                        disabled={busyAction !== null}
                        className="rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-medium text-[#706E6A] dark:text-slate-300 hover:text-[#171715] dark:hover:text-white transition-all cursor-pointer min-h-[36px]"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTutorAction("remove")}
                        disabled={busyAction !== null || typedMemberName.trim() !== member.name.trim()}
                        className="rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 text-xs font-sans font-bold text-white shadow-2xs active:scale-95 transition-all cursor-pointer min-h-[36px]"
                      >
                        {busyAction === "remove" ? "Descadastrando..." : "Confirmar Exclusão"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Explicativo de Anulação de Sessão */}
        {sessionToVoid && (
          <div
            className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="void-modal-title"
          >
            <div className="w-full max-w-sm rounded-3xl border border-[#E5E2DC] dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xl space-y-4 animate-scale-up text-slate-900 dark:text-slate-100">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-lg">
                  🚫
                </span>
                <div>
                  <h4 id="void-modal-title" className="font-editorial text-lg font-bold">
                    Anular Horas da Sessão
                  </h4>
                  <p className="text-2xs text-[#706E6A] dark:text-slate-400">Auditoria de Permanência</p>
                </div>
              </div>
              <p className="text-xs text-[#706E6A] dark:text-slate-300 leading-relaxed">
                Esta ação anulará a duração computada desta sessão (<strong>0h 00m</strong>) para fins de auditoria de metas (por exemplo, saída não registrada ou anomalia). Os horários originais de entrada e saída permanecem preservados no histórico do laboratório.
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSessionToVoid(null)}
                  disabled={busySessionId !== null}
                  className="rounded-xl border border-[#E5E2DC] dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-medium text-[#706E6A] dark:text-slate-300 hover:text-[#171715] dark:hover:text-white cursor-pointer min-h-[38px]"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const sid = sessionToVoid.id;
                    setSessionToVoid(null);
                    await handleVoidSpecificSession(sid, false);
                  }}
                  disabled={busySessionId !== null}
                  className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 text-xs font-bold shadow-2xs active:scale-95 cursor-pointer min-h-[38px]"
                >
                  Confirmar Anulação
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Drawer Footer */}
        <div className="border-t border-[#E5E2DC] dark:border-slate-800 bg-[#FAF9F5] dark:bg-slate-900 p-4">
          <button
            onClick={onClose}
            className="w-full rounded-2xl bg-[#171715] hover:bg-[#2A2925] dark:bg-slate-800 dark:hover:bg-slate-700 py-3.5 px-4 min-h-[48px] text-sm font-sans font-medium text-[#FAF9F5] dark:text-slate-100 shadow-xs active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center tracking-tight"
          >
            Fechar Detalhes
          </button>
        </div>
      </div>
    </div>
  );
}
