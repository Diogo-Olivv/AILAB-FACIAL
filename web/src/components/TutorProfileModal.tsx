import { useState } from "react";
import { useAuth } from "../auth/useAuth";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function TutorProfileModal({ isOpen, onClose }: Props) {
  const { user, updateTutorCredentials } = useAuth();
  const currentEmail = user?.email || "tutor@ailab.com";

  const [emailUsername, setEmailUsername] = useState(() => {
    if (currentEmail.endsWith("@ailab.com")) {
      return currentEmail.replace("@ailab.com", "");
    }
    return "tutor";
  });
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    const cleanUsername = emailUsername.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
    if (!cleanUsername) {
      setError("Informe o nome de usuário institucional desejado.");
      return;
    }

    const fullEmail = `${cleanUsername}@ailab.com`;

    if (newPassword.length < 6) {
      setError("A senha deve conter no mínimo 6 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("A confirmação de senha não confere.");
      return;
    }

    setBusy(true);
    try {
      await updateTutorCredentials(fullEmail, newPassword);
      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setNewPassword("");
        setConfirmPassword("");
      }, 1400);
    } catch (err: any) {
      setError(err?.message || "Erro ao atualizar credenciais.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md rounded-3xl border border-white/80 bg-white/90 backdrop-blur-2xl p-6 sm:p-7 shadow-apple animate-scale-up space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-xl shadow-md shadow-blue-500/25">
              🎓
            </span>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900">
                Acesso do Tutor
              </h2>
              <p className="text-xs text-slate-500">
                Personalize seu e-mail institucional e senha
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/[0.05] hover:bg-black/[0.1] text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="rounded-2xl border border-blue-500/15 bg-blue-500/[0.04] p-3 text-2xs text-slate-600 flex items-start gap-2">
          <span className="text-base leading-none">💡</span>
          <div>
            <strong className="text-slate-800 font-semibold block">
              Regra de Credenciais AiLab
            </strong>
            <span>
              O e-mail deve ter o formato <code className="rounded bg-black/[0.05] px-1 py-0.5 font-mono text-slate-900 font-bold">nome@ailab.com</code>. Suas novas credenciais terão validade imediata neste dispositivo.
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">
              Novo E-mail do Tutor
            </label>
            <div className="flex items-center rounded-2xl border border-black/15 bg-white px-3 py-2 text-sm shadow-xs focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/15 transition-all">
              <input
                type="text"
                value={emailUsername}
                onChange={(e) =>
                  setEmailUsername(
                    e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, "")
                  )
                }
                placeholder="seu.nome"
                required
                className="w-full bg-transparent text-slate-900 outline-none placeholder:text-slate-400 font-medium"
              />
              <span className="text-slate-400 font-mono text-xs font-bold shrink-0 select-none">
                @ailab.com
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">
              Nova Senha de Acesso
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              required
              minLength={6}
              className="w-full rounded-2xl border border-black/15 bg-white px-3.5 py-2.5 text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 text-sm shadow-xs transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">
              Confirmar Nova Senha
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Digite novamente a nova senha"
              required
              minLength={6}
              className="w-full rounded-2xl border border-black/15 bg-white px-3.5 py-2.5 text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 text-sm shadow-xs transition-all"
            />
          </div>

          {error && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 font-semibold text-center">
              ⚠️ {error}
            </div>
          )}

          {success && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-800 font-semibold text-center animate-fade-in">
              ✅ Credenciais atualizadas com sucesso!
            </div>
          )}

          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="flex-1 rounded-2xl border border-black/10 bg-white/80 py-3 text-xs sm:text-sm font-bold text-slate-700 hover:bg-white hover:text-slate-900 transition-all cursor-pointer min-h-[44px]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex-1 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3 text-xs sm:text-sm font-bold text-white shadow-sm shadow-blue-500/25 hover:shadow-md hover:from-blue-700 hover:to-indigo-700 active:scale-98 disabled:opacity-50 transition-all cursor-pointer min-h-[44px]"
            >
              {busy ? "Salvando..." : "Salvar Alterações"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
