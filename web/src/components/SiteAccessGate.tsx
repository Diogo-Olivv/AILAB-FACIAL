import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { KeyRound, Lock, AlertCircle, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../auth/useAuth";
import logo from "../ailab_makers.jpeg";

const VALID_PASSWORDS = ["presenca_makers", "presenca"];
const ACCESS_STORAGE_KEY = "ailab_site_access_granted";

interface Props {
  children: ReactNode;
}

export function SiteAccessGate({ children }: Props) {
  const { user } = useAuth();
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

  // Se o tutor já estiver autenticado ou a senha foi digitada anteriormente, libera o acesso direto
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
    <div className="relative min-h-screen flex flex-col justify-between selection:bg-[#C15F3D]/20 bg-[#FAF9F5] dark:bg-slate-950 text-[#171715] dark:text-slate-100 transition-colors duration-300">
      {/* Luz ambiente editorial e sutil */}
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute -top-[15%] left-1/2 -translate-x-1/2 w-[700px] h-[550px] bg-gradient-to-tr from-[#E5E2DC]/40 via-[#F0ECE1]/30 to-amber-100/20 dark:from-slate-800/30 dark:to-amber-950/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[550px] h-[500px] bg-gradient-to-br from-[#F5F2EB]/60 to-[#EAE6DD]/40 dark:from-slate-900/40 dark:to-slate-950/60 rounded-full blur-3xl" />
      </div>

      <header className="sticky top-0 z-30 border-b border-[#E5E2DC]/80 dark:border-slate-800 bg-[#FAF9F5]/80 dark:bg-slate-900/80 px-4 py-3.5 sm:px-8 backdrop-blur-2xl shadow-[0_2px_12px_rgba(23,23,21,0.02)]">
        <div className="mx-auto max-w-6xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={logo}
              alt="AiLab Makers Logo"
              className="h-10 w-10 sm:h-11 sm:w-11 rounded-2xl border border-[#E5E2DC] dark:border-slate-700 object-cover shadow-2xs"
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-editorial text-lg sm:text-xl font-normal tracking-tight text-[#171715] dark:text-slate-100">
                  AiLab Makers
                </h1>
                <span className="hidden sm:inline-flex items-center rounded-full bg-[#FAF9F5] dark:bg-slate-800 border border-[#E5E2DC] dark:border-slate-700 px-2 py-0.5 text-[10px] font-mono-data font-medium text-[#706E6A] dark:text-slate-300">
                  BioPresença
                </span>
              </div>
              <p className="text-xs text-[#706E6A] dark:text-slate-400 leading-none mt-0.5">
                Painel do Aluno · Controle de Presença
              </p>
            </div>
          </div>

          <Link
            to="/login"
            className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[#E5E2DC] dark:border-slate-700 bg-white/90 dark:bg-slate-800 px-4 py-2 text-xs font-semibold text-[#171715] dark:text-slate-200 shadow-2xs hover:bg-[#FAF9F5] dark:hover:bg-slate-700 hover:border-[#C15F3D]/40 transition-all min-h-[42px]"
          >
            <KeyRound className="h-4 w-4 text-[#C15F3D] dark:text-amber-400" />
            <span>Acesso Tutor</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <form
          onSubmit={handleUnlock}
          className="w-full max-w-md space-y-6 rounded-3xl border border-[#E5E2DC] dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl p-7 sm:p-9 shadow-[0_8px_30px_rgba(23,23,21,0.04)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)] animate-scale-up"
        >
          <div className="text-center space-y-2.5">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FAF5F0] dark:bg-amber-950/40 border border-[#F0DCD3] dark:border-amber-800/50 text-[#C15F3D] dark:text-amber-400 shadow-xs">
              <Lock className="h-6 w-6" />
            </div>
            <h2 className="font-editorial text-2xl sm:text-3xl font-normal text-[#171715] dark:text-slate-100 tracking-tight">
              Acesso ao Painel
            </h2>
            <p className="text-xs sm:text-sm text-[#706E6A] dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
              Digite a senha de presença dos makers para visualizar a ocupação e presença do laboratório:
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#171715] dark:text-slate-200">Senha de presença (Makers)</label>
            <div className="relative flex items-center">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError("");
                }}
                placeholder="Digite a senha..."
                required
                autoFocus
                className="w-full rounded-2xl border border-[#E5E2DC] dark:border-slate-700 bg-[#FAF9F5] dark:bg-slate-950 py-3.5 pl-4 pr-12 text-sm font-mono-data text-[#171715] dark:text-slate-100 placeholder:text-[#706E6A]/60 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:border-[#C15F3D] dark:focus:border-amber-500 focus:ring-4 focus:ring-[#C15F3D]/10 shadow-2xs transition-all outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 p-1.5 rounded-xl text-[#706E6A] dark:text-slate-400 hover:text-[#171715] dark:hover:text-slate-200 transition-colors cursor-pointer flex items-center justify-center"
                aria-label={showPassword ? "Ocultar senha" : "Exibir senha"}
                title={showPassword ? "Ocultar senha" : "Exibir senha"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-2xl border border-[#C15F3D]/30 dark:border-rose-800/40 bg-[#FAF5F0] dark:bg-rose-950/40 p-3.5 text-xs text-[#C15F3D] dark:text-rose-300 font-medium text-center animate-fade-in flex items-center justify-center gap-1.5">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            className="w-full rounded-2xl bg-[#171715] dark:bg-white hover:bg-[#2A2925] dark:hover:bg-slate-100 py-3.5 font-sans font-medium text-sm text-[#FAF9F5] dark:text-slate-950 shadow-xs active:scale-[0.98] transition-all cursor-pointer min-h-[48px] flex items-center justify-center tracking-tight font-semibold"
          >
            Acessar Painel do Aluno
          </button>
        </form>
      </main>

      <footer className="border-t border-[#E5E2DC]/80 dark:border-slate-800 bg-[#FAF9F5]/70 dark:bg-slate-900/70 backdrop-blur-xl px-4 py-4 text-center text-xs text-[#706E6A] dark:text-slate-400">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>© {new Date().getFullYear()} AILAB Makers · Controle de Frequência e Permanência</span>
          <span className="font-mono-data text-[11px] text-[#706E6A]/80 dark:text-slate-400">Ambiente Seguro em Conformidade com LGPD</span>
        </div>
      </footer>
    </div>
  );
}
