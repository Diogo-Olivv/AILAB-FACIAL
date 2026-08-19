import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { GENERIC_ERROR_MESSAGE } from "@/lib/errors";

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  name: string;
  matricula: string | null;
  avatar_url: string | null;
}

export interface PresentMember {
  session_id: number;
  check_in: string;
  profile: Profile;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function usePresence() {
  const [members, setMembers] = useState<PresentMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOpen = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("sessions")
      .select("id, check_in, profiles(id, name, matricula, avatar_url)")
      .is("check_out", null)
      .order("check_in", { ascending: true });

    if (err) {
      console.warn(`Presence fetch failed: ${err.message}`);
      setError(GENERIC_ERROR_MESSAGE);
      return;
    }

    setMembers(
      (data ?? []).map((s: any) => ({
        session_id: s.id,
        check_in: s.check_in,
        profile: s.profiles as Profile,
      }))
    );
    setLoading(false);
    setError(null);
  }, []);

  useEffect(() => {
    fetchOpen();

    // Supabase Realtime — re-busca em qualquer mutação de sessions
    const channel = supabase
      .channel("presence_updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sessions" },
        () => {
          fetchOpen();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchOpen]);

  return { members, loading, error, refresh: fetchOpen };
}
