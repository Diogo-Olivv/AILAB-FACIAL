import { createContext } from "react";
import type { Session, User } from "@supabase/supabase-js";

export interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (password: string, email?: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateTutorCredentials: (newEmail: string, newPassword: string) => Promise<void>;
  updateTutorAvatar: (avatarUrl: string | null) => Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);
