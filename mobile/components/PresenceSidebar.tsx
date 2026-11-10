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
import { KioskAvatar } from "@/components/KioskAvatar";
import { triggerHaptic } from "@/lib/sound";
import { Feather } from "@expo/vector-icons";

interface PresenceSidebarProps {
  onClose?: () => void;
  style?: any;
  isDark?: boolean;
}

const ITEM_HEIGHT = 60;
const SEPARATOR_HEIGHT = 6;
const ROW_TOTAL_HEIGHT = ITEM_HEIGHT + SEPARATOR_HEIGHT;

function getCrowdTag(count: number, isDark: boolean) {
  if (count >= 8) {
    return {
      label: "Cheio",
      bg: isDark ? "rgba(244, 63, 94, 0.16)" : "rgba(244, 63, 94, 0.10)",
      border: isDark ? "rgba(244, 63, 94, 0.32)" : "rgba(244, 63, 94, 0.25)",
      text: isDark ? "#FB7185" : "#E11D48",
      dot: "#F43F5E",
    };
  }
  if (count >= 3) {
    return {
      label: "Moderado",
      bg: isDark ? "rgba(245, 158, 11, 0.16)" : "rgba(245, 158, 11, 0.12)",
      border: isDark ? "rgba(245, 158, 11, 0.32)" : "rgba(245, 158, 11, 0.28)",
      text: isDark ? "#FBBF24" : "#D97706",
      dot: "#F59E0B",
    };
  }
  return {
    label: "Tranquilo",
    bg: isDark ? "rgba(16, 185, 129, 0.16)" : "rgba(16, 185, 129, 0.10)",
    border: isDark ? "rgba(16, 185, 129, 0.32)" : "rgba(16, 185, 129, 0.25)",
    text: isDark ? "#34D399" : "#059669",
    dot: "#10B981",
  };
}

export function PresenceSidebar({ onClose, style, isDark = false }: PresenceSidebarProps) {
  const { members, loading, error } = usePresence();
  const activeTutors = useMemo(() => members.filter((m) => m.profile?.is_tutor), [members]);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        (m.profile?.name ? m.profile.name.toLowerCase().includes(q) : false) ||
        (m.profile?.matricula ? m.profile.matricula.includes(q) : false)
    );
  }, [members, search]);

  const sortedMembers = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aTutor = Boolean(a.profile?.is_tutor);
      const bTutor = Boolean(b.profile?.is_tutor);
      if (aTutor && !bTutor) return -1;
      if (!aTutor && bTutor) return 1;
      return 0;
    });
  }, [filtered]);

  const renderItem = useCallback(
    ({ item }: { item: PresentMember }) => (
      <MemoizedSidebarRow member={item} isDark={isDark} />
    ),
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

  const crowd = getCrowdTag(members.length, isDark);

  return (
    <View style={[styles.container, isDark && styles.containerDark, style]}>
      {/* Cabeçalho com Contador Tabular + Semáforo de Lotação */}
      <View style={[styles.header, isDark && styles.headerDark]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.title, isDark && styles.titleDark]}>Presentes</Text>
          <View style={[styles.badge, isDark && styles.badgeDark]}>
            <Text style={[styles.badgeText, isDark && styles.badgeTextDark]}>
              {members.length}
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <View
            style={[
              styles.crowdPill,
              { backgroundColor: crowd.bg, borderColor: crowd.border },
            ]}
          >
            <View style={[styles.crowdDot, { backgroundColor: crowd.dot }]} />
            <Text style={[styles.crowdText, { color: crowd.text }]}>{crowd.label}</Text>
          </View>

          {onClose && (
            <TouchableOpacity
              onPress={handleClose}
              style={[styles.closeBtn, isDark && styles.closeBtnDark]}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Fechar lista de presentes"
            >
              <Feather name="x" size={17} color={isDark ? "#94A3B8" : "#64748B"} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Banner de Tutor Ativo no Laboratório */}
      {activeTutors.length > 0 && (
        <View style={[styles.tutorBanner, isDark && styles.tutorBannerDark]}>
          <View style={[styles.tutorBannerIconWrap, isDark && styles.tutorBannerIconWrapDark]}>
            <Feather name="award" size={14} color={isDark ? "#FB923C" : "#EA580C"} />
          </View>
          <View style={styles.tutorBannerTextWrap}>
            <Text style={[styles.tutorBannerTitle, isDark && styles.tutorBannerTitleDark]}>
              Tutor no Laboratório
            </Text>
            <Text
              style={[styles.tutorBannerName, isDark && styles.tutorBannerNameDark]}
              numberOfLines={1}
            >
              {activeTutors.map((t) => t.profile.name).join(", ")}
            </Text>
          </View>
        </View>
      )}

      {/* Busca Rápida */}
      {(members.length >= 2 || search.length > 0) && (
        <View style={styles.searchWrapper}>
          <View style={[styles.searchContainer, isDark && styles.searchContainerDark]}>
            <Feather
              name="search"
              size={14}
              color={isDark ? "#64748B" : "#94A3B8"}
              style={{ marginRight: 6 }}
            />
            <TextInput
              placeholder="Buscar presente..."
              placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
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
                <Feather name="x" size={14} color={isDark ? "#94A3B8" : "#64748B"} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#EA580C" size="small" />
          <Text style={[styles.loadingText, isDark && styles.loadingTextDark]}>
            Sincronizando presenças...
          </Text>
        </View>
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <FlatList
          data={sortedMembers}
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
              <View style={[styles.emptyIconBox, isDark && styles.emptyIconBoxDark]}>
                <Feather
                  name="coffee"
                  size={22}
                  color={isDark ? "#64748B" : "#94A3B8"}
                />
              </View>
              <Text style={[styles.emptyTitle, isDark && styles.emptyTitleDark]}>
                {search ? "Nenhum resultado" : "Laboratório livre"}
              </Text>
              <Text style={[styles.emptySubtitle, isDark && styles.emptySubtitleDark]}>
                {search
                  ? "Nenhum integrante presente corresponde à busca."
                  : "Os integrantes aparecerão aqui assim que registrarem Entrada."}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

function SidebarRow({ member, isDark = false }: { member: PresentMember; isDark?: boolean }) {
  const elapsed = useElapsed(member.check_in);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const memberName = member.profile?.name || "Integrante";
  const isTutor = Boolean(member.profile?.is_tutor);

  return (
    <Animated.View
      style={[
        styles.row,
        isDark && styles.rowDark,
        isTutor && (isDark ? styles.rowTutorDark : styles.rowTutor),
        { opacity: fadeAnim },
      ]}
    >
      <KioskAvatar
        name={memberName}
        uri={member.profile?.avatar_url}
        size={38}
        isTutor={isTutor}
        online={true}
        isDark={isDark}
      />
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text
            style={[styles.name, isDark && styles.nameDark, isTutor && styles.nameTutor]}
            numberOfLines={1}
          >
            {memberName}
          </Text>
          {isTutor && (
            <View style={[styles.tutorBadgePill, isDark && styles.tutorBadgePillDark]}>
              <Text
                style={[
                  styles.tutorBadgePillText,
                  isDark && styles.tutorBadgePillTextDark,
                ]}
              >
                TUTOR
              </Text>
            </View>
          )}
        </View>
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
    prev.member.profile?.avatar_url === next.member.profile?.avatar_url &&
    prev.member.profile?.is_tutor === next.member.profile?.is_tutor
  );
});

const styles = StyleSheet.create({
  container: {
    width: 300,
    backgroundColor: "#FFFFFF",
    borderLeftWidth: 1,
    borderLeftColor: "#E2E8F0",
    paddingTop: 14,
  },
  containerDark: {
    backgroundColor: "#0F1623",
    borderLeftColor: "rgba(255, 255, 255, 0.08)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    marginBottom: 10,
  },
  headerDark: {
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    color: "#0F172A",
    fontWeight: "800",
    fontSize: 16,
    letterSpacing: -0.3,
  },
  titleDark: {
    color: "#F8FAFC",
  },
  badge: {
    backgroundColor: "#F1F5F9",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  badgeDark: {
    backgroundColor: "#161F30",
    borderColor: "rgba(255, 255, 255, 0.10)",
  },
  badgeText: {
    color: "#0F172A",
    fontWeight: "800",
    fontSize: 11.5,
    fontVariant: ["tabular-nums"],
  },
  badgeTextDark: {
    color: "#F8FAFC",
  },
  crowdPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  crowdDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  crowdText: {
    fontSize: 10.5,
    fontWeight: "800",
  },
  closeBtn: {
    width: 36,
    height: 36,
    minWidth: 36,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
  },
  closeBtnDark: {
    backgroundColor: "#161F30",
  },
  tutorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    backgroundColor: "rgba(234, 88, 12, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(234, 88, 12, 0.25)",
    borderRadius: 12,
    marginHorizontal: 12,
    marginBottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  tutorBannerDark: {
    backgroundColor: "rgba(249, 115, 22, 0.12)",
    borderColor: "rgba(249, 115, 22, 0.30)",
  },
  tutorBannerIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(234, 88, 12, 0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  tutorBannerIconWrapDark: {
    backgroundColor: "rgba(249, 115, 22, 0.22)",
  },
  tutorBannerTextWrap: {
    flex: 1,
    gap: 1,
  },
  tutorBannerTitle: {
    fontSize: 10,
    fontWeight: "800",
    color: "#EA580C",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  tutorBannerTitleDark: {
    color: "#FB923C",
  },
  tutorBannerName: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#0F172A",
  },
  tutorBannerNameDark: {
    color: "#F8FAFC",
  },
  searchWrapper: {
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 10,
    height: 38,
  },
  searchContainerDark: {
    backgroundColor: "#161F30",
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  searchInput: {
    flex: 1,
    fontSize: 12.5,
    color: "#0F172A",
    paddingVertical: 0,
  },
  searchInputDark: {
    color: "#F8FAFC",
  },
  clearSearchBtn: {
    padding: 4,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 32,
  },
  loadingText: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "600",
  },
  loadingTextDark: {
    color: "#94A3B8",
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
    backgroundColor: "#F8FAFC",
    borderRadius: 13,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  rowDark: {
    backgroundColor: "#161F30",
    borderColor: "rgba(255, 255, 255, 0.07)",
  },
  rowTutor: {
    borderColor: "rgba(234, 88, 12, 0.28)",
    backgroundColor: "rgba(234, 88, 12, 0.04)",
  },
  rowTutorDark: {
    borderColor: "rgba(249, 115, 22, 0.30)",
    backgroundColor: "rgba(249, 115, 22, 0.08)",
  },
  info: {
    flex: 1,
    justifyContent: "center",
    gap: 2,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  name: {
    color: "#0F172A",
    fontWeight: "700",
    fontSize: 13,
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  nameDark: {
    color: "#F8FAFC",
  },
  nameTutor: {
    fontWeight: "800",
  },
  tutorBadgePill: {
    backgroundColor: "rgba(234, 88, 12, 0.12)",
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "rgba(234, 88, 12, 0.28)",
  },
  tutorBadgePillDark: {
    backgroundColor: "rgba(249, 115, 22, 0.18)",
    borderColor: "rgba(249, 115, 22, 0.35)",
  },
  tutorBadgePillText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#EA580C",
    letterSpacing: 0.4,
  },
  tutorBadgePillTextDark: {
    color: "#FB923C",
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
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  elapsedDark: {
    color: "#34D399",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 40,
    paddingHorizontal: 20,
    gap: 6,
  },
  emptyIconBox: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyIconBoxDark: {
    backgroundColor: "#161F30",
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  emptyTitle: {
    color: "#0F172A",
    fontSize: 13.5,
    fontWeight: "800",
    textAlign: "center",
  },
  emptyTitleDark: {
    color: "#F8FAFC",
  },
  emptySubtitle: {
    color: "#64748B",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 17,
  },
  emptySubtitleDark: {
    color: "#94A3B8",
  },
  error: {
    color: "#E11D48",
    fontSize: 12.5,
    textAlign: "center",
    marginTop: 24,
    paddingHorizontal: 12,
  },
});
