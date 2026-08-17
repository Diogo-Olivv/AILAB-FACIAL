import React, { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import type { PresentMember } from "@/hooks/usePresence";

// ── Cronômetro ao vivo ────────────────────────────────────────────────────────

function useElapsed(checkIn: string): string {
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    const update = () => {
      const diffSec = Math.floor((Date.now() - new Date(checkIn).getTime()) / 1000);
      const h = Math.floor(diffSec / 3600);
      const m = Math.floor((diffSec % 3600) / 60);
      const s = diffSec % 60;
      setElapsed(h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [checkIn]);

  return elapsed;
}

// ── Componente ────────────────────────────────────────────────────────────────

interface Props {
  member: PresentMember;
}

export function PresenceCard({ member }: Props) {
  const elapsed = useElapsed(member.check_in);
  const initials = member.profile.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <View style={styles.card}>
      {/* Avatar */}
      {member.profile.avatar_url ? (
        <Image source={{ uri: member.profile.avatar_url }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.initialsWrapper]}>
          <Text style={styles.initialsText}>{initials}</Text>
        </View>
      )}

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {member.profile.name}
        </Text>
        {member.profile.matricula ? (
          <Text style={styles.matricula}>{member.profile.matricula}</Text>
        ) : null}
      </View>

      {/* Status */}
      <View style={styles.right}>
        <View style={styles.onlineDot} />
        <Text style={styles.elapsed}>{elapsed}</Text>
      </View>
    </View>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A1A2E",
    borderRadius: 16,
    padding: 14,
    gap: 14,
    borderWidth: 1,
    borderColor: "#2A2A4A",
    // Sombra sutil
    shadowColor: "#6C47FF",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  initialsWrapper: {
    backgroundColor: "#6C47FF22",
    alignItems: "center",
    justifyContent: "center",
  },
  initialsText: {
    color: "#6C47FF",
    fontWeight: "800",
    fontSize: 16,
  },
  info: {
    flex: 1,
    gap: 3,
  },
  name: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
  },
  matricula: {
    color: "#6B7280",
    fontSize: 12,
  },
  right: {
    alignItems: "flex-end",
    gap: 6,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#22C55E",
  },
  elapsed: {
    color: "#22C55E",
    fontSize: 12,
    fontWeight: "600",
  },
});
