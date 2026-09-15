import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { triggerHaptic } from "@/lib/sound";

interface PresenceSidebarProps {
  onClose?: () => void;
  style?: any;
}

const ITEM_HEIGHT = 58;
const SEPARATOR_HEIGHT = 6;
const ROW_TOTAL_HEIGHT = ITEM_HEIGHT + SEPARATOR_HEIGHT;

export function PresenceSidebar({ onClose, style }: PresenceSidebarProps) {
  const { members, loading, error } = usePresence();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) =>
      (m.profile?.name ? m.profile.name.toLowerCase().includes(q) : false) ||
      (m.profile?.matricula ? m.profile.matricula.includes(q) : false)
    );
  }, [members, search]);

  const renderItem = useCallback(
    ({ item }: { item: PresentMember }) => <MemoizedSidebarRow member={item} />,
    []
  );

  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: ROW_TOTAL_HEIGHT,
      offset: ROW_TOTAL_HEIGHT * index,
      index,
    }),
    []
  );

  const handleClose = () => {
    triggerHaptic("tap");
    onClose?.();
  };

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
            onPress={handleClose}
            style={styles.closeBtn}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Fechar lista de presentes"
          >
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Busca rápida com ícone e botão de limpar */}
      {members.length > 3 && (
        <View style={styles.searchWrapper}>
          <View style={styles.searchContainer}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              placeholder="Filtrar por nome ou matrícula..."
              placeholderTextColor="#9CA3AF"
              value={search}
              onChangeText={setSearch}
              style={styles.searchInput}
              accessibilityLabel="Filtrar integrantes presentes"
            />
            {search.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearch("")}
                style={styles.clearSearchBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.clearSearchText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#C15F3D" size="small" />
          <Text style={styles.loadingText}>Carregando presenças...</Text>
        </View>
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(m) => String(m.session_id)}
          renderItem={renderItem}
          getItemLayout={getItemLayout}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={styles.list}
          removeClippedSubviews={true}
          initialNumToRender={8}
          maxToRenderPerBatch={10}
          windowSize={7}
          updateCellsBatchingPeriod={50}
          showsVerticalScrollIndicator={false}
          overScrollMode="never"
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>☕</Text>
              <Text style={styles.emptyTitle}>Ninguém por aqui agora</Text>
              <Text style={styles.emptySubtitle}>
                {search
                  ? "Nenhum integrante encontrado para essa busca."
                  : "Os integrantes aparecerão aqui assim que derem Entrada."}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

function SidebarRow({ member }: { member: PresentMember }) {
  const elapsed = useElapsed(member.check_in);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const memberName = member.profile?.name || "Integrante";
  const initials =
    memberName
      .split(" ")
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "IN";

  const avatar = getAvatarColor(memberName);

  return (
    <Animated.View
      style={[
        styles.row,
        {
          opacity: fadeAnim,
        },
      ]}
    >
      <View style={[styles.avatar, { backgroundColor: avatar.bg }]}>
        <Text style={[styles.initials, { color: avatar.text }]}>{initials}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {memberName}
        </Text>
        <View style={styles.statusRow}>
          <View style={styles.liveDot} />
          <Text style={styles.elapsed}>{elapsed}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const MemoizedSidebarRow = React.memo(SidebarRow, (prev, next) => {
  return (
    prev.member.session_id === next.member.session_id &&
    prev.member.check_in === next.member.check_in &&
    prev.member.profile?.name === next.member.profile?.name
  );
});

const styles = StyleSheet.create({
  container: {
    width: 290,
    backgroundColor: "#FFFFFF",
    borderLeftWidth: 1,
    borderLeftColor: "#E5E2DC",
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
    minWidth: 32,
    minHeight: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: "rgba(0, 0, 0, 0.04)",
  },
  closeBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#706E6A",
  },
  title: {
    color: "#171715",
    fontWeight: "700",
    fontSize: 17,
    letterSpacing: -0.3,
  },
  badge: {
    backgroundColor: "#FAF5F0",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "#F0DCD3",
  },
  badgeText: {
    color: "#C15F3D",
    fontWeight: "700",
    fontSize: 12,
  },
  searchWrapper: {
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FAF9F5",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E2DC",
    paddingHorizontal: 10,
    height: 38,
  },
  searchIcon: {
    fontSize: 12,
    marginRight: 6,
    opacity: 0.6,
  },
  searchInput: {
    flex: 1,
    fontSize: 12.5,
    color: "#171715",
    paddingVertical: 0,
  },
  clearSearchBtn: {
    padding: 4,
  },
  clearSearchText: {
    fontSize: 12,
    color: "#9CA3AF",
    fontWeight: "700",
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 32,
  },
  loadingText: {
    color: "#706E6A",
    fontSize: 12,
    fontWeight: "500",
  },
  list: {
    paddingHorizontal: 12,
    paddingBottom: 24,
  },
  separator: {
    height: SEPARATOR_HEIGHT,
  },
  row: {
    height: ITEM_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#ECE9E2",
    shadowColor: "#000",
    shadowOpacity: 0.02,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    fontWeight: "700",
    fontSize: 13,
  },
  info: {
    flex: 1,
    justifyContent: "center",
    gap: 2,
  },
  name: {
    color: "#171715",
    fontWeight: "600",
    fontSize: 13,
    letterSpacing: -0.2,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
  },
  elapsed: {
    color: "#059669",
    fontSize: 11.5,
    fontWeight: "600",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 40,
    paddingHorizontal: 20,
    gap: 6,
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 4,
  },
  emptyTitle: {
    color: "#171715",
    fontSize: 13.5,
    fontWeight: "700",
    textAlign: "center",
  },
  emptySubtitle: {
    color: "#706E6A",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 16,
  },
  error: {
    color: "#DC2626",
    fontSize: 12.5,
    textAlign: "center",
    marginTop: 24,
    paddingHorizontal: 12,
  },
});

