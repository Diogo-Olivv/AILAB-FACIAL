import { Link } from "react-router-dom";

interface FooterProps {
  lastRefreshed: Date;
  onOpenTerms: () => void;
}

export function Footer({ lastRefreshed, onOpenTerms }: FooterProps) {
  return (
    <footer
      className="border-t border-[#E5E2DC] bg-[#FAF9F5]/80 backdrop-blur-xl px-4 py-5 text-xs text-[#706E6A] transition-colors sm:px-8 mt-14"
      role="contentinfo"
    >
      <div className="mx-auto max-w-6xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Status de Sincronização Dinâmico Estilo Perplexity */}
          <div
            className="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50 px-3 py-1 text-2xs font-mono-data font-medium text-emerald-800 shadow-2xs"
            aria-live="polite"
            aria-atomic="true"
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
            <span>
              Sincronizado às <strong className="font-semibold text-emerald-900">{lastRefreshed.toLocaleTimeString("pt-BR")}</strong> · Tempo real ativo
            </span>
          </div>

          {/* Links Rápidos em Pílulas */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onOpenTerms}
              className="text-xs font-medium text-[#706E6A] hover:text-[#C15F3D] transition-colors cursor-pointer"
            >
              Privacidade & LGPD
            </button>

            <span className="text-[#E5E2DC]">·</span>

            <Link
              to="/login"
              className="inline-flex items-center rounded-full border border-[#E5E2DC] bg-white px-3.5 py-1 text-2xs font-sans font-medium text-[#171715] shadow-2xs hover:bg-[#FAF9F5] hover:border-[#C15F3D]/40 transition-all"
            >
              Portal do Tutor →
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E5E2DC]/60 pt-3 text-[11px] text-[#706E6A]">
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
