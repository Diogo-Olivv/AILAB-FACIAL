import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";

export function Login() {
  const { signIn } = useAuth();
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
          "E-mail ou senha de tutor incorretos. Se for seu primeiro acesso, utilize tutor@ailab.com e a senha padrão."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen flex flex-col justify-between selection:bg-blue-500/20 antialiased font-sans">
      {/* Luz ambiente estilo Apple (Mesh Glow) */}
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute -top-[15%] left-1/2 -translate-x-1/2 w-[700px] h-[550px] bg-gradient-to-tr from-blue-400/20 via-indigo-400/15 to-purple-400/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[550px] h-[500px] bg-gradient-to-br from-emerald-400/15 to-teal-400/10 rounded-full blur-3xl" />
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <form
          onSubmit={submit}
          className="w-full max-w-sm space-y-5 rounded-3xl border border-white/80 bg-white/90 backdrop-blur-2xl p-6 sm:p-9 shadow-apple animate-scale-up"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-2xl shadow-md shadow-blue-500/25">
              🎓
            </span>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-apple-tight apple-heading-2">
                Portal do Tutor
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Gestão de Presença & Auditoria
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-blue-500/15 bg-blue-500/[0.04] p-3 text-2xs sm:text-xs text-slate-600 flex items-start gap-2.5">
            <span className="text-base leading-none select-none">💡</span>
            <div className="space-y-0.5">
              <strong className="text-slate-800 font-semibold block">
                Acesso Institucional
              </strong>
              <span className="leading-relaxed">
                Entre com seu e-mail institucional (<code className="rounded bg-black/[0.06] px-1 py-0.5 font-mono text-slate-900 font-bold">nome@ailab.com</code>). No primeiro acesso geral, utilize <code className="rounded bg-black/[0.06] px-1 py-0.5 font-mono text-slate-900 font-bold">tutor@ailab.com</code>.
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">
              E-mail institucional do Tutor
            </label>
            <div className="flex items-center rounded-2xl border border-black/15 bg-white px-3.5 py-2.5 text-slate-900 shadow-xs focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/15 transition-all">
              <input
                type="text"
                placeholder="nome@ailab.com ou seu.nome"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                required
                autoFocus
                autoCapitalize="none"
                autoCorrect="off"
                className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none font-medium"
              />
              {!emailInput.includes("@") && emailInput.trim().length > 0 && (
                <span className="text-xs text-slate-400 font-mono font-bold shrink-0 select-none pl-1">
                  @ailab.com
                </span>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">Senha de acesso</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-2xl border border-black/15 bg-white px-3.5 py-2.5 text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 text-sm shadow-xs transition-all font-medium"
            />
          </div>

          {error && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 font-semibold text-center animate-fade-in leading-relaxed">
              ⚠️ {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3.5 font-bold text-white shadow-sm shadow-blue-500/25 transition-all hover:shadow-md hover:from-blue-700 hover:to-indigo-700 active:scale-98 disabled:opacity-50 cursor-pointer min-h-[46px] flex items-center justify-center text-sm"
          >
            {busy ? "Validando credenciais..." : "Entrar como Tutor"}
          </button>

          <div className="text-center pt-2">
            <Link
              to="/dashboard"
              className="inline-flex items-center justify-center gap-1.5 text-xs text-slate-500 hover:text-blue-600 font-medium transition-colors min-h-[40px]"
            >
              <span>←</span>
              <span>Voltar para o painel de permanência</span>
            </Link>
          </div>
        </form>
      </div>

      <footer className="border-t border-black/[0.06] bg-white/60 backdrop-blur-xl px-4 py-4 text-center text-xs text-slate-500">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>© {new Date().getFullYear()} AILAB Makers · Portal do Tutor</span>
          <span className="text-2xs text-slate-400 font-medium">Ambiente Administrativo Seguro</span>
        </div>
      </footer>
    </div>
  );
}
