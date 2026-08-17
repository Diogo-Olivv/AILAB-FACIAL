import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./useAuth";

interface Props {
  ownerOnly?: boolean;
  children: React.ReactNode;
}

export function RequireAuth({ ownerOnly = false, children }: Props) {
  const { session, isOwner, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="grid min-h-screen place-items-center text-white/60">Carregando...</div>;
  }
  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  if (ownerOnly && !isOwner) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}
