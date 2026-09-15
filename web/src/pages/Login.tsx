import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";

export function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Informe o e-mail e a senha do tutor.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await signIn(password, email.trim());
      navigate("/dashboard", { replace: true });
    } catch {
      setError("E-mail ou senha de tutor incorretos.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen flex flex-col justify-between selection:bg-blue-500/20">
      {/* Luz ambiente estilo Apple (Mesh Glow) */}
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute -top-[15%] left-1/2 -translate-x-1/2 w-[700px] h-[550px] bg-gradient-to-tr from-blue-400/20 via-indigo-400/15 to-purple-400/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[550px] h-[500px] bg-gradient-to-br from-emerald-400/15 to-teal-400/10 rounded-full blur-3xl" />
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <form
          onSubmit={submit}
          className="w-full max-w-sm space-y-5 rounded-3xl border border-white/80 bg-white/85 backdrop-blur-2xl p-7 sm:p-9 shadow-apple animate-scale-up"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-2xl shadow-md shadow-blue-500/25">
              🎓
            </span>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Portal do Tutor</h1>
              <p className="text-xs text-slate-500">Gestão de Presença & Auditoria</p>
            </div>
          </div>

          <div className="rounded-2xl border border-blue-500/15 bg-blue-500/[0.04] p-3 text-2xs text-slate-600 flex items-start gap-2.5">
            <span className="text-base leading-none select-none">💡</span>
            <div className="space-y-0.5">
              <strong className="text-slate-800 font-semibold block">
                Primeiro Acesso de Tutor
              </strong>
              <span className="leading-relaxed">
                Utilize <code className="rounded bg-black/[0.06] px-1 py-0.5 font-mono text-slate-900 font-bold">tutor@ailab.com</code>. Após o login, você poderá personalizar seu e-mail institucional (<code className="rounded bg-black/[0.06] px-1 py-0.5 font-mono text-slate-900 font-bold">nome@ailab.com</code>) e senha no painel.
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">E-mail institucional do Tutor</label>
            <input
              type="email"
              placeholder="tutor@ailab.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="w-full rounded-2xl border border-black/15 bg-white px-3.5 py-2.5 text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 text-sm shadow-xs transition-all font-medium"
            />
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
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 font-semibold text-center animate-fade-in">
              ⚠️ {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3.5 font-bold text-white shadow-sm shadow-blue-500/25 transition-all hover:shadow-md hover:from-blue-700 hover:to-indigo-700 active:scale-98 disabled:opacity-50 cursor-pointer min-h-[46px] flex items-center justify-center"
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
