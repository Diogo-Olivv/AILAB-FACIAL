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
    <div className="grid min-h-screen place-items-center bg-transparent px-4 py-8 selection:bg-blue-500/20">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-4 rounded-3xl border border-white/80 bg-white/85 backdrop-blur-2xl p-6 sm:p-8 shadow-apple animate-scale-up"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-xl shadow-md shadow-blue-500/25">
            🎓
          </span>
          <div>
            <h1 className="text-xl font-black text-slate-900">Área do Tutor</h1>
            <p className="text-xs text-slate-500">Acesso administrativo e acadêmico</p>
          </div>
        </div>

        <div className="rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-500/[0.06] to-indigo-500/[0.02] p-3 text-2xs text-slate-600 leading-relaxed">
          O login de tutor permite realizar auditoria de frequência semanal, aplicar advertências para permanência inferior a 4 horas e autorizar novos cadastros biométricos.
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700">E-mail institucional do Tutor</label>
          <input
            type="email"
            placeholder="tutor@ailab.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-2xl border border-black/15 bg-white px-3.5 py-2.5 text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 text-sm shadow-xs transition-all"
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
            className="w-full rounded-2xl border border-black/15 bg-white px-3.5 py-2.5 text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 text-sm shadow-xs transition-all"
          />
        </div>

        {error && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 font-semibold text-center">
            ⚠️ {error}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3.5 font-bold text-white shadow-sm shadow-blue-500/25 transition-all hover:shadow-md hover:from-blue-700 hover:to-indigo-700 active:scale-98 disabled:opacity-50 cursor-pointer min-h-[44px]"
        >
          {busy ? "Validando credenciais..." : "Entrar como Tutor"}
        </button>

        <div className="text-center pt-2">
          <Link
            to="/dashboard"
            className="text-xs text-slate-500 hover:text-blue-600 font-medium transition-colors"
          >
            ← Voltar para o painel de permanência
          </Link>
        </div>
      </form>
    </div>
  );
}
