import { useState, useEffect } from "react";
import { GraduationCap, X, Lightbulb, Camera, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { useAuth } from "../auth/useAuth";
import { supabase } from "../lib/supabase";
import { compressImageToBase64 } from "../lib/reports";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function TutorProfileModal({ isOpen, onClose }: Props) {
  const { user, updateTutorCredentials, updateTutorAvatar } = useAuth();
  const currentEmail = user?.email || "tutor@ailab.com";

  const [emailUsername, setEmailUsername] = useState(() => {
    if (currentEmail.endsWith("@ailab.com")) {
      return currentEmail.replace("@ailab.com", "");
    }
    return "tutor";
  });
  const [matricula, setMatricula] = useState("");
  const [linkedStudentName, setLinkedStudentName] = useState<string | null>(null);
  const [linkFeedback, setLinkFeedback] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    (user?.user_metadata as any)?.avatar_url ?? null
  );
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Sincroniza informações bidirecionais entre a conta de tutor e o perfil de aluno no Supabase
  useEffect(() => {
    const userEmail = user?.email;
    if (!isOpen || !userEmail) return;
    const loadLinkedProfile = async () => {
      try {
        const email = userEmail.toLowerCase();
        const { data } = await supabase
          .from("profiles")
          .select("matricula, avatar_url, name")
          .eq("tutor_email", email)
          .maybeSingle();
        if (data) {
          if (data.matricula) setMatricula(data.matricula);
          if (data.name) setLinkedStudentName(data.name);
          if (data.avatar_url && !avatarUrl) setAvatarUrl(data.avatar_url);
        }
      } catch (err) {
        console.warn("Erro ao buscar perfil vinculado do tutor:", err);
      }
    };
    loadLinkedProfile();
  }, [isOpen, user?.email]);

  if (!isOpen) return null;

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Por favor selecione um arquivo de imagem válido (JPG, PNG, WebP).");
      return;
    }
    setIsUploadingPhoto(true);
    setError("");
    try {
      const base64 = await compressImageToBase64(file, 256);
      await updateTutorAvatar(base64);
      setAvatarUrl(base64);

      // Sincroniza a foto no registro de aluno da tabela profiles
      const targetMatricula = matricula.trim();
      const targetEmail = user?.email?.toLowerCase();
      if (targetMatricula || targetEmail) {
        let query = supabase.from("profiles").update({ avatar_url: base64 });
        if (targetMatricula) {
          query = query.eq("matricula", targetMatricula);
        } else if (targetEmail) {
          query = query.eq("tutor_email", targetEmail);
        }
        await query;
      }
    } catch (err: any) {
      setError(`Falha ao salvar foto do tutor: ${err?.message || "Erro desconhecido"}`);
    } finally {
      setIsUploadingPhoto(false);
      e.target.value = "";
    }
  };

  const handleRemovePhoto = async () => {
    setIsUploadingPhoto(true);
    setError("");
    try {
      await updateTutorAvatar(null);
      setAvatarUrl(null);

      // Sincroniza a remoção da foto também no perfil de aluno
      const targetMatricula = matricula.trim();
      const targetEmail = user?.email?.toLowerCase();
      if (targetMatricula || targetEmail) {
        let query = supabase.from("profiles").update({ avatar_url: null });
        if (targetMatricula) {
          query = query.eq("matricula", targetMatricula);
        } else if (targetEmail) {
          query = query.eq("tutor_email", targetEmail);
        }
        await query;
      }
    } catch (err: any) {
      setError(`Falha ao remover foto: ${err?.message || "Erro desconhecido"}`);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    let clean = emailUsername.trim().toLowerCase();
    if (clean.includes("@")) {
      clean = clean.split("@")[0];
    }
    const cleanUsername = clean.replace(/[^a-z0-9._-]/g, "");
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
    setLinkFeedback(null);
    try {
      await updateTutorCredentials(fullEmail, newPassword);

      if (matricula.trim()) {
        try {
          const { data: linkRes, error: linkErr } = await supabase.rpc("link_tutor_profile", {
            p_matricula: matricula.trim(),
            p_tutor_email: fullEmail,
          });
          if (!linkErr && linkRes?.message) {
            setLinkFeedback(linkRes.message);
          }
          if (avatarUrl) {
            await supabase
              .from("profiles")
              .update({ avatar_url: avatarUrl })
              .eq("matricula", matricula.trim());
          }
        } catch (rpcEx) {
          console.warn("Falha ao invocar link_tutor_profile:", rpcEx);
        }
      }

      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setNewPassword("");
        setConfirmPassword("");
        setMatricula("");
        setLinkFeedback(null);
      }, 1600);
    } catch (err: any) {
      setError(err?.message || "Erro ao atualizar credenciais.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-3 sm:p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutor-profile-title"
    >
      <div
        className="w-full max-w-lg max-h-[92dvh] sm:max-h-[88vh] flex flex-col rounded-3xl border border-white/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl shadow-apple animate-scale-up text-slate-900 dark:text-slate-100 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho Fixo (Sempre Visível) */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 sm:px-6 sm:py-4.5 border-b border-black/[0.06] dark:border-white/[0.08] bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25">
              <GraduationCap className="h-5 w-5 sm:h-6 sm:w-6" />
            </span>
            <div className="min-w-0">
              <h2
                id="tutor-profile-title"
                className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 truncate"
              >
                Acesso do Tutor
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                Personalize seu e-mail institucional e senha
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar modal de acesso do tutor"
            className="flex h-10 w-10 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full bg-black/[0.05] hover:bg-black/[0.1] dark:bg-white/10 dark:hover:bg-white/20 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Formulário com Corpo Rolável e Rodapé Fixo */}
        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6 sm:py-5 space-y-4">
            {/* Alerta de Regra */}
            <div className="rounded-2xl border border-blue-500/15 dark:border-blue-500/30 bg-blue-500/[0.04] dark:bg-blue-500/10 p-3 text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2.5">
              <Lightbulb className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong className="text-slate-800 dark:text-slate-200 font-semibold block">
                  Regra de Credenciais AiLab
                </strong>
                <span>
                  O e-mail deve ter o formato{" "}
                  <code className="rounded bg-black/[0.05] dark:bg-white/10 px-1 py-0.5 font-mono text-slate-900 dark:text-slate-200 font-bold">
                    nome@ailab.com
                  </code>
                  . As novas credenciais terão validade imediata neste dispositivo.
                </span>
              </div>
            </div>

            {/* Seção de Foto de Perfil do Tutor */}
            <div className="flex items-center gap-3.5 p-3 sm:p-3.5 rounded-2xl border border-stone-200 dark:border-slate-800 bg-[#FAF9F5] dark:bg-slate-800/60 shadow-2xs">
              <div className="relative group shrink-0">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Foto do Tutor"
                    className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl object-cover ring-2 ring-[#C15F3D]/25 dark:ring-amber-500/30 shadow-md"
                  />
                ) : (
                  <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-[#C15F3D] text-white shadow-md shadow-orange-500/25">
                    <GraduationCap className="h-6 w-6 sm:h-7 sm:w-7" />
                  </div>
                )}

                <label
                  className={`absolute inset-0 rounded-2xl bg-black/55 text-white flex flex-col items-center justify-center transition-opacity cursor-pointer ${
                    isUploadingPhoto ? "opacity-100 bg-black/75" : "opacity-0 group-hover:opacity-100"
                  }`}
                  title="Carregar foto de perfil"
                >
                  {isUploadingPhoto ? (
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                  ) : (
                    <>
                      <Camera className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      <span className="text-[9px] font-semibold mt-0.5">Trocar</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    disabled={isUploadingPhoto}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="min-w-0 flex-1">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block font-sans">
                  Foto de Perfil do Tutor
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-sans truncate">
                  Visível no cabeçalho e na barra de auditoria
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  <label className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#C15F3D] dark:text-amber-400 hover:underline cursor-pointer min-h-[32px]">
                    <Camera className="h-3 w-3 inline" />
                    <span>Alterar foto</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      disabled={isUploadingPhoto}
                      className="hidden"
                    />
                  </label>
                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      disabled={isUploadingPhoto}
                      className="text-[11px] font-medium text-rose-500 hover:text-rose-700 dark:hover:text-rose-400 underline cursor-pointer min-h-[32px] px-1"
                    >
                      Remover
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Novo E-mail */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Novo E-mail do Tutor
              </label>
              <div className="flex items-center rounded-2xl border border-black/15 dark:border-slate-700 bg-white dark:bg-slate-800/80 px-3 py-2 text-sm shadow-xs focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/15 transition-all">
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
                  className="w-full bg-transparent text-slate-900 dark:text-slate-100 outline-none placeholder:text-slate-400 font-medium"
                />
                <span className="text-slate-400 dark:text-slate-400 font-mono text-xs font-bold shrink-0 select-none">
                  @ailab.com
                </span>
              </div>
            </div>

            {/* Matrícula de Aluno para Vínculo */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Matrícula de Aluno para Vínculo
                </label>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Opcional</span>
              </div>
              <input
                type="text"
                value={matricula}
                onChange={(e) => setMatricula(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="Ex: 232038442"
                maxLength={9}
                className="w-full rounded-2xl border border-black/15 dark:border-slate-700 bg-white dark:bg-slate-800/80 px-3.5 py-2.5 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 text-sm shadow-xs transition-all font-mono"
              />
              {linkedStudentName && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="truncate">
                    Conta vinculada: <strong>{linkedStudentName}</strong>
                  </span>
                </div>
              )}
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-sans">
                Se você possui cadastro prévio como aluno no laboratório, informe sua matrícula para promover seu perfil a <strong>Tutor</strong> no Totem e nas listas de presença.
              </p>
            </div>

            {/* Grid Responsivo para Senhas: 2 colunas em telas médias, 1 coluna no mobile */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Nova Senha de Acesso
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                  minLength={6}
                  className="w-full rounded-2xl border border-black/15 dark:border-slate-700 bg-white dark:bg-slate-800/80 px-3.5 py-2.5 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 text-sm shadow-xs transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Confirmar Nova Senha
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a senha"
                  required
                  minLength={6}
                  className="w-full rounded-2xl border border-black/15 dark:border-slate-700 bg-white dark:bg-slate-800/80 px-3.5 py-2.5 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 text-sm shadow-xs transition-all"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300 font-semibold text-center flex items-center justify-center gap-1.5">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-800 dark:text-emerald-300 font-semibold text-center animate-fade-in flex flex-col items-center justify-center gap-1">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>Credenciais atualizadas com sucesso!</span>
                </div>
                {linkFeedback && (
                  <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-normal">
                    {linkFeedback}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Rodapé Fixo (Ações Sempre Visíveis e Acessíveis) */}
          <div className="flex gap-2.5 p-4 sm:p-5 border-t border-black/[0.06] dark:border-white/[0.08] bg-slate-50/70 dark:bg-slate-900/70 backdrop-blur-sm shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="flex-1 rounded-2xl border border-black/10 dark:border-slate-700 bg-white dark:bg-slate-800 py-2.5 sm:py-3 text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-700 dark:hover:text-white transition-all cursor-pointer min-h-[44px]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex-1 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 py-2.5 sm:py-3 text-xs sm:text-sm font-bold text-white shadow-sm shadow-blue-500/25 hover:shadow-md hover:from-blue-700 hover:to-indigo-700 active:scale-98 disabled:opacity-50 transition-all cursor-pointer min-h-[44px] flex items-center justify-center gap-2"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <span>Salvar Alterações</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
