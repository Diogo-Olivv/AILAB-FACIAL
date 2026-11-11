import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Binary, Shield, Cpu, Search, Lock } from "lucide-react";

interface HowItWorksModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HowItWorksModal({ isOpen, onClose }: HowItWorksModalProps) {
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

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/60 backdrop-blur-sm transition-opacity animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="how-it-works-title"
    >
      <div
        className="relative w-full max-w-2xl max-h-[88vh] rounded-2xl border border-slate-200/90 dark:border-white/[0.1] bg-white dark:bg-[#0F1623] text-slate-900 dark:text-slate-100 shadow-2xl flex flex-col overflow-hidden animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho Fixo */}
        <div className="modal-header flex items-center justify-between gap-4 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 ring-1 ring-orange-500/25 text-orange-600 dark:text-amber-400">
              <Cpu className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <span className="inline-block rounded-md bg-orange-500/10 ring-1 ring-orange-500/20 px-2 py-0.5 text-[10px] font-mono-data font-bold uppercase tracking-wider text-orange-600 dark:text-amber-400">
                Arquitetura Técnica & IA
              </span>
              <h2 id="how-it-works-title" className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white truncate mt-0.5">
                Como Funciona o Reconhecimento Facial
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="icon-btn !rounded-lg"
            aria-label="Fechar modal explicativo"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Corpo com Rolagem Suave */}
        <div className="overflow-y-auto max-h-[80vh] p-5 sm:p-6 space-y-5">
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            O ecossistema biométrico do <strong>AILAB Makers</strong> combina visão computacional em tempo real,
            detecção de vivacidade óptica e busca vetorial indexada para contabilizar horas acadêmicas com
            precisão e privacidade absoluta.
          </p>

          {/* 4 Pilares da Tecnologia */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="surface-muted p-4 space-y-2">
              <div className="flex items-center gap-2.5 text-sm font-bold text-slate-900 dark:text-white">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 ring-1 ring-indigo-500/20 text-indigo-600 dark:text-indigo-400">
                  <Binary className="h-4 w-4" />
                </span>
                <span>1. Alinhamento Facial</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                O detector localiza a face e normaliza 5 marcos anatômicos (olhos, nariz e comissuras labiais),
                garantindo invariância à inclinação e distância.
              </p>
            </div>

            <div className="surface-muted p-4 space-y-2">
              <div className="flex items-center gap-2.5 text-sm font-bold text-slate-900 dark:text-white">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 ring-1 ring-amber-500/20 text-amber-600 dark:text-amber-400">
                  <Shield className="h-4 w-4" />
                </span>
                <span>2. Anti-Spoofing (MiniFASNet)</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Um modelo de detecção de ataque de apresentação avalia a textura do rosto capturado para
                reduzir tentativas com fotos impressas ou telas. É uma barreira adicional, não uma garantia absoluta.
              </p>
            </div>

            <div className="surface-muted p-4 space-y-2">
              <div className="flex items-center gap-2.5 text-sm font-bold text-slate-900 dark:text-white">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                  <Cpu className="h-4 w-4" />
                </span>
                <span>3. Embedding ArcFace <span className="tabular-nums">512-D</span></span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                A face é convertida em um vetor L2-normalizado de <span className="tabular-nums font-mono-data">512</span> dimensões.
                O frame fotográfico original é descartado da memória RAM imediatamente.
              </p>
            </div>

            <div className="surface-muted p-4 space-y-2">
              <div className="flex items-center gap-2.5 text-sm font-bold text-slate-900 dark:text-white">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10 ring-1 ring-sky-500/20 text-sky-600 dark:text-sky-400">
                  <Search className="h-4 w-4" />
                </span>
                <span>4. Busca Vetorial HNSW</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                O vetor é comparado por similaridade de cosseno no banco com índice HNSW, exigindo limiar
                mínimo de <span className="tabular-nums font-mono-data font-semibold">62%</span> para confirmar a presença.
              </p>
            </div>
          </div>

          {/* Garantia de Privacidade */}
          <div className="rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20 p-4 text-xs text-emerald-950 dark:text-emerald-200 space-y-1">
            <span className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 shrink-0" />
              <span>Princípio da Minimização de Dados (LGPD Art. 6º, III e Art. 11)</span>
            </span>
            <p className="text-emerald-800/90 dark:text-emerald-200/85 leading-relaxed">
              Nenhuma fotografia facial é salva em disco ou banco de dados. O sistema guarda apenas vetores
              matemáticos derivados do rosto, tratados como dado biométrico sensível e usados exclusivamente
              para o registro de frequência acadêmica.
            </p>
          </div>
        </div>

        {/* Rodapé Fixo */}
        <div className="modal-footer flex justify-end px-5 py-3.5 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="btn-primary !px-6"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document !== "undefined") {
    return createPortal(modalContent, document.body);
  }
  return modalContent;
}
