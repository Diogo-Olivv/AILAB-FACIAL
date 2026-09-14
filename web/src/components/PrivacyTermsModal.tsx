import { useEffect, useRef } from "react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function PrivacyTermsModal({ isOpen, onClose }: Props) {
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
      className="fixed inset-0 z-50 m-auto max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-3xl border border-line bg-white p-0 text-ink shadow-2xl backdrop:bg-ink/60 backdrop:backdrop-blur-xs animate-scale-up"
      aria-labelledby="terms-modal-title"
      aria-describedby="terms-modal-desc"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line bg-cream px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy text-white font-bold text-lg">
            ⚖️
          </div>
          <div>
            <h2 id="terms-modal-title" className="text-lg font-bold text-ink sm:text-xl">
              Termos de Uso e Privacidade Biométrica
            </h2>
            <p id="terms-modal-desc" className="text-xs font-semibold uppercase tracking-wider text-green">
              Conformidade LGPD (Lei nº 13.709/2018 - Art. 11)
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Fechar termos de privacidade"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-white text-muted transition-colors hover:bg-navy/5 hover:text-ink focus-visible:outline-2 focus-visible:outline-navy"
        >
          ✕
        </button>
      </div>

      {/* Body / Scrollable Content */}
      <div className="max-h-[68vh] overflow-y-auto px-6 py-6 space-y-5 text-sm text-muted leading-relaxed">
        {/* Seção 1 */}
        <div className="rounded-2xl border border-navy/10 bg-navy/[0.02] p-4">
          <h3 className="text-sm font-bold text-navy uppercase tracking-wider mb-1">
            1. Identificação do Controlador e Finalidade
          </h3>
          <p className="text-ink/80 text-xs sm:text-sm">
            O tratamento de biometria facial é operado exclusivamente pelo <strong>AILAB Makers (Maker Foundation)</strong> com a finalidade estrita de controle acadêmico de frequência e registro do tempo de permanência no laboratório. Os dados jamais serão utilizados para fins comerciais, publicitários ou de vigilância externa.
          </p>
        </div>

        {/* Seção 2 */}
        <div className="space-y-1.5">
          <h3 className="text-sm font-bold text-ink">
            2. Base Legal para Tratamento de Dados Sensíveis
          </h3>
          <p>
            Em estrita consonância com o <strong>Art. 11, inciso II, alínea "g" da LGPD</strong>, o tratamento biométrico facial ocorre para a garantia da prevenção à fraude e à segurança do titular nos processos de autenticação e identificação de presença presencial em instalações físicas protegidas.
          </p>
        </div>

        {/* Seção 3 */}
        <div className="space-y-1.5">
          <h3 className="text-sm font-bold text-ink">
            3. Ciclo de Vida: Descarte Imediato de Fotos e Uso de Vetores
          </h3>
          <p>
            O sistema <strong>NÃO ARMAZENA FOTOS BRUTAS OU IMAGENS DA CÂMERA</strong>. Ao capturar o rosto do integrante:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm text-ink/90">
            <li>A imagem é temporariamente mantida apenas na memória volátil (RAM) para inferência matemática da rede neural.</li>
            <li>Um vetor numérico unidirecional (embedding matemático normalizado) é gerado.</li>
            <li><strong>O frame da foto é imediatamente destruído e descartado da memória</strong>, tornando impossível a recuperação da foto original a partir do banco.</li>
          </ul>
        </div>

        {/* Seção 4 */}
        <div className="space-y-1.5">
          <h3 className="text-sm font-bold text-ink">
            4. Segurança, Criptografia e Isolamento (RLS)
          </h3>
          <p>
            A base de dados opera com políticas ativas de <em>Row Level Security (RLS)</em> forçadas no PostgreSQL, impedindo vazamentos anônimos de vetores. A comunicação entre totens e servidores utiliza criptografia TLS 1.3 de ponta a ponta com tokens de desafio temporal anti-injeção e modelos de detecção de vivacidade (PAD) contra falsificações (fotos impressas ou telas).
          </p>
        </div>

        {/* Seção 5 */}
        <div className="space-y-1.5">
          <h3 className="text-sm font-bold text-ink">
            5. Retenção e Direitos do Titular (Art. 18 e Art. 8º § 5º)
          </h3>
          <p>
            O titular tem pleno direito assegurado por lei a qualquer momento:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm text-ink/90">
            <li><strong>Revogação do Consentimento:</strong> Solicitar o encerramento da biometria facial a qualquer tempo.</li>
            <li><strong>Expurgo Definitivo:</strong> Com a revogação, o vetor biométrico é deletado permanentemente do banco de dados e o perfil inativado.</li>
            <li><strong>Confirmação e Transparência:</strong> Consultar seus registros de presença e histórico de permanência diretamente neste painel.</li>
          </ul>
        </div>

        {/* Seção 6 */}
        <div className="rounded-xl border border-line bg-cream/60 p-3.5 text-xs text-muted">
          <p>
            <strong>Dúvidas ou solicitação de exclusão:</strong> Procure um tutor responsável no laboratório AiLab ou contate a coordenação pelo e-mail institucional.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end border-t border-line bg-cream px-6 py-4">
        <button
          onClick={onClose}
          className="rounded-xl bg-navy px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-navy/90 active:scale-95 cursor-pointer"
        >
          Entendido e Ciente
        </button>
      </div>
    </dialog>
  );
}
