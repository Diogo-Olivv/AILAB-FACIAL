import { useEffect, useRef } from "react";
import { X, Binary, Shield, Cpu, Search, Lock } from "lucide-react";

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
      className="fixed inset-0 z-50 m-auto max-h-[90vh] w-[92vw] max-w-2xl overflow-y-auto rounded-3xl border border-[#E5E2DC] bg-[#FAF9F5] p-6 sm:p-8 text-[#171715] shadow-[0_8px_30px_rgba(23,23,21,0.08)] backdrop:bg-black/40 backdrop:backdrop-blur-xs animate-fade-in"
      aria-labelledby="how-it-works-title"
    >
      <div className="space-y-6">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-4 border-b border-[#E5E2DC] pb-4">
          <div className="space-y-1">
            <span className="rounded-full bg-[#FAF5F0] border border-[#F0DCD3] px-2.5 py-0.5 text-xs font-mono-data font-medium text-[#C15F3D]">
              Arquitetura Técnica & IA
            </span>
            <h2 id="how-it-works-title" className="font-editorial text-xl sm:text-2xl font-normal text-[#171715]">
              Como Funciona o Reconhecimento Facial
            </h2>
            <p className="text-xs text-[#706E6A]">
              Pipeline de Visão Computacional, Anti-Spoofing e Busca Vetorial no AILAB Makers.
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E5E2DC] bg-white text-[#706E6A] hover:text-[#171715] hover:bg-[#FAF9F5] cursor-pointer min-h-[44px] min-w-[44px] transition-colors"
            aria-label="Fechar modal explicativo"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 4 Pilares da Tecnologia */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Pilar 1 */}
          <div className="rounded-2xl border border-[#E5E2DC] bg-white p-4 space-y-2 shadow-2xs">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#171715]">
              <Binary className="h-4 w-4 text-indigo-500" />
              <span className="font-editorial text-base">1. Alinhamento Facial</span>
            </div>
            <p className="text-xs text-[#706E6A] leading-relaxed">
              O modelo detecta a face e normaliza os marcos anatômicos (olhos, nariz e boca)
              garantindo invariância à inclinação da cabeça e distorções de perspectiva.
            </p>
          </div>

          {/* Pilar 2 */}
          <div className="rounded-2xl border border-[#E5E2DC] bg-white p-4 space-y-2 shadow-2xs">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#171715]">
              <Shield className="h-4 w-4 text-amber-500" />
              <span className="font-editorial text-base">2. Anti-Spoofing (MiniFASNet)</span>
            </div>
            <p className="text-xs text-[#706E6A] leading-relaxed">
              Rede neural especializada avalia microtexturas, reflexos de iluminação e bordas de telas
              para impedir ataques com fotos impressas, celulares ou máscaras digitais.
            </p>
          </div>

          {/* Pilar 3 */}
          <div className="rounded-2xl border border-[#E5E2DC] bg-white p-4 space-y-2 shadow-2xs">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#171715]">
              <Cpu className="h-4 w-4 text-emerald-500" />
              <span className="font-editorial text-base">3. Embedding ArcFace 512-D</span>
            </div>
            <p className="text-xs text-[#706E6A] leading-relaxed">
              A imagem é transformada em uma representação matemática compacta de 512 números
              (vetor L2-normalizado). As fotos são descartadas da memória imediatamente após esse cálculo.
            </p>
          </div>

          {/* Pilar 4 */}
          <div className="rounded-2xl border border-[#E5E2DC] bg-white p-4 space-y-2 shadow-2xs">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#171715]">
              <Search className="h-4 w-4 text-blue-500" />
              <span className="font-editorial text-base">4. Similaridade Cosseno HNSW</span>
            </div>
            <p className="text-xs text-[#706E6A] leading-relaxed">
              No PostgreSQL (pgvector com índice HNSW), o vetor é comparado por similaridade de cosseno.
              O limiar calibrado exige &ge; 62% para confirmação inequívoca de identidade.
            </p>
          </div>
        </div>

        {/* Garantia de Privacidade */}
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-xs text-emerald-950 space-y-1">
          <span className="font-semibold text-emerald-900 flex items-center gap-1.5 font-sans">
            <Lock className="h-3.5 w-3.5 text-emerald-700" />
            <span>Princípio da Minimização de Dados (LGPD Art. 6º, III e Art. 11)</span>
          </span>
          <p className="leading-relaxed">
            Não armazenamos fotografias nem reconstituímos rostos a partir dos embeddings. O vetor numérico
            serve exclusivamente para verificar a presença acadêmica no laboratório.
          </p>
        </div>

        {/* Ação de Fechar */}
        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="rounded-2xl bg-[#171715] hover:bg-[#2A2925] px-6 py-2.5 text-xs font-sans font-medium text-[#FAF9F5] shadow-xs active:scale-[0.98] cursor-pointer min-h-[44px] transition-all tracking-tight"
          >
            Entendido
          </button>
        </div>
      </div>
    </dialog>
  );
}
