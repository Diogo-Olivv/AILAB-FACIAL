import { Link } from "react-router-dom";

interface FooterProps {
  lastRefreshed: Date;
  onOpenTerms: () => void;
  onOpenHowItWorks: () => void;
}

export function Footer({ lastRefreshed, onOpenTerms, onOpenHowItWorks }: FooterProps) {
  return (
    <footer
      className="border-t border-line/80 bg-card/40 px-4 py-8 text-xs text-muted transition-colors sm:px-8"
      role="contentinfo"
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Status de Sincronização Dinâmico */}
          <div
            className="flex items-center gap-2"
            aria-live="polite"
            aria-atomic="true"
          >
            <span className="inline-block h-2 w-2 rounded-full bg-green animate-pulse" />
            <span>
              Sincronizado às <strong>{lastRefreshed.toLocaleTimeString("pt-BR")}</strong> (atualização automática ativa)
            </span>
          </div>

          {/* Links Úteis */}
          <div className="flex flex-wrap items-center gap-4 font-semibold">
            <button
              onClick={onOpenHowItWorks}
              className="hover:text-navy hover:underline cursor-pointer"
            >
              Arquitetura ArcFace 512-D
            </button>

            <button
              onClick={onOpenTerms}
              className="hover:text-navy hover:underline cursor-pointer"
            >
              Política de Privacidade (LGPD Art. 11)
            </button>

            <Link
              to="/login"
              className="hover:text-navy hover:underline"
            >
              Portal do Tutor
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line/50 pt-4 text-[11px]">
          <p>
            © {new Date().getFullYear()} AILAB Makers · Laboratório de Inovação & IA. Desenvolvido para extensão acadêmica.
          </p>
          <p className="flex items-center gap-2">
            <span>Acessibilidade WCAG 2.2 AA</span>
            <span>·</span>
            <span>InsightFace ONNX CPU</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
