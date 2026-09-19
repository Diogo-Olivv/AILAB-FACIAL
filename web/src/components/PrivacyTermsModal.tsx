import { useEffect } from "react";
import { Scale, X } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function PrivacyTermsModal({ isOpen, onClose }: Props) {
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-md animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-modal-title"
    >
      <div
        className="relative w-full max-w-2xl max-h-[86vh] sm:max-h-[88vh] bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-3xl border border-[#E5E2DC] dark:border-slate-800 shadow-[0_12px_40px_rgba(23,23,21,0.08)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Responsivo estilo Apple Glass com suporte total ao Dark Mode */}
        <div className="flex items-center justify-between border-b border-[#E5E2DC] dark:border-slate-800 bg-[#FAF9F5]/90 dark:bg-slate-950/80 px-5 py-4 sm:px-6 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#FAF5F0] dark:bg-amber-950/40 border border-[#F0DCD3] dark:border-amber-800/50 text-[#C15F3D] dark:text-amber-400 font-bold shadow-2xs">
              <Scale className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 id="terms-modal-title" className="font-editorial text-base sm:text-lg md:text-xl font-normal text-[#171715] dark:text-slate-100 truncate">
                Termos & Privacidade Biométrica
              </h2>
              <p className="text-[10.5px] font-mono-data font-medium text-emerald-700 dark:text-emerald-400 truncate">
                LGPD (Lei nº 13.709/2018 - Art. 11)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar termos de privacidade"
            className="flex h-10 w-10 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full bg-black/[0.04] dark:bg-white/10 hover:bg-black/[0.08] dark:hover:bg-white/20 text-[#706E6A] dark:text-slate-300 hover:text-[#171715] dark:hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Corpo com Rolagem Fluída e Suporte Total a Touch no Tablet */}
        <div
          className="flex-1 overflow-y-auto overflow-x-hidden px-5 py-5 sm:px-6 space-y-4 text-xs sm:text-sm text-[#706E6A] dark:text-slate-300 leading-relaxed break-words overscroll-contain touch-pan-y"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {/* Seção 1 */}
          <div className="rounded-2xl border border-[#F0DCD3] dark:border-amber-800/40 bg-[#FAF5F0]/80 dark:bg-amber-950/30 p-4 text-[#171715] dark:text-slate-200">
            <h3 className="font-editorial text-sm sm:text-base font-normal text-[#C15F3D] dark:text-amber-400 mb-1">
              1. Identificação e Finalidade
            </h3>
            <p className="text-xs sm:text-sm text-[#171715]/90 dark:text-slate-200/90 leading-relaxed">
              O tratamento biométrico facial é operado pelo <strong>AILAB Makers (Maker Foundation)</strong> exclusivamente para controle acadêmico de frequência e registro de permanência em laboratório. Os dados jamais serão comercializados ou cedidos a terceiros.
            </p>
          </div>

          {/* Seção 2 */}
          <div className="space-y-1">
            <h3 className="font-editorial text-sm sm:text-base font-normal text-[#171715] dark:text-slate-100">
              2. Base Legal (Art. 11, II, "g" da LGPD)
            </h3>
            <p className="text-xs sm:text-sm text-[#706E6A] dark:text-slate-400">
              O tratamento ocorre com respaldo legal para prevenção à fraude e segurança na autenticação presencial dos integrantes no laboratório.
            </p>
          </div>

          {/* Seção 3 */}
          <div className="space-y-1">
            <h3 className="font-editorial text-sm sm:text-base font-normal text-[#171715] dark:text-slate-100">
              3. Descarte Imediato de Fotos e Embeddings 512-D
            </h3>
            <p className="text-xs sm:text-sm text-[#706E6A] dark:text-slate-400">
              O sistema <strong>não armazena fotos da câmera</strong>:
            </p>
            <ul className="list-disc pl-4 sm:pl-5 space-y-1 text-[#171715] dark:text-slate-200">
              <li>A foto é recebida temporariamente apenas na memória RAM da inferência neural.</li>
              <li>É gerado um vetor numérico matemático (embedding de 512 dimensões).</li>
              <li>A foto original é <strong>destruída de imediato</strong>, tornando impossível reconstruir o rosto a partir do banco.</li>
            </ul>
          </div>

          {/* Seção 4 */}
          <div className="space-y-1">
            <h3 className="font-editorial text-sm sm:text-base font-normal text-[#171715] dark:text-slate-100">
              4. Segurança Criptográfica & RLS
            </h3>
            <p className="text-xs sm:text-sm text-[#706E6A] dark:text-slate-400">
              Acesso protegido por Row Level Security (RLS) no PostgreSQL, criptografia em trânsito TLS 1.3 e verificação anti-spoofing ativa no totem de entrada.
            </p>
          </div>

          {/* Seção 5 */}
          <div className="space-y-1">
            <h3 className="font-editorial text-sm sm:text-base font-normal text-[#171715] dark:text-slate-100">
              5. Direitos do Titular (Art. 18)
            </h3>
            <p className="text-xs sm:text-sm text-[#706E6A] dark:text-slate-400">
              O aluno pode revogar o consentimento a qualquer momento solicitando ao tutor, resultando na exclusão definitiva do vetor biométrico da base de dados.
            </p>
          </div>

          {/* Seção 6 */}
          <div className="rounded-2xl border border-[#E5E2DC] dark:border-slate-700 bg-[#FAF9F5] dark:bg-slate-800/60 p-3.5 text-xs text-[#706E6A] dark:text-slate-300">
            <p>
              <strong>Dúvidas ou solicitações:</strong> Fale com a coordenação ou com os tutores do AiLab Makers.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-[#E5E2DC] dark:border-slate-800 bg-[#FAF9F5]/70 dark:bg-slate-950/70 px-5 py-4 sm:px-6">
          <button
            onClick={onClose}
            className="w-full sm:w-auto rounded-2xl bg-[#171715] dark:bg-white hover:bg-[#2A2925] dark:hover:bg-slate-100 px-8 py-3 min-h-[46px] text-xs sm:text-sm font-sans font-medium text-[#FAF9F5] dark:text-slate-900 shadow-xs active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center tracking-tight"
          >
            Entendido e Ciente
          </button>
        </div>
      </div>
    </div>
  );
}
