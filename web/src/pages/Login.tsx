import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { useTheme } from "../lib/useTheme";
import logo from "../ailab_makers.jpeg";

export function Login() {
  const { signIn } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [emailInput, setEmailInput] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const raw = emailInput.trim();
    if (!raw || !password) {
      setError("Informe o e-mail institucional e a senha do tutor.");
      return;
    }

    const fullEmail = raw.includes("@") ? raw : `${raw}@ailab.com`;

    setBusy(true);
    setError("");
    try {
      await signIn(password, fullEmail);
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      setError(
        err?.message ||
          "E-mail ou senha de tutor incorretos. Caso seja o primeiro acesso geral, utilize tutor@ailab.com."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen flex flex-col justify-between selection:bg-[#C15F3D]/20 antialiased font-sans bg-[#FAF9F5] dark:bg-[#0B0F19] text-[#171715] dark:text-slate-100 transition-colors duration-300">
      {/* Luz ambiente editorial e sutil */}
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute -top-[12%] left-1/2 -translate-x-1/2 w-[720px] h-[550px] bg-gradient-to-tr from-[#E5E2DC]/40 via-[#F0ECE1]/30 to-amber-100/20 dark:from-emerald-950/20 dark:via-indigo-950/20 dark:to-orange-950/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[580px] h-[520px] bg-gradient-to-br from-[#F5F2EB]/60 to-[#EAE6DD]/40 dark:from-slate-900/40 dark:to-slate-950/40 rounded-full blur-3xl" />
      </div>

      {/* Header Superior estilo Apple / Claude */}
      <header className="sticky top-0 z-30 border-b border-[#E5E2DC]/80 dark:border-slate-800 bg-[#FAF9F5]/80 dark:bg-slate-900/80 px-4 py-3.5 sm:px-8 backdrop-blur-2xl shadow-[0_2px_12px_rgba(23,23,21,0.02)]">
        <div className="mx-auto max-w-6xl flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-3 group">
            <img
              src={logo}
              alt="AiLab Makers Logo"
              className="h-10 w-10 sm:h-11 sm:w-11 rounded-2xl border border-[#E5E2DC] dark:border-slate-700 object-cover shadow-2xs group-hover:border-[#706E6A]/40 transition-colors"
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-editorial text-lg sm:text-xl font-normal tracking-tight text-[#171715] dark:text-slate-100 group-hover:text-[#C15F3D] dark:group-hover:text-amber-400 transition-colors">
                  AiLab Makers
                </h1>
                <span className="hidden sm:inline-flex items-center rounded-full bg-white dark:bg-slate-800 border border-[#E5E2DC] dark:border-slate-700 px-2 py-0.5 text-[10px] font-mono-data font-medium text-[#706E6A] dark:text-slate-300">
                  Acesso Restrito
                </span>
              </div>
              <p className="text-xs text-[#706E6A] dark:text-slate-400 leading-none mt-0.5 font-sans">
                Portal de Tutoria & Coordenação
              </p>
            </div>
          </Link>

          {/* Botão de Retorno e Alternância de Tema no Topo */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[#E5E2DC] dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 text-sm shadow-2xs hover:scale-105 active:scale-95 transition-all cursor-pointer"
              title={theme === "dark" ? "Alternar para modo claro" : "Alternar para modo escuro"}
              aria-label={theme === "dark" ? "Alternar para modo claro" : "Alternar para modo escuro"}
            >
              {theme === "dark" ? "☀️" : "🌙"}
            </button>

            <Link
              to="/dashboard"
              className="group inline-flex items-center gap-2 rounded-full border border-[#E5E2DC] dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 hover:bg-white dark:hover:bg-slate-800 px-4 py-2 text-xs font-sans font-medium text-[#706E6A] dark:text-slate-300 hover:text-[#171715] dark:hover:text-white shadow-2xs hover:border-[#706E6A]/40 transition-all min-h-[40px]"
            >
              <svg
                className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5 text-[#706E6A] dark:text-slate-400 group-hover:text-[#171715] dark:group-hover:text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              <span>Voltar ao painel</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Área Central do Formulário */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 sm:py-14">
        <form
          onSubmit={submit}
          className="w-full max-w-md space-y-6 rounded-3xl border border-[#E5E2DC] dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl p-7 sm:p-10 shadow-[0_8px_30px_rgba(23,23,21,0.04)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)] animate-scale-up"
        >
          {/* Cabeçalho de Identidade com Tipografia Editorial Claude */}
          <div className="flex items-center gap-3.5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#FAF5F0] dark:bg-amber-950/40 border border-[#F0DCD3] dark:border-amber-800/50 text-[#C15F3D] dark:text-amber-400 text-2xl shadow-2xs">
              🎓
            </span>
            <div>
              <h2 className="font-editorial text-2xl sm:text-3xl font-normal text-[#171715] dark:text-slate-100 tracking-tight leading-none">
                Portal do Tutor
              </h2>
              <p className="text-xs text-[#706E6A] dark:text-slate-400 font-sans mt-1">
                AiLab Makers · Frequência & Auditoria
              </p>
            </div>
          </div>

          {/* Dica Institucional estilo Claude Callout */}
          <div className="rounded-2xl border border-[#F0DCD3] dark:border-amber-800/40 bg-[#FAF5F0]/80 dark:bg-amber-950/20 p-3.5 text-xs text-[#171715] dark:text-slate-200 flex items-start gap-2.5">
            <span className="text-sm leading-none select-none text-[#C15F3D] dark:text-amber-400 mt-0.5">✦</span>
            <div className="space-y-1">
              <strong className="text-[#171715] dark:text-slate-100 font-semibold block font-sans">
                Acesso Institucional com E-mail @ailab.com
              </strong>
              <span className="text-xs text-[#706E6A] dark:text-slate-400 leading-relaxed block">
                Use seu e-mail cadastrado (<code className="rounded-md bg-white dark:bg-slate-800 border border-[#E5E2DC] dark:border-slate-700 px-1.5 py-0.5 font-mono-data text-[#171715] dark:text-slate-200 font-medium">nome@ailab.com</code>). Primeiro acesso geral: <code className="rounded-md bg-white dark:bg-slate-800 border border-[#E5E2DC] dark:border-slate-700 px-1.5 py-0.5 font-mono-data text-[#171715] dark:text-slate-200 font-medium">tutor@ailab.com</code>.
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#171715] dark:text-slate-200 font-sans">
              E-mail institucional
            </label>
            <div className="flex items-center rounded-2xl border border-[#E5E2DC] dark:border-slate-700 bg-[#FAF9F5] dark:bg-slate-800/80 px-4 py-3 text-[#171715] dark:text-slate-100 shadow-2xs focus-within:border-[#C15F3D] dark:focus-within:border-amber-400 focus-within:bg-white dark:focus-within:bg-slate-800 focus-within:ring-4 focus-within:ring-[#C15F3D]/10 dark:focus-within:ring-amber-400/10 transition-all">
              <input
                type="text"
                placeholder="seu.nome ou nome@ailab.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                required
                autoFocus
                autoCapitalize="none"
                autoCorrect="off"
                className="w-full bg-transparent text-sm font-sans text-[#171715] dark:text-slate-100 placeholder:text-[#706E6A]/50 dark:placeholder:text-slate-500 outline-none font-medium"
              />
              {!emailInput.includes("@") && emailInput.trim().length > 0 && (
                <span className="text-xs text-[#C15F3D] dark:text-amber-400 font-mono-data font-semibold bg-[#FAF5F0] dark:bg-amber-950/60 border border-[#F0DCD3] dark:border-amber-800/60 px-2 py-0.5 rounded-md shrink-0 select-none ml-1 animate-fade-in">
                  @ailab.com
                </span>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#171715] dark:text-slate-200 font-sans">Senha de acesso</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-2xl border border-[#E5E2DC] dark:border-slate-700 bg-[#FAF9F5] dark:bg-slate-800/80 px-4 py-3 text-sm font-mono-data text-[#171715] dark:text-slate-100 placeholder:text-[#706E6A]/50 dark:placeholder:text-slate-500 outline-none focus:border-[#C15F3D] dark:focus:border-amber-400 focus:bg-white dark:focus:bg-slate-800 focus:ring-4 focus:ring-[#C15F3D]/10 dark:focus:ring-amber-400/10 shadow-2xs transition-all font-medium"
            />
          </div>

          {error && (
            <div className="rounded-2xl border border-[#C15F3D]/30 dark:border-rose-800/50 bg-[#FAF5F0] dark:bg-rose-950/40 p-3.5 text-xs text-[#C15F3D] dark:text-rose-300 font-medium text-center animate-fade-in leading-relaxed">
              ⚠️ {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy || !emailInput || !password}
            className="w-full rounded-2xl bg-[#171715] hover:bg-[#2A2925] dark:bg-amber-500 dark:hover:bg-amber-400 dark:text-slate-950 py-3.5 font-sans font-medium text-sm text-[#FAF9F5] shadow-xs active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed min-h-[48px] flex items-center justify-center tracking-tight"
          >
            {busy ? "Validando credenciais..." : "Entrar como Tutor"}
          </button>
        </form>
      </main>

      <footer className="border-t border-[#E5E2DC]/80 dark:border-slate-800 bg-[#FAF9F5]/70 dark:bg-slate-900/70 backdrop-blur-xl px-4 py-4 text-center text-xs text-[#706E6A] dark:text-slate-400">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="font-sans">© {new Date().getFullYear()} AILAB Makers · Controle de Frequência e Permanência</span>
          <span className="font-mono-data text-[11px] text-[#706E6A]/80 dark:text-slate-500">Ambiente Seguro em Conformidade com LGPD</span>
        </div>
      </footer>
    </div>
  );
}
