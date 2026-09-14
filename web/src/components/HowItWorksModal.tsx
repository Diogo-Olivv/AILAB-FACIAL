import { useEffect, useRef } from "react";

interface HowItWorksModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HowItWorksModal({ isOpen, onClose }: HowItWorksModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="fixed inset-0 z-50 m-auto max-h-[90vh] w-[92vw] max-w-2xl overflow-y-auto rounded-3xl border border-line bg-card p-6 sm:p-8 text-ink shadow-2xl backdrop:bg-ink/50 backdrop:backdrop-blur-xs animate-fade-in"
      aria-labelledby="how-it-works-title"
    >
      <div className="space-y-6">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-4 border-b border-line pb-4">
          <div className="space-y-1">
            <span className="rounded-full bg-navy/10 px-2.5 py-0.5 text-xs font-bold text-navy">
              Arquitetura Técnica & IA
            </span>
            <h2 id="how-it-works-title" className="text-xl sm:text-2xl font-extrabold text-ink">
              Como Funciona o Reconhecimento Facial
            </h2>
            <p className="text-xs text-muted">
              Pipeline de Visão Computacional, Anti-Spoofing e Busca Vetorial no AILAB Makers.
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-white text-muted hover:text-ink hover:bg-navy/5 cursor-pointer min-h-[44px] min-w-[44px]"
            aria-label="Fechar modal explicativo"
          >
            ✕
          </button>
        </div>

        {/* 4 Pilares da Tecnologia */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Pilar 1 */}
          <div className="rounded-2xl border border-line bg-white/70 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-extrabold text-navy">
              <span>📐</span>
              <span>1. Alinhamento Facial</span>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              O modelo detecta a face e normaliza os marcos anatômicos (olhos, nariz e boca)
              garantindo invariância à inclinação da cabeça e distorções de perspectiva.
            </p>
          </div>

          {/* Pilar 2 */}
          <div className="rounded-2xl border border-line bg-white/70 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-extrabold text-green">
              <span>🛡️</span>
              <span>2. Anti-Spoofing (MiniFASNet)</span>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              Rede neural especializada avalia microtexturas, reflexos de iluminação e bordas de telas
              para impedir ataques com fotos impressas, celulares ou máscaras digitais.
            </p>
          </div>

          {/* Pilar 3 */}
          <div className="rounded-2xl border border-line bg-white/70 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-extrabold text-navy">
              <span>🧠</span>
              <span>3. Embedding ArcFace 512-D</span>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              A imagem é transformada em uma representação matemática compacta de 512 números
              (vetor L2-normalizado). As fotos são descartadas da memória imediatamente após esse cálculo.
            </p>
          </div>

          {/* Pilar 4 */}
          <div className="rounded-2xl border border-line bg-white/70 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-extrabold text-navy">
              <span>🔍</span>
              <span>4. Similaridade Cosseno HNSW</span>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              No PostgreSQL (pgvector com índice HNSW), o vetor é comparado por similaridade de cosseno.
              O limiar calibrado exige &ge; 62% para confirmação inequívoca de identidade.
            </p>
          </div>
        </div>

        {/* Garantia de Privacidade */}
        <div className="rounded-2xl border border-green/30 bg-green/10 p-4 text-xs text-ink/80 space-y-1">
          <span className="font-extrabold text-green block">
            🔒 Princípio da Minimização de Dados (LGPD Art. 6º, III e Art. 11)
          </span>
          <p>
            Não armazenamos fotografias nem reconstituímos rostos a partir dos embeddings. O vetor numérico
            serve exclusivamente para verificar a presença acadêmica no laboratório.
          </p>
        </div>

        {/* Ação de Fechar */}
        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="rounded-xl bg-navy px-6 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-navy-dark cursor-pointer min-h-[44px]"
          >
            Entendido
          </button>
        </div>
      </div>
    </dialog>
  );
}
