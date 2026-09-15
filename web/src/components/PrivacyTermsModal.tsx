import { useEffect } from "react";

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
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-ink/70 backdrop-blur-xs overflow-y-auto animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-modal-title"
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] bg-white/95 backdrop-blur-2xl rounded-3xl border border-white/80 shadow-2xl flex flex-col overflow-hidden animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Responsivo estilo Apple Glass */}
        <div className="flex items-center justify-between border-b border-black/[0.05] bg-gradient-to-b from-slate-50/90 to-white/95 px-5 py-4 sm:px-6 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-lg shadow-sm shadow-blue-500/25">
              ⚖️
            </div>
            <div className="min-w-0">
              <h2 id="terms-modal-title" className="text-sm sm:text-base md:text-lg font-black text-slate-900 truncate">
                Termos & Privacidade Biométrica
              </h2>
              <p className="text-2xs sm:text-xs font-bold uppercase tracking-wider text-emerald-700 truncate">
                LGPD (Lei nº 13.709/2018 - Art. 11)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar termos de privacidade"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/[0.05] hover:bg-black/[0.1] text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Corpo com Rolagem Estritamente Vertical e quebra de linha sem overflow */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-5 py-5 sm:px-6 space-y-4 text-xs sm:text-sm text-slate-600 leading-relaxed break-words">
          {/* Seção 1 */}
          <div className="rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-500/[0.06] to-indigo-500/[0.02] p-4">
            <h3 className="text-xs sm:text-sm font-bold text-blue-900 uppercase tracking-wider mb-1">
              1. Identificação e Finalidade
            </h3>
            <p className="text-slate-800">
              O tratamento biométrico facial é operado pelo <strong>AILAB Makers (Maker Foundation)</strong> exclusivamente para controle acadêmico de frequência e registro de permanência em laboratório. Os dados jamais serão comercializados ou cedidos a terceiros.
            </p>
          </div>

          {/* Seção 2 */}
          <div className="space-y-1">
            <h3 className="text-xs sm:text-sm font-bold text-slate-900">
              2. Base Legal (Art. 11, II, "g" da LGPD)
            </h3>
            <p>
              O tratamento ocorre com respaldo legal para prevenção à fraude e segurança na autenticação presencial dos integrantes no laboratório.
            </p>
          </div>

          {/* Seção 3 */}
          <div className="space-y-1">
            <h3 className="text-xs sm:text-sm font-bold text-slate-900">
              3. Descarte Imediato de Fotos e Embeddings 512-D
            </h3>
            <p>
              O sistema <strong>não armazena fotos da câmera</strong>:
            </p>
            <ul className="list-disc pl-4 sm:pl-5 space-y-1 text-slate-800">
              <li>A foto é recebida temporariamente apenas na memória RAM da inferência neural.</li>
              <li>É gerado um vetor numérico matemático (embedding de 512 dimensões).</li>
              <li>A foto original é <strong>destruída de imediato</strong>, tornando impossível reconstruir o rosto a partir do banco.</li>
            </ul>
          </div>

          {/* Seção 4 */}
          <div className="space-y-1">
            <h3 className="text-xs sm:text-sm font-bold text-slate-900">
              4. Segurança Criptográfica & RLS
            </h3>
            <p>
              Acesso protegido por Row Level Security (RLS) no PostgreSQL, criptografia em trânsito TLS 1.3 e verificação anti-spoofing ativa no totem de entrada.
            </p>
          </div>

          {/* Seção 5 */}
          <div className="space-y-1">
            <h3 className="text-xs sm:text-sm font-bold text-slate-900">
              5. Direitos do Titular (Art. 18)
            </h3>
            <p>
              O aluno pode revogar o consentimento a qualquer momento solicitando ao tutor, resultando na exclusão definitiva do vetor biométrico da base de dados.
            </p>
          </div>

          {/* Seção 6 */}
          <div className="rounded-2xl border border-black/[0.05] bg-slate-50/80 p-3.5 text-2xs sm:text-xs text-slate-500">
            <p>
              <strong>Dúvidas ou solicitações:</strong> Fale com a coordenação ou com os tutores do AiLab Makers.
            </p>
          </div>
        </div>

        {/* Footer estilo Apple */}
        <div className="flex items-center justify-end border-t border-black/[0.05] bg-white/80 px-5 py-4 sm:px-6">
          <button
            onClick={onClose}
            className="w-full sm:w-auto rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-3 text-xs sm:text-sm font-bold text-white shadow-sm shadow-blue-500/25 hover:shadow-md hover:from-blue-700 hover:to-indigo-700 active:scale-98 transition-all cursor-pointer"
          >
            Entendido e Ciente
          </button>
        </div>
      </div>
    </div>
  );
}
