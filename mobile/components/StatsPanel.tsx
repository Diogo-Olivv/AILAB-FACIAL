import React from "react";
import { StyleSheet, Text, View } from "react-native";

interface Props {
  present: number;
  avgMinutes: number;
}

export function StatsPanel({ present, avgMinutes }: Props) {
  const avgFormatted =
    avgMinutes >= 60
      ? `${Math.floor(avgMinutes / 60)}h ${avgMinutes % 60}m`
      : `${avgMinutes}m`;

  return (
    <View style={styles.panel}>
      <Stat label="Presentes agora" value={String(present)} accent="#6C47FF" />
      <View style={styles.divider} />
      <Stat label="Tempo médio" value={avgFormatted} accent="#0EA5E9" />
    </View>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.value, { color: accent }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: "#1A1A2E",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2A2A4A",
    overflow: "hidden",
  },
  stat: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 16,
    gap: 4,
  },
  value: {
    fontSize: 28,
    fontWeight: "800",
  },
  label: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "500",
  },
  divider: {
    width: 1,
    backgroundColor: "#2A2A4A",
    marginVertical: 12,
  },
});
