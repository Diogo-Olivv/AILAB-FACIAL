import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { PresenceCard } from "@/components/PresenceCard";
import { StatsPanel } from "@/components/StatsPanel";
import { usePresence, type PresentMember } from "@/hooks/usePresence";

export default function DashboardScreen() {
  const { members, loading, error, refresh } = usePresence();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const stats = useMemo(() => {
    if (members.length === 0) return { present: 0, avgMinutes: 0 };
    const totalMs = members.reduce(
      (acc, m) => acc + (Date.now() - new Date(m.check_in).getTime()),
      0
    );
    return {
      present: members.length,
      avgMinutes: Math.round(totalMs / members.length / 60_000),
    };
  }, [members]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#6C47FF" />
        <Text style={styles.loadingText}>Carregando presenças…</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <Text style={styles.errorText}>⚠️ {error}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>🧪 AILAB</Text>
          <Text style={styles.subtitle}>Painel de Presença</Text>
        </View>
        <View style={styles.badge}>
          <View style={styles.badgeDot} />
          <Text style={styles.badgeText}>{members.length} presentes</Text>
        </View>
      </View>

      {/* Stats */}
      <StatsPanel present={stats.present} avgMinutes={stats.avgMinutes} />

      {/* Lista */}
      <FlatList
        data={members}
        keyExtractor={(m) => String(m.session_id)}
        renderItem={({ item }: { item: PresentMember }) => (
          <PresenceCard member={item} />
        )}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>🏜️</Text>
            <Text style={styles.emptyText}>Nenhum membro presente no momento.</Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#6C47FF"
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F0F1A",
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  subtitle: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#6C47FF22",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
    borderWidth: 1,
    borderColor: "#6C47FF44",
  },
  badgeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#22C55E",
  },
  badgeText: {
    color: "#A78BFA",
    fontWeight: "700",
    fontSize: 13,
  },
  list: {
    padding: 16,
    paddingTop: 8,
    paddingBottom: 32,
  },
  emptyContainer: {
    alignItems: "center",
    marginTop: 64,
    gap: 12,
  },
  emptyEmoji: {
    fontSize: 48,
  },
  emptyText: {
    color: "#6B7280",
    fontSize: 15,
    textAlign: "center",
  },
  loadingText: {
    color: "#6B7280",
    fontSize: 14,
  },
  errorText: {
    color: "#F87171",
    fontSize: 15,
    textAlign: "center",
    paddingHorizontal: 32,
  },
});
