import { Link } from "react-router-dom";

interface FooterProps {
  lastRefreshed: Date;
  onOpenTerms: () => void;
}

export function Footer({ lastRefreshed, onOpenTerms }: FooterProps) {
  return (
    <footer
      className="border-t border-black/[0.06] bg-white/60 backdrop-blur-xl px-4 py-5 text-xs text-slate-600 transition-colors sm:px-8 mt-14"
      role="contentinfo"
    >
      <div className="mx-auto max-w-6xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Status de Sincronização Dinâmico Estilo Apple */}
          <div
            className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-2xs font-semibold text-emerald-800 shadow-2xs"
            aria-live="polite"
            aria-atomic="true"
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>
              Sincronizado às <strong>{lastRefreshed.toLocaleTimeString("pt-BR")}</strong> · Tempo real ativo
            </span>
          </div>

          {/* Links Rápidos em Pílulas */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onOpenTerms}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
            >
              Privacidade & LGPD
            </button>

            <span className="text-slate-300">·</span>

            <Link
              to="/login"
              className="liquid-glass-button inline-flex items-center rounded-xl border border-black/10 bg-white/80 px-3 py-1 text-2xs font-bold text-slate-800 shadow-2xs hover:bg-white transition-all"
            >
              Portal do Tutor →
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-black/[0.04] pt-3 text-[11px] text-slate-600">
          <p>
            © {new Date().getFullYear()} AILAB Makers · Controle de Frequência & Permanência Acadêmica
          </p>
          <p className="flex items-center gap-2">
            <span>Acessibilidade WCAG 2.2 AA</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
