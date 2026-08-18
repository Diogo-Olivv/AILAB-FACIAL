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
        <ActivityIndicator color="#1E2D5F" style={styles.center} />
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
    width: 300,
    backgroundColor: "#FBF8F1",
    borderLeftWidth: 1,
    borderLeftColor: "rgba(30,45,95,.14)",
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
    color: "#141A33",
    fontWeight: "800",
    fontSize: 17,
  },
  badge: {
    backgroundColor: "rgba(30,45,95,.10)",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "rgba(30,45,95,.20)",
  },
  badgeText: {
    color: "#1E2D5F",
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
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(30,45,95,.14)",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(30,45,95,.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    color: "#1E2D5F",
    fontWeight: "800",
    fontSize: 14,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    color: "#141A33",
    fontWeight: "600",
    fontSize: 14,
  },
  elapsed: {
    color: "#166534",
    fontSize: 12,
    fontWeight: "600",
  },
  empty: {
    color: "#6B6F82",
    fontSize: 13,
    textAlign: "center",
    marginTop: 24,
  },
  error: {
    color: "#DC2626",
    fontSize: 13,
    textAlign: "center",
    marginTop: 24,
    paddingHorizontal: 12,
  },
});
