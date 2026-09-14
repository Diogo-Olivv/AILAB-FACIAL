import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { GENERIC_ERROR_MESSAGE } from "@/lib/errors";

export interface ProfileItem {
  id: string;
  name: string;
  matricula: string | null;
}

export function useProfiles() {
  const [profiles, setProfiles] = useState<ProfileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from("profiles")
        .select("id, name, matricula")
        .eq("active", true)
        .is("consent_revoked_at", null)
        .order("name", { ascending: true });

      if (err) {
        console.warn(`Failed to fetch profiles for re-enrollment: ${err.message}`);
        setError(GENERIC_ERROR_MESSAGE);
        return;
      }

      setProfiles(data ?? []);
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
