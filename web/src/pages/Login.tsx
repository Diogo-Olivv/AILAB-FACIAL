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
          "E-mail ou senha de tutor incorretos. Caso seja o primeiro acesso geral, utilize tutor@ailab.com."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen flex flex-col justify-between selection:bg-amber-500/20 antialiased font-sans bg-[#FAF9F5]">
      {/* Luz ambiente orgânica e suave estilo Claude & Apple Mesh */}
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute -top-[12%] left-1/2 -translate-x-1/2 w-[720px] h-[550px] bg-gradient-to-tr from-amber-500/[0.07] via-rose-400/[0.05] to-teal-400/[0.04] rounded-full blur-3xl" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[580px] h-[520px] bg-gradient-to-br from-teal-500/[0.05] to-amber-500/[0.04] rounded-full blur-3xl" />
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-8 sm:py-14">
        <form
          onSubmit={submit}
          className="w-full max-w-md space-y-6 rounded-3xl border border-stone-200/80 bg-white/95 backdrop-blur-2xl p-7 sm:p-10 shadow-claude animate-scale-up"
        >
          {/* Cabeçalho de Identidade com Tipografia Editorial Claude */}
          <div className="flex items-center gap-3.5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white text-2xl shadow-claude">
              🎓
            </span>
            <div>
              <h1 className="font-editorial text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight leading-none">
                Portal do Tutor
              </h1>
              <p className="font-editorial-italic text-xs sm:text-sm text-stone-500 mt-1">
                AiLab Makers &bull; Frequência & Auditoria
              </p>
            </div>
          </div>

          {/* Dica Institucional estilo Claude Callout */}
          <div className="rounded-2xl border border-stone-200/90 bg-stone-100/60 p-3.5 text-xs text-stone-600 flex items-start gap-2.5">
            <span className="text-base leading-none select-none text-amber-700">✦</span>
            <div className="space-y-0.5">
              <strong className="text-slate-800 font-semibold block">
                Acesso Institucional AiLab
              </strong>
              <span className="leading-relaxed">
                Entre com seu e-mail institucional (<code className="rounded bg-white border border-stone-200 px-1 py-0.5 font-mono-data text-slate-900 font-bold">nome@ailab.com</code>). Primeiro acesso geral: <code className="rounded bg-white border border-stone-200 px-1 py-0.5 font-mono-data text-slate-900 font-bold">tutor@ailab.com</code>.
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700">
              E-mail institucional
            </label>
            <div className="flex items-center rounded-2xl border border-stone-200/90 bg-stone-50/60 px-3.5 py-2.5 text-slate-900 shadow-inner focus-within:border-slate-800 focus-within:bg-white focus-within:ring-4 focus-within:ring-slate-800/10 transition-all">
              <input
                type="text"
                placeholder="nome@ailab.com ou seu.nome"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                required
                autoFocus
                autoCapitalize="none"
                autoCorrect="off"
                className="w-full bg-transparent text-sm text-slate-900 placeholder:text-stone-400 outline-none font-medium"
              />
              {!emailInput.includes("@") && emailInput.trim().length > 0 && (
                <span className="text-xs text-stone-400 font-mono-data font-bold shrink-0 select-none pl-1">
                  @ailab.com
                </span>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700">Senha de acesso</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-2xl border border-stone-200/90 bg-stone-50/60 px-3.5 py-2.5 text-slate-900 placeholder:text-stone-400 outline-none focus:border-slate-800 focus:bg-white focus:ring-4 focus:ring-slate-800/10 text-sm shadow-inner transition-all font-medium"
            />
          </div>

          {error && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 font-semibold text-center animate-fade-in leading-relaxed">
              ⚠️ {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 py-3.5 font-bold text-white shadow-claude transition-all hover:from-black hover:to-slate-900 active:scale-98 disabled:opacity-50 cursor-pointer min-h-[46px] flex items-center justify-center text-sm"
          >
            {busy ? "Validando credenciais..." : "Entrar como Tutor"}
          </button>

          <div className="text-center pt-2">
            <Link
              to="/dashboard"
              className="inline-flex items-center justify-center gap-1.5 text-xs text-stone-500 hover:text-slate-900 font-medium transition-colors min-h-[40px]"
            >
              <span>←</span>
              <span>Voltar para o painel de permanência</span>
            </Link>
          </div>
        </form>
      </div>

      <footer className="border-t border-stone-200/70 bg-white/70 backdrop-blur-xl px-4 py-4 text-center text-xs text-stone-500">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="font-editorial text-sm font-medium">AiLab Makers &bull; Ambiente Acadêmico Seguro</span>
          <span className="text-2xs text-stone-400 font-mono-data">Conformidade LGPD Art. 11</span>
        </div>
      </footer>
    </div>
  );
}
