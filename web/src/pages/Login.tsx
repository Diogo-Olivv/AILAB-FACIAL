import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  SunMedium,
  MoonStar,
  ArrowLeft,
  KeyRound,
  Sparkles,
  Eye,
  EyeOff,
  AlertCircle,
  Mail,
  Lock,
  Loader2,
} from "lucide-react";
import { useAuth } from "../auth/useAuth";
import logo from "../ailab_makers.jpeg";
import { useTheme } from "../lib/useTheme";

export function Login() {
  const { user, loading, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { isDark, toggleTheme } = useTheme();
  const [emailInput, setEmailInput] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const checkCapsLock = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (typeof e.getModifierState === "function") {
      setCapsLockOn(e.getModifierState("CapsLock"));
    }
  };

  useEffect(() => {
    if (!loading && user) {
      const from = (location.state as { from?: string } | null)?.from ?? "/dashboard";
      navigate(from, { replace: true });
    }
  }, [user, loading, navigate, location.state]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const cleanInput = emailInput.trim().toLowerCase();
      const finalEmail = cleanInput
        ? cleanInput.includes("@")
          ? cleanInput
          : `${cleanInput}@ailab.com`
        : "tutor@ailab.com";
      await signIn(finalEmail, password);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Credenciais inválidas. Verifique seu e-mail e senha institucional."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col justify-between selection:bg-orange-500/20 antialiased font-sans bg-transparent text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* Header Sticky Consistente */}
      <header className="sticky top-0 z-40 h-16 border-b border-slate-200/90 dark:border-white/[0.1] bg-white/85 dark:bg-[#0F1623]/80 backdrop-blur-xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl h-full flex items-center justify-between gap-3">
          <Link to="/dashboard" className="flex items-center gap-3 group min-w-0">
            <img
              src={logo}
              alt="AILAB Makers"
              className="w-9 h-9 rounded-lg object-cover ring-1 ring-black/10 dark:ring-white/10 shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm sm:text-base font-bold tracking-tight text-slate-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-amber-400 transition-colors truncate">
                  AILAB <span className="text-orange-600 dark:text-amber-400">Makers</span>
                </span>
                <span className="hidden sm:inline-flex items-center rounded-md bg-orange-500/10 text-orange-600 dark:text-amber-400 ring-1 ring-orange-500/20 px-2 py-0.5 text-[10px] font-mono-data font-bold uppercase tracking-wider">
                  Acesso Restrito
                </span>
              </div>
              <p className="hidden sm:block text-[11px] text-slate-500 dark:text-slate-400 leading-none mt-0.5">
                Portal de Tutoria & Coordenação Acadêmica
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-2 shrink-0">
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

            <Link
              to="/dashboard?mode=student"
              className="btn-secondary group text-xs !min-h-[36px] !px-3"
              aria-label="Voltar ao Painel Público"
            >
              <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5 text-slate-500 dark:text-slate-400" />
              <span>Painel Público</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Card Central de Autenticação */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <form
          onSubmit={handleSubmit}
          aria-labelledby="login-title"
          className="w-full max-w-md surface-card p-6 sm:p-8 space-y-6 animate-scale-up"
        >
          {/* Cabeçalho */}
          <div className="flex items-center gap-3.5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 ring-1 ring-orange-500/25 text-orange-600 dark:text-amber-400">
              <KeyRound className="h-5 w-5" />
            </span>
            <div>
              <span className="eyebrow text-orange-600 dark:text-amber-400">
                Credencial Institucional
              </span>
              <h1
                id="login-title"
                className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight"
              >
                Portal do Tutor
              </h1>
            </div>
          </div>

          {/* Instrução */}
          <div className="surface-muted p-3 text-xs text-slate-700 dark:text-slate-200 flex items-center gap-2.5 rounded-xl">
            <Sparkles className="h-4 w-4 text-orange-500 dark:text-amber-400 shrink-0" />
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-snug">
              Credenciais institucionais com perfil de tutor ou coordenação acadêmica.
            </p>
          </div>

          {/* Campo E-mail */}
          <div className="space-y-1.5">
            <label
              htmlFor="tutor-email"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
            >
              E-mail institucional completo
            </label>
            <div className="relative flex items-center rounded-xl border border-slate-300/80 dark:border-white/[0.12] bg-slate-100/70 dark:bg-[#161F30] px-3.5 min-h-[44px] focus-within:border-orange-500 focus-within:bg-white dark:focus-within:bg-[#0F1623] focus-within:ring-2 focus-within:ring-orange-500/20 transition-all">
              <Mail className="h-4 w-4 text-slate-400 shrink-0 mr-2.5" aria-hidden="true" />
              <input
                id="tutor-email"
                type="email"
                required
                autoComplete="email"
                placeholder="seu.email@instituicao.edu.br"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                disabled={busy}
                className="w-full bg-transparent border-none text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:outline-none focus:ring-0"
              />
            </div>
          </div>

          {/* Campo Senha */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="tutor-password"
                className="text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                Senha de acesso
              </label>
              {capsLockOn && (
                <span
                  role="status"
                  className="text-2xs font-mono-data font-semibold text-amber-700 dark:text-amber-300 bg-amber-500/10 ring-1 ring-amber-500/20 px-1.5 py-0.5 rounded"
                >
                  CAPS LOCK ATIVO
                </span>
              )}
            </div>
            <div className="relative flex items-center rounded-xl border border-slate-300/80 dark:border-white/[0.12] bg-slate-100/70 dark:bg-[#161F30] px-3.5 min-h-[44px] focus-within:border-orange-500 focus-within:bg-white dark:focus-within:bg-[#0F1623] focus-within:ring-2 focus-within:ring-orange-500/20 transition-all">
              <Lock className="h-4 w-4 text-slate-400 shrink-0 mr-2.5" aria-hidden="true" />
              <input
                id="tutor-password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={checkCapsLock}
                onKeyUp={checkCapsLock}
                onBlur={() => setCapsLockOn(false)}
                disabled={busy}
                className="w-full bg-transparent border-none text-sm font-mono-data text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:outline-none focus:ring-0 font-medium pr-9"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-2 h-8 w-8 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center cursor-pointer"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              aria-live="assertive"
              className="rounded-xl bg-rose-500/10 ring-1 ring-rose-500/25 p-3.5 text-xs text-rose-700 dark:text-rose-300 font-medium flex items-center gap-2 animate-fade-in"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="pt-1">
            <button
              type="submit"
              disabled={busy || !emailInput || !password}
              className="w-full btn-primary !min-h-[46px] !text-sm cursor-pointer"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Validando credenciais...</span>
                </>
              ) : (
                <span>Entrar como Tutor</span>
              )}
            </button>
          </div>
        </form>
      </main>

      <footer className="border-t border-slate-200/80 dark:border-white/[0.07] bg-white/70 dark:bg-[#0F1623]/75 backdrop-blur-xl px-4 py-4 text-xs text-slate-500 dark:text-slate-400">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>© <span className="tabular-nums">{new Date().getFullYear()}</span> AILAB Makers · Controle de Frequência e Permanência</span>
          <span className="font-mono-data text-2xs">Ambiente Seguro · LGPD Art. 11</span>
        </div>
      </footer>
    </div>
  );
}
