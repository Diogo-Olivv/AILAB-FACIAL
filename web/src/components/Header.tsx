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
      className="sticky top-0 z-30 border-b border-stone-200/70 bg-white/85 px-3.5 py-3 backdrop-blur-2xl transition-all sm:px-8 sm:py-3.5 shadow-[0_2px_16px_rgba(23,23,21,0.02)]"
      role="banner"
    >
      <div className="mx-auto max-w-6xl flex flex-wrap items-center justify-between gap-3">
        {/* Marca com Tipografia Editorial Claude */}
        <div className="flex items-center gap-3">
          <img
            src={logo}
            alt="AiLab Makers Logo"
            className="h-9 w-9 sm:h-11 sm:w-11 rounded-2xl border border-stone-200/80 object-cover shadow-claude ring-1 ring-black/5"
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-editorial text-base sm:text-xl font-semibold tracking-tight text-slate-900 leading-none">
                AiLab Makers
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 text-[10px] font-bold text-emerald-800 tracking-wider uppercase font-mono-data">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>ao vivo</span>
              </span>
            </div>
            <p className="text-2xs sm:text-xs text-stone-500 font-medium leading-none mt-1">
              Controle Acadêmico de Permanência
            </p>
          </div>
        </div>

        {/* Ações Rápidas estilo Perplexity / Claude Pills */}
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center justify-center rounded-2xl border border-stone-200/80 bg-white/90 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:border-stone-300 shadow-claude transition-all cursor-pointer min-h-[40px] disabled:opacity-50"
            title="Atualizar dados de permanência agora"
            aria-label="Atualizar dados de permanência agora"
          >
            <svg
              className={`h-3.5 w-3.5 transition-transform ${isRefreshing ? "animate-spin text-teal-600" : "text-stone-400"}`}
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
            <span className="hidden sm:inline ml-1.5 font-medium">
              {isRefreshing ? "Sincronizando..." : "Atualizar"}
            </span>
          </button>

          <button
            onClick={onOpenTerms}
            className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-stone-200/80 bg-white/90 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:border-stone-300 shadow-claude transition-all cursor-pointer min-h-[40px]"
            title="Políticas de Privacidade Biométrica (LGPD Art. 11)"
          >
            <span className="text-xs">⚖️</span>
            <span className="font-medium">Termos LGPD</span>
          </button>

          {user ? (
            <button
              onClick={signOut}
              className="inline-flex items-center justify-center rounded-2xl border border-rose-200/80 bg-rose-50/70 px-4 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 hover:border-rose-300 transition-all cursor-pointer min-h-[40px]"
              title="Encerrar sessão de tutor"
            >
              Sair
            </button>
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 px-4 py-2 text-xs font-bold text-white shadow-sm hover:from-black hover:to-slate-900 active:scale-98 transition-all min-h-[40px]"
              title="Área administrativa de tutores e coordenadores"
            >
              <span>🎓</span>
              <span>Acesso Tutor</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
