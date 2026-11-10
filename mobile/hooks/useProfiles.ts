import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { GENERIC_ERROR_MESSAGE } from "@/lib/errors";

export interface ProfileItem {
  id: string;
  name: string;
  matricula: string | null;
  avatar_url?: string | null;
  is_tutor?: boolean;
}

export function useProfiles() {
  const [profiles, setProfiles] = useState<ProfileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error: err } = await supabase.rpc("kiosk_directory");

      if (!err && data) {
        setProfiles(data);
        setError(null);
        return;
      }

      // Fallback direto via profiles
      const { data: directData, error: directErr } = await supabase
        .from("profiles")
        .select("id, name, matricula, avatar_url, is_tutor")
        .eq("active", true)
        .is("consent_revoked_at", null)
        .order("name", { ascending: true });

      if (directErr) {
        console.warn(`Failed to fetch profiles for re-enrollment: ${directErr.message}`);
        setError(GENERIC_ERROR_MESSAGE);
        return;
      }

      setProfiles(directData ?? []);
      setError(null);
    } catch (exc: any) {
      console.warn(`Unexpected error fetching profiles: ${exc?.message}`);
      setError(GENERIC_ERROR_MESSAGE);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  return { profiles, loading, error, reload: fetchProfiles };
}
