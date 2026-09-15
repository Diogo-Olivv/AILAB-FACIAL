import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import logo from "../ailab_makers.jpeg";

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
          "E-mail ou senha de tutor incorretos. Caso seja o primeiro acesso geral, utilize tutor@ailab.com."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen flex flex-col justify-between selection:bg-[#C15F3D]/20 antialiased font-sans bg-[#FAF9F5] text-[#171715]">
      {/* Luz ambiente editorial e sutil */}
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute -top-[12%] left-1/2 -translate-x-1/2 w-[720px] h-[550px] bg-gradient-to-tr from-[#E5E2DC]/40 via-[#F0ECE1]/30 to-amber-100/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[580px] h-[520px] bg-gradient-to-br from-[#F5F2EB]/60 to-[#EAE6DD]/40 rounded-full blur-3xl" />
      </div>

      {/* Header Superior estilo Apple / Claude */}
      <header className="sticky top-0 z-30 border-b border-[#E5E2DC]/80 bg-[#FAF9F5]/80 px-4 py-3.5 sm:px-8 backdrop-blur-2xl shadow-[0_2px_12px_rgba(23,23,21,0.02)]">
        <div className="mx-auto max-w-6xl flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-3 group">
            <img
              src={logo}
              alt="AiLab Makers Logo"
              className="h-10 w-10 sm:h-11 sm:w-11 rounded-2xl border border-[#E5E2DC] object-cover shadow-2xs group-hover:border-[#706E6A]/40 transition-colors"
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-editorial text-lg sm:text-xl font-normal tracking-tight text-[#171715] group-hover:text-[#C15F3D] transition-colors">
                  AiLab Makers
                </h1>
                <span className="hidden sm:inline-flex items-center rounded-full bg-white border border-[#E5E2DC] px-2 py-0.5 text-[10px] font-mono-data font-medium text-[#706E6A]">
                  Acesso Restrito
                </span>
              </div>
              <p className="text-xs text-[#706E6A] leading-none mt-0.5 font-sans">
                Portal de Tutoria & Coordenação
              </p>
            </div>
          </Link>

          {/* Botão de Retorno no Topo */}
          <Link
            to="/dashboard"
            className="group inline-flex items-center gap-2 rounded-full border border-[#E5E2DC] bg-white/90 hover:bg-white px-4 py-2 text-xs font-sans font-medium text-[#706E6A] hover:text-[#171715] shadow-2xs hover:border-[#706E6A]/40 transition-all min-h-[40px]"
          >
            <svg
              className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5 text-[#706E6A] group-hover:text-[#171715]"
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
      </header>

      {/* Área Central do Formulário */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 sm:py-14">
        <form
          onSubmit={submit}
          className="w-full max-w-md space-y-6 rounded-3xl border border-[#E5E2DC] bg-white/95 backdrop-blur-2xl p-7 sm:p-10 shadow-[0_8px_30px_rgba(23,23,21,0.04)] animate-scale-up"
        >
          {/* Cabeçalho de Identidade com Tipografia Editorial Claude */}
          <div className="flex items-center gap-3.5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#FAF5F0] border border-[#F0DCD3] text-[#C15F3D] text-2xl shadow-2xs">
              🎓
            </span>
            <div>
              <h2 className="font-editorial text-2xl sm:text-3xl font-normal text-[#171715] tracking-tight leading-none">
                Portal do Tutor
              </h2>
              <p className="text-xs text-[#706E6A] font-sans mt-1">
                AiLab Makers · Frequência & Auditoria
              </p>
            </div>
          </div>

          {/* Dica Institucional estilo Claude Callout */}
          <div className="rounded-2xl border border-[#F0DCD3] bg-[#FAF5F0]/80 p-3.5 text-xs text-[#171715] flex items-start gap-2.5">
            <span className="text-sm leading-none select-none text-[#C15F3D] mt-0.5">✦</span>
            <div className="space-y-1">
              <strong className="text-[#171715] font-semibold block font-sans">
                Acesso Institucional com E-mail @ailab.com
              </strong>
              <span className="text-xs text-[#706E6A] leading-relaxed block">
                Use seu e-mail cadastrado (<code className="rounded-md bg-white border border-[#E5E2DC] px-1.5 py-0.5 font-mono-data text-[#171715] font-medium">nome@ailab.com</code>). Primeiro acesso geral: <code className="rounded-md bg-white border border-[#E5E2DC] px-1.5 py-0.5 font-mono-data text-[#171715] font-medium">tutor@ailab.com</code>.
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#171715] font-sans">
              E-mail institucional
            </label>
            <div className="flex items-center rounded-2xl border border-[#E5E2DC] bg-[#FAF9F5] px-4 py-3 text-[#171715] shadow-2xs focus-within:border-[#C15F3D] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#C15F3D]/10 transition-all">
              <input
                type="text"
                placeholder="seu.nome ou nome@ailab.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                required
                autoFocus
                autoCapitalize="none"
                autoCorrect="off"
                className="w-full bg-transparent text-sm font-sans text-[#171715] placeholder:text-[#706E6A]/50 outline-none font-medium"
              />
              {!emailInput.includes("@") && emailInput.trim().length > 0 && (
                <span className="text-xs text-[#C15F3D] font-mono-data font-semibold bg-[#FAF5F0] border border-[#F0DCD3] px-2 py-0.5 rounded-md shrink-0 select-none ml-1 animate-fade-in">
                  @ailab.com
                </span>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#171715] font-sans">Senha de acesso</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-2xl border border-[#E5E2DC] bg-[#FAF9F5] px-4 py-3 text-sm font-mono-data text-[#171715] placeholder:text-[#706E6A]/50 outline-none focus:border-[#C15F3D] focus:bg-white focus:ring-4 focus:ring-[#C15F3D]/10 shadow-2xs transition-all font-medium"
            />
          </div>

          {error && (
            <div className="rounded-2xl border border-[#C15F3D]/30 bg-[#FAF5F0] p-3.5 text-xs text-[#C15F3D] font-medium text-center animate-fade-in leading-relaxed">
              ⚠️ {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-2xl bg-[#171715] hover:bg-[#2A2925] py-3.5 font-sans font-medium text-sm text-[#FAF9F5] shadow-xs active:scale-[0.98] disabled:opacity-50 cursor-pointer min-h-[48px] flex items-center justify-center transition-all tracking-tight"
          >
            {busy ? "Validando credenciais..." : "Entrar como Tutor"}
          </button>

          {/* Botão Elegante de Retorno ao Painel (Redesenhado) */}
          <div className="border-t border-[#E5E2DC] pt-4">
            <Link
              to="/dashboard"
              className="group w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-[#E5E2DC] bg-[#FAF9F5] hover:bg-[#F2EFE8] py-3 px-4 text-xs sm:text-sm font-sans font-medium text-[#706E6A] hover:text-[#171715] shadow-2xs hover:border-[#706E6A]/30 active:scale-[0.99] transition-all min-h-[44px]"
            >
              <svg
                className="w-4 h-4 text-[#706E6A] group-hover:text-[#171715] group-hover:-translate-x-1 transition-transform"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              <span>Voltar para o painel de permanência</span>
            </Link>
          </div>
        </form>
      </main>

      <footer className="border-t border-[#E5E2DC]/80 bg-[#FAF9F5]/70 backdrop-blur-xl px-4 py-4 text-center text-xs text-[#706E6A]">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="font-sans">© {new Date().getFullYear()} AILAB Makers · Controle de Frequência e Permanência</span>
          <span className="font-mono-data text-[11px] text-[#706E6A]/80">Ambiente Seguro em Conformidade com LGPD</span>
        </div>
      </footer>
    </div>
  );
}
