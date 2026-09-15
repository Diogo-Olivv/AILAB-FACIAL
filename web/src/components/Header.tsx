import { Link } from "react-router-dom";
import logo from "../ailab_makers.jpeg";
import { useTheme } from "../lib/useTheme";

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
  const { isDark, toggleTheme } = useTheme();

  return (
    <header
      className="sticky top-0 z-30 border-b border-stone-200/70 dark:border-slate-800/80 bg-white/85 dark:bg-slate-950/85 px-3.5 py-3 backdrop-blur-2xl transition-all sm:px-8 sm:py-3.5 shadow-[0_2px_16px_rgba(23,23,21,0.02)]"
      role="banner"
    >
      <div className="mx-auto max-w-6xl flex flex-wrap items-center justify-between gap-3">
        {/* Marca com Tipografia Editorial Claude e Acento Gradiente */}
        <div className="flex items-center gap-3">
          <div className="relative group">
            <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-tr from-[#C15F3D] to-teal-500 opacity-30 group-hover:opacity-60 blur-xs transition duration-300" />
            <img
              src={logo}
              alt="AiLab Makers Logo"
              className="relative h-10 w-10 sm:h-12 sm:w-12 rounded-2xl border border-[#E5E2DC] dark:border-slate-700 object-cover shadow-2xs"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-editorial text-lg sm:text-2xl font-bold tracking-tight text-[#171715] dark:text-slate-50 leading-tight">
                AiLab Makers
              </span>
              <span className="hidden md:inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/60 px-2 py-0.5 text-[10px] font-mono-data font-semibold text-emerald-800 dark:text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Totem Ativo
              </span>
            </div>
            <p className="text-[10px] sm:text-xs text-[#706E6A] dark:text-slate-400 font-sans font-medium tracking-normal mt-0.5">
              Controle Acadêmico de Permanência
            </p>
          </div>
        </div>

        {/* Ações Rápidas com Toggle de Tema Escuro */}
        <div className="flex items-center gap-2">
          {/* Botão de Alternância de Tema Claro / Escuro */}
          <button
            onClick={toggleTheme}
            className="inline-flex items-center justify-center rounded-2xl border border-stone-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-[#C15F3D] dark:hover:text-amber-400 hover:border-amber-300 dark:hover:border-amber-500/50 shadow-claude transition-all cursor-pointer min-h-[40px]"
            title={isDark ? "Mudar para Modo Claro" : "Mudar para Modo Escuro"}
            aria-label={isDark ? "Mudar para Modo Claro" : "Mudar para Modo Escuro"}
          >
            <span className="text-sm leading-none">{isDark ? "☀️" : "🌙"}</span>
            <span className="hidden lg:inline ml-1.5 text-2xs font-medium">
              {isDark ? "Claro" : "Escuro"}
            </span>
          </button>

          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center justify-center rounded-2xl border border-stone-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:border-stone-300 dark:hover:border-slate-700 shadow-claude transition-all cursor-pointer min-h-[40px] disabled:opacity-50"
            title="Atualizar dados de permanência agora"
            aria-label="Atualizar dados de permanência agora"
          >
            <svg
              className={`h-3.5 w-3.5 transition-transform ${isRefreshing ? "animate-spin text-teal-600 dark:text-teal-400" : "text-stone-400 dark:text-slate-500"}`}
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
            className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-stone-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:border-stone-300 dark:hover:border-slate-700 shadow-claude transition-all cursor-pointer min-h-[40px]"
            title="Políticas de Privacidade Biométrica (LGPD Art. 11)"
          >
            <span className="text-xs">⚖️</span>
            <span className="font-medium hidden sm:inline">Termos LGPD</span>
          </button>

          {user ? (
            <button
              onClick={signOut}
              className="inline-flex items-center justify-center rounded-2xl border border-rose-200/80 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/40 px-4 py-2 text-xs font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-all cursor-pointer min-h-[40px]"
              title="Encerrar sessão de tutor"
            >
              Sair
            </button>
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 dark:from-stone-100 dark:to-white px-4 py-2 text-xs font-bold text-white dark:text-slate-900 shadow-sm hover:from-black hover:to-slate-900 dark:hover:from-white dark:hover:to-stone-200 active:scale-98 transition-all min-h-[40px]"
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
