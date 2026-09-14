import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
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

// ── Event Emitter Leve para Sincronização Local Imediata ───────────────────────

type PresenceListener = () => void;
const listeners = new Set<PresenceListener>();

/**
 * Dispara uma recarga imediata da lista de presenças em todos os componentes ativos.
 * Deve ser chamada após eventos de check-in ou check-out no RecognitionPanel.
 */
export function triggerPresenceRefresh(): void {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      // Ignora erro de listener isolado
    }
  });
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
    // 1. Carga inicial
    fetchOpen();

    // 2. Registro no canal de eventos locais (gatilho imediato após reconhecimento)
    listeners.add(fetchOpen);

    // 3. Polling de fallback a cada 10s (resiliência contra perda de pacotes WebSocket e RLS)
    const intervalId = setInterval(() => {
      fetchOpen();
    }, 10000);

    // 4. Re-sincronização quando o app ou tela do tablet sai de repouso
    const appStateSub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        fetchOpen();
      }
    });

    // 5. Supabase Realtime — re-busca em qualquer mutação de sessions
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
      listeners.delete(fetchOpen);
      clearInterval(intervalId);
      appStateSub.remove();
      supabase.removeChannel(channel);
    };
  }, [fetchOpen]);

  return { members, loading, error, refresh: fetchOpen };
}
