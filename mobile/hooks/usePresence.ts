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
  is_tutor?: boolean;
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
    // 1. Tenta RPC kiosk_presence
    try {
      const { data, error: err } = await supabase.rpc("kiosk_presence");
      if (!err && data) {
        setMembers(
          (data ?? []).map((row: any) => ({
            session_id: row.session_id,
            check_in: row.check_in,
            profile: {
              id: row.profile_id ?? "",
              name: row.name ?? "Desconhecido",
              matricula: null,
              avatar_url: row.avatar_url ?? null,
              is_tutor: Boolean(row.is_tutor),
            },
          }))
        );
        setLoading(false);
        setError(null);
        return;
      }
    } catch {
      // Fallback
    }

    // 2. Fallback direto via Supabase REST
    try {
      const { data, error: err } = await supabase
        .from("sessions")
        .select("id, check_in, profiles(id, name, matricula, avatar_url, is_tutor)")
        .is("check_out", null)
        .is("voided_at", null)
        .order("check_in", { ascending: true });

      if (err) {
        console.warn(`Presence fetch direct failed: ${err.message}`);
        setError(GENERIC_ERROR_MESSAGE);
        return;
      }

      setMembers(
        (data ?? []).map((s: any) => {
          const raw = s.profiles;
          const p = Array.isArray(raw) ? raw[0] : raw;
          return {
            session_id: s.id,
            check_in: s.check_in,
            profile: p
              ? {
                  id: p.id,
                  name: p.name ?? "Desconhecido",
                  matricula: p.matricula ?? null,
                  avatar_url: p.avatar_url ?? null,
                  is_tutor: Boolean(p.is_tutor),
                }
              : {
                  id: "",
                  name: "Desconhecido",
                  matricula: null,
                  avatar_url: null,
                  is_tutor: false,
                },
          };
        })
      );
      setLoading(false);
      setError(null);
    } catch (e: any) {
      console.warn(`Presence fetch fallback exception: ${e?.message}`);
      setError(GENERIC_ERROR_MESSAGE);
    }
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
    const channelName = `presence_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    let channel: any = null;
    try {
      channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "sessions" },
          () => {
            fetchOpen();
          }
        )
        .subscribe();
    } catch (e: any) {
      console.warn("Failed to subscribe to presence realtime:", e?.message);
    }

    return () => {
      listeners.delete(fetchOpen);
      clearInterval(intervalId);
      appStateSub.remove();
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch {}
      }
    };
  }, [fetchOpen]);

  return { members, loading, error, refresh: fetchOpen };
}
