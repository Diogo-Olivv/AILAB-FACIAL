import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { usePresence, type PresentMember } from "@/hooks/usePresence";
import { useElapsed } from "@/hooks/useElapsed";
import { getAvatarColor } from "@/lib/config";

interface PresenceSidebarProps {
  onClose?: () => void;
  style?: any;
}

export function PresenceSidebar({ onClose, style }: PresenceSidebarProps) {
  const { members, loading, error } = usePresence();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) =>
      m.profile.name.toLowerCase().includes(q) ||
      (m.profile.matricula ? m.profile.matricula.includes(q) : false)
    );
  }, [members, search]);

  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Presentes</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{members.length}</Text>
          </View>
        </View>

        {onClose && (
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel="Fechar lista de presentes"
          >
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Busca rápida se houver mais de 5 integrantes */}
      {members.length > 5 && (
        <View style={styles.searchWrapper}>
          <TextInput
            placeholder="Filtrar por nome..."
            placeholderTextColor="#6B6F82"
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
            accessibilityLabel="Filtrar integrantes presentes"
          />
        </View>
      )}

      {loading ? (
        <ActivityIndicator color="#1E2D5F" style={styles.center} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(m) => String(m.session_id)}
          renderItem={({ item }) => <SidebarRow member={item} />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {search ? "Nenhum resultado para a busca." : "Nenhum integrante no laboratório agora."}
            </Text>
          }
        />
      )}
    </View>
  );
}

function SidebarRow({ member }: { member: PresentMember }) {
  const elapsed = useElapsed(member.check_in);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(6)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const initials = member.profile.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const avatar = getAvatarColor(member.profile.name);

  return (
    <Animated.View
      style={[
        styles.row,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={[styles.avatar, { backgroundColor: avatar.bg }]}>
        <Text style={[styles.initials, { color: avatar.text }]}>{initials}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {member.profile.name}
        </Text>
        <Text style={styles.elapsed}>⏱️ {elapsed}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 290,
    backgroundColor: "#FFFFFF",
    borderLeftWidth: 1,
    borderLeftColor: "rgba(0, 0, 0, 0.06)",
    paddingTop: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#475569",
  },
  title: {
    color: "#0F172A",
    fontWeight: "800",
    fontSize: 18,
    letterSpacing: -0.3,
  },
  badge: {
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "rgba(37, 99, 235, 0.2)",
  },
  badgeText: {
    color: "#2563EB",
    fontWeight: "700",
    fontSize: 13,
  },
  searchWrapper: {
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  searchInput: {
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.05)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: "#0F172A",
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
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.06)",
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    fontWeight: "800",
    fontSize: 14,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    color: "#0F172A",
    fontWeight: "700",
    fontSize: 14.5,
  },
  elapsed: {
    color: "#059669",
    fontSize: 12.5,
    fontWeight: "600",
  },
  empty: {
    color: "#64748B",
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
