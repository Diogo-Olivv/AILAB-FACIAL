import { type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { GraduationCap } from "lucide-react";

interface Props {
  children: ReactNode;
}

/**
 * Guarda de Rota RBAC: restringe o acesso exclusivamente a usuários com papel de Tutor.
 * Usuários não autenticados são redirecionados diretamente para /login.
 */
export function RequireTutorAuth({ children }: Props) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF9F5] dark:bg-[#0B0F19] flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 animate-pulse">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FAF5F0] dark:bg-amber-950/40 border border-[#F0DCD3] dark:border-amber-800/40 text-[#C15F3D] dark:text-amber-400 shadow-2xs">
            <GraduationCap className="h-6 w-6 text-amber-500" />
          </div>
          <p className="text-xs font-mono-data text-[#706E6A] dark:text-slate-400">
            Verificando credenciais do tutor...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}
