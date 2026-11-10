import { ShieldCheck, Cpu } from "lucide-react";

interface FooterProps {
  lastRefreshed: Date;
  onOpenTerms: () => void;
  onOpenHowItWorks?: () => void;
}

export function Footer({ lastRefreshed, onOpenTerms, onOpenHowItWorks }: FooterProps) {
  return (
    <footer
      className="mt-16 border-t border-slate-200/80 dark:border-white/[0.07] bg-white/70 dark:bg-[#0F1623]/75 backdrop-blur-xl px-4 py-6 text-xs text-slate-500 dark:text-slate-400 transition-colors sm:px-6 lg:px-8"
      role="contentinfo"
    >
      <div className="mx-auto max-w-7xl flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div
            className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/20 px-3 py-1 text-2xs font-medium text-emerald-800 dark:text-emerald-300"
            aria-live="polite"
            aria-atomic="true"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span>
              Sincronizado às{" "}
              <strong className="font-mono-data tabular-nums font-bold text-emerald-900 dark:text-emerald-200">
                {lastRefreshed.toLocaleTimeString("pt-BR")}
              </strong>
              <span className="hidden sm:inline"> · Tempo real ativo</span>
            </span>
          </div>
          <p className="text-2xs text-slate-500 dark:text-slate-400">
            © <span className="tabular-nums">{new Date().getFullYear()}</span> AILAB Makers · Controle Acadêmico de Frequência & Permanência
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-2xs">
          {onOpenHowItWorks && (
            <button
              type="button"
              onClick={onOpenHowItWorks}
              className="inline-flex min-h-[44px] sm:min-h-[32px] items-center gap-1.5 px-2 font-semibold text-slate-600 dark:text-slate-300 hover:text-orange-600 dark:hover:text-amber-400 transition-colors cursor-pointer"
            >
              <Cpu className="h-3.5 w-3.5 text-orange-500 dark:text-amber-400" />
              <span>Arquitetura IA</span>
            </button>
          )}
          <button
            type="button"
            onClick={onOpenTerms}
            className="inline-flex min-h-[44px] sm:min-h-[32px] items-center gap-1.5 px-2 font-semibold text-slate-600 dark:text-slate-300 hover:text-orange-600 dark:hover:text-amber-400 transition-colors cursor-pointer"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Privacidade & LGPD</span>
          </button>
          <span className="hidden md:inline text-slate-400 dark:text-slate-500 font-mono-data">
            WCAG 2.2 AA
          </span>
        </div>
      </div>
    </footer>
  );
}
