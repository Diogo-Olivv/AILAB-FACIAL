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
    <div className="relative min-h-screen flex flex-col justify-between selection:bg-blue-500/20">
      {/* Luz ambiente estilo Apple (Mesh Glow) */}
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute -top-[15%] left-1/2 -translate-x-1/2 w-[700px] h-[550px] bg-gradient-to-tr from-blue-400/20 via-indigo-400/15 to-purple-400/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[550px] h-[500px] bg-gradient-to-br from-emerald-400/15 to-teal-400/10 rounded-full blur-3xl" />
      </div>

      <header className="sticky top-0 z-30 border-b border-black/[0.06] bg-white/70 px-4 py-3.5 sm:px-8 backdrop-blur-2xl shadow-[0_2px_16px_rgba(0,0,0,0.02)]">
        <div className="mx-auto max-w-6xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={logo}
              alt="AiLab Makers Logo"
              className="h-10 w-10 sm:h-11 sm:w-11 rounded-2xl border border-white/80 object-cover shadow-2xs"
            />
            <div>
              <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900">
                AiLab Makers
              </h1>
              <p className="text-xs text-slate-500 leading-none mt-0.5">
                Painel de Frequência e Permanência
              </p>
            </div>
          </div>

          <Link
            to="/login"
            className="liquid-glass-button inline-flex items-center justify-center gap-1.5 rounded-2xl border border-black/10 bg-white/80 px-4 py-2 text-xs sm:text-sm font-bold text-slate-900 shadow-2xs hover:bg-white transition-all min-h-[44px]"
          >
            <span>🎓</span>
            <span>Acesso Tutor</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <form
          onSubmit={handleUnlock}
          className="w-full max-w-md space-y-6 rounded-3xl border border-white/80 bg-white/80 backdrop-blur-2xl p-7 sm:p-9 shadow-apple animate-scale-up"
        >
          <div className="text-center space-y-2.5">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-2xl text-white shadow-md shadow-blue-500/25">
              🔒
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Acesso ao Painel
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 max-w-xs mx-auto leading-relaxed">
              Digite a chave de acesso do laboratório para visualizar o tempo de permanência:
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">Chave de acesso do site</label>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError("");
              }}
              placeholder="Digite a chave..."
              required
              autoFocus
              className="w-full rounded-2xl border border-black/15 bg-white py-3 px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 shadow-xs transition-all outline-none"
            />
          </div>

          {error && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 font-semibold text-center animate-fade-in">
              ⚠️ {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3.5 font-bold text-white shadow-sm shadow-blue-500/25 hover:shadow-md hover:from-blue-700 hover:to-indigo-700 active:scale-98 transition-all cursor-pointer min-h-[46px] flex items-center justify-center"
          >
            Acessar Painel
          </button>

          <div className="border-t border-black/[0.06] pt-4 text-center">
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-1.5 rounded-full border border-black/10 bg-black/[0.03] hover:bg-black/[0.06] px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 transition-all shadow-2xs min-h-[40px]"
            >
              <span>🎓</span>
              <span>Acesso do Tutor & Coordenação →</span>
            </Link>
          </div>
        </form>
      </main>

      <footer className="border-t border-black/[0.06] bg-white/60 backdrop-blur-xl px-4 py-4 text-center text-xs text-slate-500">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>© {new Date().getFullYear()} AILAB Makers · Controle de Frequência e Permanência</span>
          <span className="text-2xs text-slate-400 font-medium">Ambiente Seguro em Conformidade com LGPD</span>
        </div>
      </footer>
    </div>
  );
}
