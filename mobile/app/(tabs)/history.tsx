import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "@/lib/supabase";
import { getSessionStats } from "@/lib/api";

interface HistorySession {
  id: number;
  check_in: string;
  check_out: string | null;
  duration_s: number | null;
  profiles: { name: string; matricula: string | null } | null;
}

export default function HistoryScreen() {
  const [sessions, setSessions] = useState<HistorySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error: err } = await supabase
        .from("sessions")
        .select("id, check_in, check_out, duration_s, profiles(name, matricula)")
        .not("check_out", "is", null)
        .order("check_in", { ascending: false })
        .limit(100);
      if (err) setError(err.message);
      else setSessions((data as HistorySession[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    });

  const fmtDuration = (sec: number | null) => {
    if (!sec) return "—";
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color="#6C47FF" />;
  if (error) return <Text style={styles.error}>⚠️ {error}</Text>;

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>📋 Histórico</Text>
      <FlatList
        data={sessions}
        keyExtractor={(s) => String(s.id)}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardLeft}>
              <Text style={styles.name}>{item.profiles?.name ?? "—"}</Text>
              {item.profiles?.matricula ? (
                <Text style={styles.matricula}>{item.profiles.matricula}</Text>
              ) : null}
              <Text style={styles.date}>{fmtDate(item.check_in)}</Text>
            </View>
            <View style={styles.cardRight}>
              <Text style={styles.duration}>{fmtDuration(item.duration_s)}</Text>
              <Text style={styles.durationLabel}>duração</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>Nenhuma sessão registrada.</Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F0F1A" },
  title: { fontSize: 22, fontWeight: "800", color: "#fff", padding: 20, paddingBottom: 12 },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A1A2E",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#2A2A4A",
  },
  cardLeft: { flex: 1, gap: 2 },
  name: { color: "#fff", fontWeight: "700", fontSize: 14 },
  matricula: { color: "#6B7280", fontSize: 12 },
  date: { color: "#6B7280", fontSize: 11, marginTop: 4 },
  cardRight: { alignItems: "flex-end" },
  duration: { color: "#A78BFA", fontWeight: "800", fontSize: 18 },
  durationLabel: { color: "#6B7280", fontSize: 11 },
  empty: { color: "#6B7280", textAlign: "center", marginTop: 60 },
  error: { color: "#F87171", textAlign: "center", margin: 20 },
});
