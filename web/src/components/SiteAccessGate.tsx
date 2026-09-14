import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import logo from "../ailab_makers.jpeg";

const SITE_PASSWORD = "presenca_makers";
const ACCESS_STORAGE_KEY = "ailab_site_access_granted";

interface Props {
  children: ReactNode;
}

export function SiteAccessGate({ children }: Props) {
  const { user } = useAuth();
  const [password, setPassword] = useState("");
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
    if (password.trim() === SITE_PASSWORD) {
      try {
        localStorage.setItem(ACCESS_STORAGE_KEY, "true");
      } catch {
        // Ignora erro
      }
      setHasAccess(true);
      setError("");
    } else {
      setError("Senha de acesso incorreta. Tente novamente.");
    }
  };

  return (
    <div className="min-h-screen bg-cream flex flex-col justify-between selection:bg-green/20">
      <header className="border-b border-line bg-card/95 px-4 py-3.5 sm:px-8">
        <div className="mx-auto max-w-6xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={logo}
              alt="AiLab Makers Logo"
              className="h-10 w-10 sm:h-11 sm:w-11 rounded-2xl border border-line/60 object-cover shadow-2xs"
            />
            <div>
              <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-ink">
                AiLab Makers
              </h1>
              <p className="text-xs text-muted leading-none">
                Painel de Frequência e Permanência
              </p>
            </div>
          </div>

          <Link
            to="/login"
            className="rounded-xl border border-navy/15 bg-white px-3.5 py-2 text-xs sm:text-sm font-bold text-navy shadow-2xs hover:bg-navy/5 transition-all min-h-[44px] inline-flex items-center"
          >
            Acesso Tutor
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <form
          onSubmit={handleUnlock}
          className="w-full max-w-md space-y-5 rounded-3xl border border-line bg-card p-6 sm:p-8 shadow-sm animate-scale-up"
        >
          <div className="text-center space-y-2">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-navy text-2xl text-white shadow-2xs">
              🔒
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-ink">
              Acesso ao Painel
            </h2>
            <p className="text-xs sm:text-sm text-muted">
              Digite a senha de acesso para visualizar o tempo de permanência:
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-ink">Senha de acesso ao site</label>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError("");
              }}
              placeholder="Digite a senha..."
              required
              autoFocus
              className="w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none focus:border-navy focus:ring-2 focus:ring-navy/20 shadow-2xs"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-warn/30 bg-warn/10 p-3 text-xs text-warn font-semibold text-center">
              ⚠️ {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full rounded-xl bg-navy py-3 font-bold text-white shadow-sm transition-all hover:bg-navy/90 active:scale-95 cursor-pointer min-h-[44px]"
          >
            Acessar Painel
          </button>

          <div className="border-t border-line/60 pt-4 text-center">
            <Link
              to="/login"
              className="text-xs text-muted hover:text-navy underline transition-colors"
            >
              É tutor ou coordenador? Entrar com e-mail e senha de Tutor →
            </Link>
          </div>
        </form>
      </main>

      <footer className="border-t border-line/80 bg-card/40 px-4 py-4 text-center text-xs text-muted">
        © {new Date().getFullYear()} AILAB Makers · Acesso Restrito aos Integrantes e Tutores
      </footer>
    </div>
  );
}
