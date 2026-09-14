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
    <div className="grid min-h-screen place-items-center bg-cream px-4 py-8 selection:bg-green/20">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-4 rounded-3xl border border-line bg-card p-6 sm:p-8 shadow-sm"
      >
        <div className="flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-navy text-white text-lg">
            🎓
          </span>
          <div>
            <h1 className="text-xl font-bold text-ink">Área do Tutor</h1>
            <p className="text-xs text-muted">Acesso administrativo e acadêmico</p>
          </div>
        </div>

        <div className="rounded-xl border border-navy/10 bg-navy/[0.03] p-3 text-2xs text-muted leading-relaxed">
          O login de tutor permite realizar auditoria de frequência semanal, aplicar advertências para permanência inferior a 4 horas e autorizar novos cadastros biométricos.
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-ink">E-mail institucional do Tutor</label>
          <input
            type="email"
            placeholder="tutor@ailab.org"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-ink outline-none focus:border-navy focus:ring-2 focus:ring-navy/20 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-ink">Senha de acesso</label>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-ink outline-none focus:border-navy focus:ring-2 focus:ring-navy/20 text-sm"
          />
        </div>

        {error && (
          <div className="rounded-xl border border-warn/30 bg-warn/10 p-3 text-xs text-warn font-semibold">
            ⚠️ {error}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-navy py-3 font-bold text-white shadow-sm transition-all hover:bg-navy/90 active:scale-95 disabled:opacity-50 cursor-pointer min-h-[44px]"
        >
          {busy ? "Validando credenciais..." : "Entrar como Tutor"}
        </button>

        <div className="text-center pt-2">
          <Link
            to="/dashboard"
            className="text-xs text-muted hover:text-navy underline transition-colors"
          >
            ← Voltar para o painel público de permanência
          </Link>
        </div>
      </form>
    </div>
  );
}
