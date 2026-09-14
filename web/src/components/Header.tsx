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
      className="sticky top-0 z-30 border-b border-line/80 bg-card/95 px-3 py-2.5 backdrop-blur-md transition-all sm:px-8 sm:py-3.5 shadow-2xs"
      role="banner"
    >
      <div className="mx-auto max-w-6xl flex flex-wrap items-center justify-between gap-2.5 sm:gap-4">
        {/* Marca e Identidade */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <img
            src={logo}
            alt="AiLab Makers Foundation Logo"
            className="h-9 w-9 sm:h-11 sm:w-11 rounded-xl sm:rounded-2xl border border-line/60 object-cover shadow-2xs"
          />
          <div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h1 className="text-sm sm:text-lg font-extrabold tracking-tight text-ink leading-tight">
                Tempo de permanência
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-green/15 px-2 py-0.5 text-2xs sm:text-xs font-bold text-green ring-1 ring-green/20">
                <span className="h-1.5 w-1.5 rounded-full bg-green animate-pulse" />
                {presentCount} ao vivo
              </span>
            </div>
            <p className="text-2xs sm:text-xs text-muted leading-none hidden sm:block mt-0.5">
              AiLab Makers · Painel de Frequência do Laboratório
            </p>
          </div>
        </div>

        {/* Ações: Atualizar, Termos LGPD e Acesso Tutor */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center justify-center rounded-xl border border-line/80 bg-white p-2 sm:px-3 sm:py-1.5 text-xs font-semibold text-navy shadow-2xs transition-all hover:bg-navy/5 active:scale-95 disabled:opacity-60 cursor-pointer min-h-[36px] sm:min-h-[40px]"
            title="Atualizar dados de permanência agora"
            aria-label="Atualizar dados de permanência agora"
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
            <span className="hidden sm:inline ml-1.5">
              {isRefreshing ? "Atualizando..." : "Atualizar"}
            </span>
          </button>

          <button
            onClick={onOpenTerms}
            className="inline-flex items-center gap-1 rounded-xl border border-line/80 bg-white px-2.5 py-1.5 sm:px-3 sm:py-1.5 text-xs font-semibold text-ink shadow-2xs transition-all hover:bg-navy/5 active:scale-95 cursor-pointer min-h-[36px] sm:min-h-[40px]"
            title="Políticas de Privacidade Biométrica (LGPD Art. 11)"
          >
            <span className="text-xs">⚖️</span>
            <span>Termos</span>
          </button>

          {user ? (
            <button
              onClick={signOut}
              className="rounded-xl border border-warn/25 bg-warn/10 px-2.5 py-1.5 sm:px-3 sm:py-1.5 text-xs font-bold text-warn shadow-2xs transition-all hover:bg-warn/20 active:scale-95 cursor-pointer min-h-[36px] sm:min-h-[40px]"
              title="Encerrar sessão de tutor"
            >
              Sair
            </button>
          ) : (
            <Link
              to="/login"
              className="rounded-xl border border-navy/20 bg-navy/10 px-2.5 py-1.5 sm:px-3 sm:py-1.5 text-xs font-bold text-navy shadow-2xs transition-all hover:bg-navy/20 active:scale-95 inline-flex items-center min-h-[36px] sm:min-h-[40px]"
              title="Área administrativa de tutores e coordenadores"
            >
              Acesso Tutor
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
