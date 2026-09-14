import { Link } from "react-router-dom";
import logo from "../ailab_makers.jpeg";

interface HeaderProps {
  user: any;
  signOut: () => Promise<void>;
  onOpenTerms: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  presentCount: number;
}

export function Header({
  user,
  signOut,
  onOpenTerms,
  onRefresh,
  isRefreshing,
  presentCount,
}: HeaderProps) {
  return (
    <header
      className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-4 border-b border-line bg-card/95 px-4 py-3.5 backdrop-blur-md transition-all sm:px-8"
      role="banner"
    >
      {/* Marca e Identidade */}
      <div className="flex items-center gap-3">
        <img
          src={logo}
          alt="AiLab Makers Foundation Logo"
          className="h-11 w-11 sm:h-12 sm:w-12 rounded-2xl border border-line/60 object-cover shadow-2xs"
        />
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-xl font-extrabold tracking-tight text-ink">
              Tempo de permanência
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green/15 px-2.5 py-0.5 text-xs font-bold text-green">
              <span className="h-2 w-2 rounded-full bg-green animate-pulse" />
              {presentCount} ao vivo
            </span>
          </div>
          <p className="text-xs text-muted leading-none hidden sm:block mt-0.5">
            AiLab Makers · Painel de Frequência do Laboratório
          </p>
        </div>
      </div>

      {/* Ações: Atualizar, Termos LGPD e Acesso Tutor */}
      <div className="flex items-center gap-2">
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center gap-1.5 rounded-xl border border-navy/15 bg-card px-3.5 py-2 text-xs sm:text-sm font-semibold text-navy shadow-2xs transition-all hover:bg-navy/5 active:scale-95 disabled:opacity-60 cursor-pointer min-h-[44px]"
          title="Atualizar dados de permanência agora"
        >
          <svg
            className={`h-4 w-4 transition-transform ${isRefreshing ? "animate-spin text-green" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          <span className="hidden sm:inline">
            {isRefreshing ? "Atualizando..." : "Atualizar"}
          </span>
        </button>

        <button
          onClick={onOpenTerms}
          className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-3.5 py-2 text-xs sm:text-sm font-semibold text-ink shadow-2xs transition-all hover:bg-navy/5 active:scale-95 cursor-pointer min-h-[44px]"
          title="Políticas de Privacidade Biométrica (LGPD Art. 11)"
        >
          <span>⚖️</span>
          <span className="hidden sm:inline">Termos LGPD</span>
          <span className="sm:hidden">Termos</span>
        </button>

        {user ? (
          <button
            onClick={signOut}
            className="rounded-xl border border-warn/25 bg-warn/10 px-3.5 py-2 text-xs sm:text-sm font-bold text-warn shadow-2xs transition-all hover:bg-warn/20 active:scale-95 cursor-pointer min-h-[44px]"
            title="Encerrar sessão de tutor"
          >
            Sair ({user.email?.split("@")[0]})
          </button>
        ) : (
          <Link
            to="/login"
            className="rounded-xl border border-line bg-navy/10 px-3.5 py-2 text-xs sm:text-sm font-bold text-navy shadow-2xs transition-all hover:bg-navy/20 active:scale-95 inline-flex items-center min-h-[44px]"
            title="Área administrativa de tutores e coordenadores"
          >
            Acesso Tutor
          </Link>
        )}
      </div>
    </header>
  );
}
