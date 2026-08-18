import React from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { usePresence, type PresentMember } from "@/hooks/usePresence";
import { useElapsed } from "@/hooks/useElapsed";

export function PresenceSidebar() {
  const { members, loading, error } = usePresence();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Presentes</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{members.length}</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color="#6C47FF" style={styles.center} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <FlatList
          data={members}
          keyExtractor={(m) => String(m.session_id)}
          renderItem={({ item }) => <SidebarRow member={item} />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>Ninguem presente.</Text>}
        />
      )}
    </View>
  );
}

function SidebarRow({ member }: { member: PresentMember }) {
  const elapsed = useElapsed(member.check_in);
  const initials = member.profile.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <View style={styles.row}>
      <View style={styles.avatar}>
        <Text style={styles.initials}>{initials}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {member.profile.name}
        </Text>
        <Text style={styles.elapsed}>{elapsed}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 220,
    backgroundColor: "#12121F",
    borderLeftWidth: 1,
    borderLeftColor: "#2A2A4A",
    paddingTop: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  title: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 16,
  },
  badge: {
    backgroundColor: "#6C47FF22",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "#6C47FF44",
  },
  badgeText: {
    color: "#A78BFA",
    fontWeight: "700",
    fontSize: 13,
  },
  center: {
    marginTop: 24,
  },
  list: {
    paddingHorizontal: 12,
    paddingBottom: 24,
  },
  separator: {
    height: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#1A1A2E",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#2A2A4A",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#6C47FF22",
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    color: "#6C47FF",
    fontWeight: "800",
    fontSize: 13,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 13,
  },
  elapsed: {
    color: "#22C55E",
    fontSize: 12,
    fontWeight: "600",
  },
  empty: {
    color: "#6B7280",
    fontSize: 13,
    textAlign: "center",
    marginTop: 24,
  },
  error: {
    color: "#F87171",
    fontSize: 13,
    textAlign: "center",
    marginTop: 24,
    paddingHorizontal: 12,
  },
});
