import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
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
import { Feather } from "@expo/vector-icons";

interface PresenceSidebarProps {
  onClose?: () => void;
  style?: any;
  isDark?: boolean;
}

const ITEM_HEIGHT = 58;
const SEPARATOR_HEIGHT = 6;
const ROW_TOTAL_HEIGHT = ITEM_HEIGHT + SEPARATOR_HEIGHT;

export function PresenceSidebar({ onClose, style, isDark = false }: PresenceSidebarProps) {
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
    ({ item }: { item: PresentMember }) => <MemoizedSidebarRow member={item} isDark={isDark} />,
    [isDark]
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
    <View style={[styles.container, isDark && styles.containerDark, style]}>
      <View style={[styles.header, isDark && styles.headerDark]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.title, isDark && styles.titleDark]}>Presentes</Text>
          <View style={[styles.badge, isDark && styles.badgeDark]}>
            <Text style={[styles.badgeText, isDark && styles.badgeTextDark]}>{members.length}</Text>
          </View>
        </View>

        {onClose && (
          <TouchableOpacity
            onPress={handleClose}
            style={[styles.closeBtn, isDark && styles.closeBtnDark]}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Fechar lista de presentes"
          >
            <Feather name="x" size={17} color={isDark ? "#94A3B8" : "#706E6A"} />
          </TouchableOpacity>
        )}
      </View>

      {/* Busca rápida com ícone e botão de limpar */}
      {members.length > 3 && (
        <View style={styles.searchWrapper}>
          <View style={[styles.searchContainer, isDark && styles.searchContainerDark]}>
            <Feather
              name="search"
              size={15}
              color={isDark ? "#64748B" : "#9CA3AF"}
              style={{ marginRight: 6 }}
            />
            <TextInput
              placeholder="Filtrar por nome ou matrícula..."
              placeholderTextColor={isDark ? "#64748B" : "#9CA3AF"}
              value={search}
              onChangeText={setSearch}
              style={[styles.searchInput, isDark && styles.searchInputDark]}
              accessibilityLabel="Filtrar integrantes presentes"
              autoCorrect={false}
              autoCapitalize="none"
              spellCheck={false}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
            {search.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearch("")}
                style={styles.clearSearchBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name="x" size={14} color={isDark ? "#94A3B8" : "#706E6A"} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#C15F3D" size="small" />
          <Text style={[styles.loadingText, isDark && styles.loadingTextDark]}>Carregando presenças...</Text>
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
              <Feather
                name="coffee"
                size={28}
                color={isDark ? "#475569" : "#A8A29E"}
                style={{ marginBottom: 8 }}
              />
              <Text style={[styles.emptyTitle, isDark && styles.emptyTitleDark]}>Ninguém por aqui agora</Text>
              <Text style={[styles.emptySubtitle, isDark && styles.emptySubtitleDark]}>
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

function SidebarRow({ member, isDark }: { member: PresentMember; isDark?: boolean }) {
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
        isDark && styles.rowDark,
        {
          opacity: fadeAnim,
        },
      ]}
    >
      {member.profile?.avatar_url ? (
        <Image
          source={{ uri: member.profile.avatar_url }}
          style={[styles.avatar, { backgroundColor: "#E2E8F0" }]}
        />
      ) : (
        <View style={[styles.avatar, { backgroundColor: avatar.bg }]}>
          <Text style={[styles.initials, { color: avatar.text }]}>{initials}</Text>
        </View>
      )}
      <View style={styles.info}>
        <Text style={[styles.name, isDark && styles.nameDark]} numberOfLines={1}>
          {memberName}
        </Text>
        <View style={styles.statusRow}>
          <View style={styles.liveDot} />
          <Text style={[styles.elapsed, isDark && styles.elapsedDark]}>{elapsed}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const MemoizedSidebarRow = React.memo(SidebarRow, (prev, next) => {
  return (
    prev.isDark === next.isDark &&
    prev.member.session_id === next.member.session_id &&
    prev.member.check_in === next.member.check_in &&
    prev.member.profile?.name === next.member.profile?.name &&
    prev.member.profile?.avatar_url === next.member.profile?.avatar_url
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
  containerDark: {
    backgroundColor: "#0B0F19",
    borderLeftColor: "#1E293B",
  },
  headerDark: {
    borderBottomColor: "#1E293B",
  },
  titleDark: {
    color: "#F8FAFC",
  },
  badgeDark: {
    backgroundColor: "#1E293B",
  },
  badgeTextDark: {
    color: "#F8FAFC",
  },
  closeBtnDark: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  closeBtnTextDark: {
    color: "#F8FAFC",
  },
  searchContainerDark: {
    backgroundColor: "#111827",
    borderColor: "#1E293B",
  },
  searchInputDark: {
    color: "#F8FAFC",
  },
  clearSearchTextDark: {
    color: "#94A3B8",
  },
  loadingTextDark: {
    color: "#94A3B8",
  },
  rowDark: {
    backgroundColor: "#111827",
    borderColor: "#1E293B",
  },
  nameDark: {
    color: "#F8FAFC",
  },
  elapsedDark: {
    color: "#34D399",
  },
  emptyTitleDark: {
    color: "#F8FAFC",
  },
  emptySubtitleDark: {
    color: "#94A3B8",
  },
});

