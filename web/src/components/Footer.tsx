interface FooterProps {
  lastRefreshed: Date;
  onOpenTerms: () => void;
}

export function Footer({ lastRefreshed, onOpenTerms }: FooterProps) {
  return (
    <footer
      className="border-t border-[#E5E2DC] dark:border-slate-800 bg-[#FAF9F5]/80 dark:bg-slate-900/80 backdrop-blur-xl px-4 py-5 text-xs text-[#57534E] dark:text-slate-300 transition-colors sm:px-8 mt-14"
      role="contentinfo"
    >
      <div className="mx-auto max-w-6xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Status de Sincronização Dinâmico Estilo Perplexity */}
          <div
            className="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 text-2xs font-mono-data font-medium text-emerald-800 dark:text-emerald-300 shadow-2xs"
            aria-live="polite"
            aria-atomic="true"
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 animate-pulse" />
            <span>
              Sincronizado às <strong className="font-semibold text-emerald-900 dark:text-emerald-200">{lastRefreshed.toLocaleTimeString("pt-BR")}</strong> · Tempo real ativo
            </span>
          </div>

          {/* Link Rápido de Privacidade */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onOpenTerms}
              className="text-xs font-medium text-[#57534E] dark:text-slate-300 hover:text-[#C15F3D] dark:hover:text-[#E8590C] transition-colors cursor-pointer"
            >
              Privacidade & LGPD
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E5E2DC]/60 dark:border-slate-800/60 pt-3 text-[11px] text-[#57534E] dark:text-slate-300">
          <p>
            © {new Date().getFullYear()} AILAB Makers · Controle de Frequência & Permanência Acadêmica
          </p>
          <p className="flex items-center gap-2 font-mono-data text-[10.5px]">
            <span>Acessibilidade WCAG 2.2 AA</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
