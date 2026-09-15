import { Link } from "react-router-dom";
import logo from "../ailab_makers.jpeg";

interface HeaderProps {
  user: any;
  signOut: () => Promise<void>;
  onOpenTerms: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  presentCount?: number;
}

export function Header({
  user,
  signOut,
  onOpenTerms,
  onRefresh,
  isRefreshing,
}: HeaderProps) {
  return (
    <header
      className="sticky top-0 z-30 border-b border-black/[0.05] bg-white/80 px-3 py-2.5 backdrop-blur-2xl transition-all sm:px-8 sm:py-3.5 shadow-[0_2px_16px_rgba(0,0,0,0.03)]"
      role="banner"
    >
      <div className="mx-auto max-w-6xl flex flex-wrap items-center justify-between gap-2.5 sm:gap-4">
        {/* Marca e Identidade */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <img
            src={logo}
            alt="AiLab Makers Foundation Logo"
            className="h-9 w-9 sm:h-11 sm:w-11 rounded-2xl border border-white/80 object-cover shadow-2xs"
          />
          <div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h1 className="text-sm sm:text-lg font-extrabold tracking-tight text-ink leading-tight">
                Tempo de permanência
              </h1>
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
            className="liquid-glass-button inline-flex items-center justify-center rounded-xl px-3 py-2 text-xs font-semibold text-ink cursor-pointer min-h-[44px] min-w-[44px] disabled:opacity-60"
            title="Atualizar dados de permanência agora"
            aria-label="Atualizar dados de permanência agora"
          >
            <svg
              className={`h-4 w-4 transition-transform ${isRefreshing ? "animate-spin text-emerald-600" : "text-muted"}`}
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
            className="liquid-glass-button inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-ink cursor-pointer min-h-[44px]"
            title="Políticas de Privacidade Biométrica (LGPD Art. 11)"
          >
            <span className="text-xs">⚖️</span>
            <span>Termos</span>
          </button>

          {user ? (
            <button
              onClick={signOut}
              className="liquid-glass-button inline-flex items-center justify-center rounded-xl px-3.5 py-2 text-xs font-bold text-warn border-warn/20 hover:border-warn/40 hover:bg-warn/10 cursor-pointer min-h-[44px]"
              title="Encerrar sessão de tutor"
            >
              Sair
            </button>
          ) : (
            <Link
              to="/login"
              className="liquid-glass-button inline-flex items-center justify-center rounded-xl px-3.5 py-2 text-xs font-bold text-navy border-navy/20 hover:border-navy/40 hover:bg-navy/10 min-h-[44px]"
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
