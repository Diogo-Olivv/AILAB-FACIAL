import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { KeyRound, Lock, AlertCircle, Eye, EyeOff, SunMedium, MoonStar } from "lucide-react";
import { useAuth } from "../auth/useAuth";
import { useTheme } from "../lib/useTheme";
import logo from "../ailab_makers.jpeg";

const VALID_PASSWORDS = ["presenca_makers", "presenca"];
const ACCESS_STORAGE_KEY = "ailab_site_access_granted";

interface Props {
  children: ReactNode;
}

export function SiteAccessGate({ children }: Props) {
  const { user } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [hasAccess, setHasAccess] = useState<boolean>(() => {
    try {
      return localStorage.getItem(ACCESS_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  if (user || hasAccess) {
    return <>{children}</>;
  }

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPass = password.trim().toLowerCase();
    if (VALID_PASSWORDS.includes(cleanPass)) {
      try {
        localStorage.setItem(ACCESS_STORAGE_KEY, "true");
      } catch {
        // Ignora erro
      }
      setHasAccess(true);
      setError("");
    } else {
      setError("Senha de presença incorreta. Tente novamente.");
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col justify-between selection:bg-orange-500/20 bg-transparent text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* Header Fixo */}
      <header className="sticky top-0 z-40 h-16 border-b border-slate-200/90 dark:border-white/[0.1] bg-white/85 dark:bg-[#0F1623]/80 backdrop-blur-xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl h-full flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={logo}
              alt="AILAB Makers"
              className="w-9 h-9 rounded-lg object-cover ring-1 ring-black/10 dark:ring-white/10 shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold tracking-tight text-slate-900 dark:text-white truncate">
                  AILAB <span className="text-orange-600 dark:text-amber-400">Makers</span>
                </h1>
                <span className="hidden sm:inline-flex items-center rounded-md bg-slate-100 dark:bg-[#161F30] border border-slate-200/80 dark:border-white/[0.08] px-2 py-0.5 text-[10px] font-mono-data font-semibold text-slate-600 dark:text-slate-300">
                  Acesso Discente
                </span>
              </div>
              <p className="hidden sm:block text-[11px] text-slate-500 dark:text-slate-400 leading-none mt-0.5">
                Controle Acadêmico de Permanência
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="icon-btn"
              title={isDark ? "Mudar para Modo Claro" : "Mudar para Modo Escuro"}
              aria-label={isDark ? "Mudar para Modo Claro" : "Mudar para Modo Escuro"}
            >
              {isDark ? (
                <SunMedium className="h-4 w-4 text-amber-400" />
              ) : (
                <MoonStar className="h-4 w-4 text-slate-700" />
              )}
            </button>

            <Link to="/login" className="btn-primary !px-3.5">
              <KeyRound className="h-3.5 w-3.5" />
              <span>Acesso Tutor</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Card Central */}
      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <form
          onSubmit={handleUnlock}
          className="w-full max-w-md surface-card p-6 sm:p-8 space-y-6 animate-scale-up"
        >
          <div className="text-center space-y-2">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500/10 ring-1 ring-orange-500/25 text-orange-600 dark:text-amber-400">
              <Lock className="h-5 w-5" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Acesso ao Painel
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
              Digite a senha compartilhada dos integrantes do laboratório para visualizar as métricas de lotação e presença.
            </p>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="makers-pass"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
            >
              Senha de presença (Makers)
            </label>
            <div className="relative flex items-center rounded-xl border border-slate-300/80 dark:border-white/[0.12] bg-slate-100/70 dark:bg-[#161F30] px-3.5 min-h-[44px] focus-within:border-orange-500 focus-within:bg-white dark:focus-within:bg-[#0F1623] focus-within:ring-2 focus-within:ring-orange-500/20 transition-all">
              <Lock className="h-4 w-4 text-slate-400 shrink-0 mr-2.5" aria-hidden="true" />
              <input
                id="makers-pass"
                type={showPassword ? "text" : "password"}
                required
                autoFocus
                placeholder="Digite a senha do laboratório..."
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError("");
                }}
                className="w-full bg-transparent border-none text-sm font-mono-data text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:outline-none focus:ring-0 pr-9"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-2 h-8 w-8 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center cursor-pointer"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-xl bg-rose-500/10 ring-1 ring-rose-500/25 p-3.5 text-xs text-rose-700 dark:text-rose-300 font-medium flex items-center justify-center gap-2 animate-fade-in"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            className="w-full btn-primary !min-h-[46px] !text-sm"
          >
            Acessar Painel de Presença
          </button>
        </form>
      </main>

      <footer className="border-t border-slate-200/80 dark:border-white/[0.07] bg-white/70 dark:bg-[#0F1623]/75 backdrop-blur-xl px-4 py-4 text-xs text-slate-500 dark:text-slate-400">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>© <span className="tabular-nums">{new Date().getFullYear()}</span> AILAB Makers · Controle de Frequência e Permanência</span>
          <span className="font-mono-data text-2xs">Ambiente Seguro em Conformidade com LGPD</span>
        </div>
      </footer>
    </div>
  );
}
