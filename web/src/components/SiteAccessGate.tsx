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
    <div className="relative min-h-screen flex flex-col justify-between selection:bg-[#C15F3D]/20 text-[#171715]">
      {/* Luz ambiente editorial e sutil */}
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute -top-[15%] left-1/2 -translate-x-1/2 w-[700px] h-[550px] bg-gradient-to-tr from-[#E5E2DC]/40 via-[#F0ECE1]/30 to-amber-100/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[550px] h-[500px] bg-gradient-to-br from-[#F5F2EB]/60 to-[#EAE6DD]/40 rounded-full blur-3xl" />
      </div>

      <header className="sticky top-0 z-30 border-b border-[#E5E2DC]/80 bg-[#FAF9F5]/80 px-4 py-3.5 sm:px-8 backdrop-blur-2xl shadow-[0_2px_12px_rgba(23,23,21,0.02)]">
        <div className="mx-auto max-w-6xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={logo}
              alt="AiLab Makers Logo"
              className="h-10 w-10 sm:h-11 sm:w-11 rounded-2xl border border-[#E5E2DC] object-cover shadow-2xs"
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-editorial text-lg sm:text-xl font-normal tracking-tight text-[#171715]">
                  AiLab Makers
                </h1>
                <span className="hidden sm:inline-flex items-center rounded-full bg-[#FAF9F5] border border-[#E5E2DC] px-2 py-0.5 text-[10px] font-mono-data font-medium text-[#706E6A]">
                  BioPresença
                </span>
              </div>
              <p className="text-xs text-[#706E6A] leading-none mt-0.5">
                Painel de Frequência e Permanência
              </p>
            </div>
          </div>

          <Link
            to="/login"
            className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[#E5E2DC] bg-white/90 px-4 py-2 text-xs font-semibold text-[#171715] shadow-2xs hover:bg-[#FAF9F5] hover:border-[#C15F3D]/40 transition-all min-h-[42px]"
          >
            <span>🎓</span>
            <span>Acesso Tutor</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <form
          onSubmit={handleUnlock}
          className="w-full max-w-md space-y-6 rounded-3xl border border-[#E5E2DC] bg-[#FFFFFF]/90 backdrop-blur-2xl p-7 sm:p-9 shadow-[0_8px_30px_rgba(23,23,21,0.04)] animate-scale-up"
        >
          <div className="text-center space-y-2.5">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FAF5F0] border border-[#F0DCD3] text-2xl text-[#C15F3D] shadow-xs">
              🔒
            </div>
            <h2 className="font-editorial text-2xl sm:text-3xl font-normal text-[#171715] tracking-tight">
              Acesso ao Painel
            </h2>
            <p className="text-xs sm:text-sm text-[#706E6A] max-w-xs mx-auto leading-relaxed">
              Digite a chave de acesso do laboratório para visualizar o tempo de permanência:
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#171715]">Chave de acesso do laboratório</label>
            <div className="relative">
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
                className="w-full rounded-2xl border border-[#E5E2DC] bg-[#FAF9F5] py-3.5 px-4 text-sm font-mono-data text-[#171715] placeholder:text-[#706E6A]/60 focus:bg-white focus:border-[#C15F3D] focus:ring-4 focus:ring-[#C15F3D]/10 shadow-2xs transition-all outline-none"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <span className="font-mono-data text-[10px] text-[#706E6A]/70 border border-[#E5E2DC] bg-white px-1.5 py-0.5 rounded">
                  ↵ Enter
                </span>
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-2xl border border-[#C15F3D]/30 bg-[#FAF5F0] p-3.5 text-xs text-[#C15F3D] font-medium text-center animate-fade-in">
              ⚠️ {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full rounded-2xl bg-[#171715] hover:bg-[#2A2925] py-3.5 font-sans font-medium text-sm text-[#FAF9F5] shadow-xs active:scale-[0.98] transition-all cursor-pointer min-h-[48px] flex items-center justify-center tracking-tight"
          >
            Acessar Painel
          </button>
        </form>
      </main>

      <footer className="border-t border-[#E5E2DC]/80 bg-[#FAF9F5]/70 backdrop-blur-xl px-4 py-4 text-center text-xs text-[#706E6A]">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>© {new Date().getFullYear()} AILAB Makers · Controle de Frequência e Permanência</span>
          <span className="font-mono-data text-[11px] text-[#706E6A]/80">Ambiente Seguro em Conformidade com LGPD</span>
        </div>
      </footer>
    </div>
  );
}
