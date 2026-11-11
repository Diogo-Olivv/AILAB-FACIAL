import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  X,
  FileCheck2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  RotateCcw,
  User,
} from "lucide-react";
import type { Member } from "../lib/reports";
import { formatDuration } from "../lib/aggregate";
import {
  type AttendanceJustification,
  type JustificationCategory,
  JUSTIFICATION_CATEGORIES,
  WEEKLY_TARGET_SECONDS,
  justifyAttendanceDebt,
  revokeAttendanceJustification,
} from "../lib/compliance";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  member: Member;
  totalSeconds: number;
  periodStartMonday: string;
  weekLabel: string;
  existingJustification?: AttendanceJustification | null;
  onSuccess: (updated: AttendanceJustification) => void;
}

export function JustifyModal({
  isOpen,
  onClose,
  member,
  totalSeconds,
  periodStartMonday,
  weekLabel,
  existingJustification,
  onSuccess,
}: Props) {
  const [category, setCategory] = useState<JustificationCategory>("saude");
  const [reason, setReason] = useState("");
  const [revocationReason, setRevocationReason] = useState("");
  const [isRevoking, setIsRevoking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
      document.body.classList.add("modal-open");
      setCategory("saude");
      setReason("");
      setRevocationReason("");
      setIsRevoking(false);
      setErrorMsg(null);
    } else {
      document.body.classList.remove("modal-open");
      previouslyFocusedRef.current?.focus();
    }
    return () => {
      document.body.classList.remove("modal-open");
    };
  }, [isOpen]);

  // Gestão de atalhos: ESC com prioridade de modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const deficit = Math.max(0, WEEKLY_TARGET_SECONDS - totalSeconds);
  const isAlreadyActive =
    existingJustification && existingJustification.status === "active";

  const handleJustify = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (category === "outro" && (!reason.trim() || reason.trim().length < 3)) {
      setErrorMsg("A descrição do motivo é obrigatória quando selecionado 'Outro' (mínimo 3 caracteres).");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await justifyAttendanceDebt(
        member.id,
        periodStartMonday,
        category,
        reason.trim() || undefined
      );
      onSuccess(res);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || "Falha ao registrar justificativa.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevoke = async () => {
    if (!existingJustification) return;
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      const res = await revokeAttendanceJustification(
        existingJustification.id,
        revocationReason.trim() || undefined
      );
      onSuccess(res);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || "Falha ao revogar justificativa.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="justify-dialog-title"
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#0F1623] shadow-2xl overflow-hidden my-auto animate-scale-up"
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200/80 dark:border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400">
              <FileCheck2 className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="justify-dialog-title"
                className="text-sm sm:text-base font-bold text-slate-900 dark:text-white"
              >
                {isAlreadyActive ? "Justificativa Ativa" : "Justificar Débito de Frequência"}
              </h2>
              <p className="text-2xs sm:text-xs text-slate-500 dark:text-slate-400">
                Semana {weekLabel}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors cursor-pointer"
            aria-label="Fechar modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Resumo do Discente e Horas */}
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-[#161F30]/60 border border-slate-200/60 dark:border-white/[0.05] text-xs">
            <div className="col-span-2 flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-white/[0.05]">
              <div className="flex items-center gap-2 min-w-0">
                <User className="h-4 w-4 text-slate-400 shrink-0" />
                <span className="font-semibold text-slate-900 dark:text-white truncate">
                  {member.name}
                </span>
              </div>
              <span className="font-mono-data text-2xs text-slate-500 dark:text-slate-400 shrink-0">
                {member.matricula ? `#${member.matricula}` : "Discente"}
              </span>
            </div>

            <div>
              <span className="text-slate-500 dark:text-slate-400 block text-2xs">Horas Cumpridas</span>
              <span className="font-mono-data font-bold text-slate-900 dark:text-white text-sm">
                {formatDuration(totalSeconds)}
              </span>
            </div>

            <div>
              <span className="text-slate-500 dark:text-slate-400 block text-2xs">Débito na Semana</span>
              <span className="font-mono-data font-bold text-rose-600 dark:text-rose-400 text-sm">
                -{formatDuration(deficit)}
              </span>
            </div>
          </div>

          {errorMsg && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {isAlreadyActive ? (
            /* Visualização de Justificativa Existente */
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 text-xs space-y-2">
                <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 font-bold">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Semana Justificada</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300">
                  <strong className="text-slate-800 dark:text-white">Categoria: </strong>
                  {JUSTIFICATION_CATEGORIES.find((c) => c.id === existingJustification.category)?.label || existingJustification.category}
                </p>
                {existingJustification.reason && (
                  <p className="text-slate-600 dark:text-slate-300">
                    <strong className="text-slate-800 dark:text-white">Motivo: </strong>
                    {existingJustification.reason}
                  </p>
                )}
                <p className="text-2xs text-slate-500 dark:text-slate-400 pt-1 border-t border-emerald-200/50 dark:border-emerald-900/30">
                  Concedida por {existingJustification.justifiedByLabel || "Tutor"} em{" "}
                  {new Date(existingJustification.justifiedAt).toLocaleDateString("pt-BR")}
                </p>
              </div>

              {!isRevoking ? (
                <div className="flex justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors cursor-pointer"
                  >
                    Fechar
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsRevoking(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-900/50 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Revogar Justificativa</span>
                  </button>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 space-y-3">
                  <p className="text-xs font-semibold text-rose-800 dark:text-rose-300">
                    Confirma a revogação? O aluno voltará a constar em débito nesta semana.
                  </p>
                  <input
                    type="text"
                    value={revocationReason}
                    onChange={(e) => setRevocationReason(e.target.value)}
                    placeholder="Motivo da revogação (opcional)"
                    className="w-full text-xs px-3 py-2 rounded-lg bg-white dark:bg-[#161F30] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-white"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsRevoking(false)}
                      disabled={isSubmitting}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.05] cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleRevoke}
                      disabled={isSubmitting}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors cursor-pointer"
                    >
                      {isSubmitting && <Loader2 className="h-3 w-3 animate-spin" />}
                      <span>Confirmar Revogação</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Formulário de Nova Justificativa */
            <form onSubmit={handleJustify} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                  Categoria da Justificativa
                </label>
                <div className="space-y-1.5">
                  {JUSTIFICATION_CATEGORIES.map((cat) => (
                    <label
                      key={cat.id}
                      className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                        category === cat.id
                          ? "border-orange-500/80 bg-orange-500/10 text-orange-950 dark:text-white font-semibold"
                          : "border-slate-200/80 dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-white/[0.02] text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="justification_category"
                        value={cat.id}
                        checked={category === cat.id}
                        onChange={() => setCategory(cat.id)}
                        className="text-orange-600 focus:ring-orange-500"
                      />
                      <span>{cat.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                  Detalhes / Observações{" "}
                  {category === "outro" ? (
                    <span className="text-rose-500 font-normal">(Obrigatório)</span>
                  ) : (
                    <span className="text-slate-400 font-normal">(Opcional)</span>
                  )}
                </label>
                <textarea
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={
                    category === "outro"
                      ? "Descreva o motivo detalhado (mínimo 3 caracteres)..."
                      : "Ex: Atestado médico apresentado ou participação em congresso..."
                  }
                  className="w-full text-xs px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#161F30]/70 border border-slate-200/80 dark:border-white/[0.08] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 shadow-sm transition-colors cursor-pointer"
                >
                  {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Confirmar Justificativa</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document !== "undefined") {
    return createPortal(modalContent, document.body);
  }
  return modalContent;
}
