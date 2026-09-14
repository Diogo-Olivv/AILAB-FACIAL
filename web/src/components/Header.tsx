import { Link } from "react-router-dom";
import logo from "../ailab_makers.jpeg";

interface HeaderProps {
  user: any;
  signOut: () => Promise<void>;
  onOpenTerms: () => void;
  onOpenHowItWorks: () => void;
  activeSection: "analysis" | "dashboard";
  onSelectSection: (section: "analysis" | "dashboard") => void;
}

export function Header({
  user,
  signOut,
  onOpenTerms,
  onOpenHowItWorks,
  activeSection,
  onSelectSection,
}: HeaderProps) {
  return (
    <header
      className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-4 border-b border-line bg-card/90 px-4 py-3.5 backdrop-blur-md transition-all sm:px-8"
      role="banner"
    >
      {/* Marca e Identidade */}
      <div className="flex items-center gap-3">
        <img
          src={logo}
          alt="AiLab Makers Foundation Logo"
          className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl border border-line/60 object-cover shadow-2xs"
        />
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base sm:text-lg font-extrabold tracking-tight text-ink">
              AILAB Facial
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-green/15 px-2 py-0.5 text-[11px] font-bold text-green">
              <span className="h-1.5 w-1.5 rounded-full bg-green animate-pulse" />
              IA Ativa
            </span>
          </div>
          <p className="text-[11px] text-muted leading-none hidden sm:block">
            Laboratório Maker · Biometria & Presença Acadêmica
          </p>
        </div>
      </div>

      {/* Navegação Rápida entre Modos */}
      <nav
        aria-label="Navegação Principal da Aplicação"
        className="flex items-center gap-1.5 rounded-xl border border-line/70 bg-cream/70 p-1"
      >
        <button
          onClick={() => onSelectSection("analysis")}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeSection === "analysis"
              ? "bg-navy text-white shadow-xs"
              : "text-ink/80 hover:text-ink hover:bg-navy/5"
          }`}
          aria-current={activeSection === "analysis" ? "page" : undefined}
        >
          <span>🔬</span>
          <span>Análise Facial IA</span>
        </button>

        <button
          onClick={() => onSelectSection("dashboard")}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeSection === "dashboard"
              ? "bg-navy text-white shadow-xs"
              : "text-ink/80 hover:text-ink hover:bg-navy/5"
          }`}
          aria-current={activeSection === "dashboard" ? "page" : undefined}
        >
          <span>📊</span>
          <span>Painel de Horas</span>
        </button>
      </nav>

      {/* Ações Secundárias e Acesso Tutor */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenHowItWorks}
          className="hidden md:inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink shadow-2xs transition-all hover:bg-navy/5 cursor-pointer"
          title="Entenda como funciona o modelo ArcFace e a inferência"
        >
          <span>💡</span>
          <span>Como Funciona</span>
        </button>

        <button
          onClick={onOpenTerms}
          className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink shadow-2xs transition-all hover:bg-navy/5 cursor-pointer"
          title="Políticas de Privacidade Biométrica (LGPD Art. 11)"
        >
          <span>⚖️</span>
          <span className="hidden sm:inline">Termos & LGPD</span>
          <span className="sm:hidden">LGPD</span>
        </button>

        {user ? (
          <button
            onClick={signOut}
            className="rounded-xl border border-warn/25 bg-warn/10 px-3 py-1.5 text-xs font-bold text-warn shadow-2xs transition-all hover:bg-warn/20 cursor-pointer"
            title="Encerrar sessão de tutor"
          >
            Sair ({user.email?.split("@")[0]})
          </button>
        ) : (
          <Link
            to="/login"
            className="rounded-xl border border-line bg-navy/10 px-3 py-1.5 text-xs font-bold text-navy shadow-2xs transition-all hover:bg-navy/20"
            title="Área administrativa de tutores e coordenadores"
          >
            Acesso Tutor
          </Link>
        )}
      </div>
    </header>
  );
}
