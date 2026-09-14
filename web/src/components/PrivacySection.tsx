interface PrivacySectionProps {
  onOpenFullTerms: () => void;
}

export function PrivacySection({ onOpenFullTerms }: PrivacySectionProps) {
  return (
    <section
      aria-labelledby="privacy-section-title"
      className="rounded-3xl border border-line bg-card/60 p-6 sm:p-10 space-y-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div className="space-y-1">
          <span className="rounded-full bg-green/15 px-2.5 py-0.5 text-xs font-bold text-green">
            Transparência & Conformidade
          </span>
          <h2 id="privacy-section-title" className="text-xl sm:text-2xl font-extrabold text-ink">
            Privacidade Biométrica e Proteção de Dados (LGPD Art. 11)
          </h2>
          <p className="text-xs sm:text-sm text-muted">
            Entenda como seus dados são protegidos segundo as melhores práticas de privacidade por design.
          </p>
        </div>

        <button
          onClick={onOpenFullTerms}
          className="inline-flex items-center gap-2 rounded-xl border border-navy/20 bg-white px-4 py-2.5 text-xs sm:text-sm font-bold text-navy shadow-2xs hover:bg-navy/5 active:scale-95 cursor-pointer min-h-[44px]"
        >
          <span>📜</span>
          <span>Ler Termos Completos</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Memória Volátil */}
        <div className="rounded-2xl border border-line bg-white/80 p-5 space-y-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy/10 text-xl">
            ⚡
          </div>
          <h3 className="text-sm font-extrabold text-ink">
            Descarte Imediato dos Frames
          </h3>
          <p className="text-xs text-muted leading-relaxed">
            As imagens da câmera são mantidas apenas na memória RAM enquanto o vetor de 512 números é extraído.
            Nenhum frame fotográfico é salvo em disco ou banco de dados.
          </p>
        </div>

        {/* Card 2: Isolamento de Embeddings */}
        <div className="rounded-2xl border border-line bg-white/80 p-5 space-y-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green/10 text-xl">
            🔒
          </div>
          <h3 className="text-sm font-extrabold text-ink">
            Isolamento Criptográfico & RLS
          </h3>
          <p className="text-xs text-muted leading-relaxed">
            A tabela de representações vetoriais é protegida por Row-Level Security restrito à
            chave de serviço do backend. Visitantes e navegadores não têm acesso aos vetores.
          </p>
        </div>

        {/* Card 3: Revogação e Direitos */}
        <div className="rounded-2xl border border-line bg-white/80 p-5 space-y-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/20 text-xl">
            ⚖️
          </div>
          <h3 className="text-sm font-extrabold text-ink">
            Finalidade Estrita e Revogação
          </h3>
          <p className="text-xs text-muted leading-relaxed">
            Uso exclusivamente acadêmico para acompanhamento de presença. O titular pode revogar seu
            consentimento ou solicitar exclusão definitiva do perfil a qualquer momento junto ao tutor.
          </p>
        </div>
      </div>
    </section>
  );
}
