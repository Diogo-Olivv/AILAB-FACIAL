import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
    setBusy(true);
    setError("");
    try {
      await signIn(password, email);
      navigate("/dashboard", { replace: true });
    } catch {
      setError("Credenciais inválidas.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-cream px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-line bg-card p-8 shadow-sm"
      >
        <h1 className="text-2xl font-semibold text-ink">AILAB Facial</h1>
        <p className="text-sm text-muted">Acesso de tutores e coordenadores.</p>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-ink">E-mail institucional</label>
          <input
            type="email"
            placeholder="tutor@ailab.org (ou padrão)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-line bg-white px-4 py-3 text-ink outline-none focus:ring-2 focus:ring-navy text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-ink">Senha</label>
          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-lg border border-line bg-white px-4 py-3 text-ink outline-none focus:ring-2 focus:ring-navy"
          />
        </div>

        {error && <p className="text-sm text-warn">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-green py-3 font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
