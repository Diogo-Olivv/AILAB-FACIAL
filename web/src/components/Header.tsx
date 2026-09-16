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
  onOpenTutorProfile?: () => void;
}

export function Header({
  user,
  signOut,
  onOpenTerms,
  onRefresh,
  isRefreshing,
  onOpenTutorProfile,
}: HeaderProps) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <header
      className="sticky top-0 z-30 border-b border-stone-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-950/90 backdrop-blur-2xl transition-all shadow-[0_2px_16px_rgba(23,23,21,0.03)]"
      role="banner"
    >
      <div className="mx-auto max-w-6xl px-3.5 py-3 sm:px-8 sm:py-3.5 flex flex-wrap items-center justify-between gap-3">
        {/* Marca com Tipografia Editorial Claude e Acento Gradiente */}
        <div className="flex items-center gap-3">
          <div className="relative group">
            <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-tr from-[#C15F3D] via-[#009E90] to-emerald-500 opacity-40 group-hover:opacity-75 blur-xs transition duration-300" />
            <img
              src={logo}
              alt="AiLab Makers Logo"
              className="relative h-10 w-10 sm:h-12 sm:w-12 rounded-2xl border border-stone-200 dark:border-slate-700 object-cover shadow-2xs"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-editorial text-lg sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 leading-tight">
                AiLab Makers
              </span>
            </div>
            <p className="text-[10.5px] sm:text-xs text-stone-500 dark:text-slate-400 font-sans font-medium tracking-normal mt-0.5">
              Controle Acadêmico de Permanência
            </p>
          </div>
        </div>

        {/* Ações Rápidas com Toggle de Tema */}
        <div className="flex items-center gap-2">
          {/* Botão de Alternância de Tema com Rótulo Explícito */}
          <button
            onClick={toggleTheme}
            className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-stone-300/80 dark:border-slate-700 bg-stone-100/80 dark:bg-slate-900 px-3.5 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 hover:border-[#C15F3D] hover:text-[#C15F3D] dark:hover:border-amber-400 dark:hover:text-amber-300 shadow-xs transition-all cursor-pointer min-h-[40px]"
            title={isDark ? "Mudar para Modo Claro" : "Mudar para Modo Escuro"}
            aria-label={isDark ? "Mudar para Modo Claro" : "Mudar para Modo Escuro"}
          >
            <span className="text-sm leading-none">{isDark ? "☀️" : "🌙"}</span>
            <span className="hidden sm:inline font-semibold">
              {isDark ? "Modo Claro" : "Modo Escuro"}
            </span>
          </button>

          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-stone-300/80 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:border-stone-400 dark:hover:border-slate-600 shadow-xs transition-all cursor-pointer min-h-[40px] disabled:opacity-50"
            title="Atualizar dados de permanência agora"
            aria-label="Atualizar dados de permanência agora"
          >
            <svg
              className={`h-3.5 w-3.5 transition-transform ${isRefreshing ? "animate-spin text-teal-600 dark:text-teal-400" : "text-stone-500 dark:text-slate-400"}`}
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
            <span className="hidden sm:inline font-medium">
              {isRefreshing ? "Sincronizando..." : "Atualizar"}
            </span>
          </button>

          <button
            onClick={onOpenTerms}
            className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-stone-300/80 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:border-stone-400 dark:hover:border-slate-600 shadow-xs transition-all cursor-pointer min-h-[40px]"
            title="Políticas de Privacidade Biométrica (LGPD Art. 11)"
          >
            <span className="text-xs">⚖️</span>
            <span className="font-medium hidden sm:inline">Termos LGPD</span>
          </button>

          {user ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onOpenTutorProfile}
                className="inline-flex items-center gap-2 rounded-2xl border border-stone-300/80 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:border-stone-400 dark:hover:border-slate-600 shadow-xs transition-all cursor-pointer min-h-[40px]"
                title="Configurar Perfil e Foto do Tutor"
              >
                {user.user_metadata?.avatar_url ? (
                  <img
                    src={user.user_metadata.avatar_url}
                    alt="Foto do Tutor"
                    className="h-6 w-6 rounded-full object-cover ring-1.5 ring-[#C15F3D]/40 shadow-2xs"
                  />
                ) : (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#FAF5F0] dark:bg-amber-950/60 text-[#C15F3D] dark:text-amber-400 text-xs font-bold border border-[#F0DCD3] dark:border-amber-800/40 shadow-2xs">
                    🎓
                  </span>
                )}
                <span className="hidden sm:inline font-medium max-w-[110px] truncate">
                  {user.user_metadata?.name || user.email?.split("@")[0] || "Tutor"}
                </span>
              </button>

              <button
                onClick={signOut}
                className="inline-flex items-center justify-center rounded-2xl border border-rose-300 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 px-3.5 py-2 text-xs font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 shadow-xs transition-all cursor-pointer min-h-[40px]"
                title="Encerrar sessão de tutor"
              >
                Sair
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-[#C15F3D] to-orange-600 hover:from-[#A84828] hover:to-orange-700 text-white font-bold px-4 py-2 text-xs shadow-sm shadow-orange-500/25 active:scale-98 transition-all min-h-[40px]"
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
