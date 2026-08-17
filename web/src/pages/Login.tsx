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
      await signIn(email, password);
      navigate("/dashboard", { replace: true });
    } catch {
      setError("Email ou senha invalidos.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-base px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl bg-surface p-8">
        <h1 className="text-2xl font-semibold text-white">AILAB Facial</h1>
        <p className="text-sm text-white/60">Entre para acessar o painel.</p>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full rounded-lg bg-black/30 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-accent"
        />
        <input
          type="password"
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full rounded-lg bg-black/30 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-accent"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-accent py-3 font-medium text-white disabled:opacity-50"
        >
          {busy ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
