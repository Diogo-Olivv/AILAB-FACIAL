import { clearTutorToken, getTutorToken, setTutorToken as storeTutorToken } from "@/lib/tutorSession";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { EnrollCapture } from "@/components/EnrollCapture";
import { RefreshCapture } from "@/components/RefreshCapture";
import { TutorPinModal } from "@/components/TutorPinModal";
import { triggerHaptic } from "@/lib/sound";
import { isEnrollmentWindowActive } from "@/lib/enrollmentWindow";
import { useKioskTheme } from "@/lib/theme";

type TabMode = "enroll" | "refresh";

export default function Enroll() {
  const router = useRouter();
  const { initialMode, mode } = useLocalSearchParams<{
    initialMode?: TabMode;
    mode?: TabMode;
    isDark?: string;
  }>();

  const [tutorToken, setTutorTokenState] = useState<string | undefined>(() => getTutorToken());
  const setTutorToken = (token: string) => {
    storeTutorToken(token);
    setTutorTokenState(token);
  };

  // Ao sair da tela de cadastro, a liberação do tutor é encerrada.
  useEffect(() => {
    return () => {
      void clearTutorToken();
    };
  }, []);
  const [pinModalVisible, setPinModalVisible] = useState(false);

  const { isDark, toggleTheme: toggleGlobalTheme } = useKioskTheme();
  const [themeTransitionColor, setThemeTransitionColor] = useState(
    isDark ? "#F8FAFC" : "#090D16"
  );
  const themeFadeAnim = useRef(new Animated.Value(0)).current;
  const [activeTab, setActiveTab] = useState<TabMode>(
    (initialMode || mode) === "refresh" ? "refresh" : "enroll"
  );

  const [containerWidth, setContainerWidth] = useState(320);
  const animatedValue = useRef(
    new Animated.Value((initialMode || mode) === "refresh" ? 1 : 0)
  ).current;
  const contentFadeAnim = useRef(new Animated.Value(1)).current;
  const dragStart = useRef((initialMode || mode) === "refresh" ? 1 : 0);
  const isWebDragging = useRef(false);
  const webDragStartX = useRef(0);
  const webDragStartValue = useRef((initialMode || mode) === "refresh" ? 1 : 0);
  const activeTabRef = useRef<TabMode>((initialMode || mode) === "refresh" ? "refresh" : "enroll");

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    if (!tutorToken && !isEnrollmentWindowActive()) {
      router.replace("/");
    }
  }, [tutorToken, router]);

  const pillWidth = Math.max(0, (containerWidth - 8) / 2);
  const pillTranslateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, pillWidth],
  });

  const updateContentDuringDrag = (target: TabMode) => {
    if (target === "enroll" && !tutorToken) return;
    if (target === activeTabRef.current) return;
    triggerHaptic("tap");
    activeTabRef.current = target;
    setActiveTab(target);
    contentFadeAnim.stopAnimation();
    contentFadeAnim.setValue(0);
    Animated.timing(contentFadeAnim, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  };

  const switchTab = (target: TabMode, tokenOverride?: string) => {
    const effectiveToken = tokenOverride ?? tutorToken;
    if (target === "enroll" && !effectiveToken) {
      triggerHaptic("tap");
      setPinModalVisible(true);
      return;
    }
    triggerHaptic("tap");
    const isChange = target !== activeTabRef.current;
    activeTabRef.current = target;
    setActiveTab(target);

    Animated.spring(animatedValue, {
      toValue: target === "refresh" ? 1 : 0,
      stiffness: 350,
      damping: 28,
      mass: 0.8,
      useNativeDriver: true,
    }).start();

    if (isChange) {
      contentFadeAnim.setValue(0);
      Animated.timing(contentFadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 6,
      onPanResponderGrant: () => {
        dragStart.current = activeTabRef.current === "refresh" ? 1 : 0;
      },
      onPanResponderMove: (_, gesture) => {
        if (pillWidth > 0) {
          const delta = gesture.dx / pillWidth;
          const newVal = Math.max(0, Math.min(1, dragStart.current + delta));
          animatedValue.setValue(newVal);
          updateContentDuringDrag(newVal >= 0.5 ? "refresh" : "enroll");
        }
      },
      onPanResponderRelease: (_, gesture) => {
        const delta = pillWidth > 0 ? gesture.dx / pillWidth : 0;
        const currentPos = dragStart.current + delta;
        const target: TabMode = currentPos > 0.5 ? "refresh" : "enroll";
        if (target === "enroll" && !tutorToken) {
          switchTab("refresh");
          setPinModalVisible(true);
        } else {
          switchTab(target);
        }
      },
      onPanResponderTerminate: () => {
        switchTab(activeTabRef.current);
      },
    })
  ).current;

  const handlePointerDown = (e: any) => {
    if (e.pointerType === "mouse") {
      isWebDragging.current = true;
      dragStart.current = activeTabRef.current === "refresh" ? 1 : 0;
      webDragStartValue.current = dragStart.current;
      webDragStartX.current = e.clientX;
      e.currentTarget?.setPointerCapture?.(e.pointerId);
    }
  };

  const handlePointerMove = (e: any) => {
    if (isWebDragging.current && pillWidth > 0) {
      const delta = (e.clientX - webDragStartX.current) / pillWidth;
      const progress = Math.max(0, Math.min(1, webDragStartValue.current + delta));
      animatedValue.setValue(progress);
      updateContentDuringDrag(progress >= 0.5 ? "refresh" : "enroll");
    }
  };

  const handlePointerUp = (e: any) => {
    if (isWebDragging.current) {
      isWebDragging.current = false;
      e.currentTarget?.releasePointerCapture?.(e.pointerId);
      const delta = pillWidth > 0 ? (e.clientX - webDragStartX.current) / pillWidth : 0;
      const currentPos = Math.max(0, Math.min(1, webDragStartValue.current + delta));
      const target: TabMode = currentPos > 0.5 ? "refresh" : "enroll";
      if (target === "enroll" && !tutorToken) {
        switchTab("refresh");
        setPinModalVisible(true);
      } else {
        switchTab(target);
      }
    }
  };

  if (!tutorToken && !isEnrollmentWindowActive()) {
    return null;
  }

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <Stack.Screen
        options={{
          title: activeTab === "refresh" ? "Recadastro Biométrico" : "Cadastro de Integrante",
          headerStyle: {
            backgroundColor: isDark ? "#0F1623" : "#FFFFFF",
          },
          headerTintColor: isDark ? "#F8FAFC" : "#0F172A",
          headerShadowVisible: false,
          headerRight: () => (
            <TouchableOpacity
              onPress={() => {
                triggerHaptic("tap");
                const nextIsDark = !isDark;
                setThemeTransitionColor(nextIsDark ? "#090D16" : "#F8FAFC");
                Animated.timing(themeFadeAnim, {
                  toValue: 1,
                  duration: 110,
                  useNativeDriver: true,
                }).start(() => {
                  toggleGlobalTheme();
                  Animated.timing(themeFadeAnim, {
                    toValue: 0,
                    duration: 220,
                    useNativeDriver: true,
                  }).start();
                });
              }}
              style={[styles.themeToggleBtn, isDark && styles.themeToggleBtnDark]}
              accessibilityRole="button"
              accessibilityLabel={isDark ? "Mudar para modo claro" : "Mudar para modo escuro"}
              activeOpacity={0.7}
            >
              <Feather
                name={isDark ? "sun" : "moon"}
                size={16}
                color={isDark ? "#FBBF24" : "#334155"}
              />
            </TouchableOpacity>
          ),
        }}
      />

      <View style={styles.responsiveWrapper}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.themeTransitionOverlay,
            { opacity: themeFadeAnim, backgroundColor: themeTransitionColor },
          ]}
        />

        {/* Segmented Control Estilo Linear / Raycast */}
        <View
          style={[styles.tabContainer, isDark && styles.tabContainerDark]}
          onLayout={(e) => {
            const w = e.nativeEvent.layout.width;
            if (w > 0) setContainerWidth(w);
          }}
          {...panResponder.panHandlers}
          // @ts-ignore - props compatíveis com react-native-web
          onPointerDown={handlePointerDown}
          // @ts-ignore
          onPointerMove={handlePointerMove}
          // @ts-ignore
          onPointerUp={handlePointerUp}
          // @ts-ignore
          onPointerCancel={handlePointerUp}
        >
          {pillWidth > 0 && (
            <Animated.View
              style={[
                styles.slidingPill,
                isDark && styles.slidingPillDark,
                {
                  width: pillWidth,
                  transform: [{ translateX: pillTranslateX }],
                },
              ]}
            />
          )}

          <TouchableOpacity
            style={styles.tab}
            onPress={() => switchTab("enroll")}
            activeOpacity={0.7}
            accessibilityRole="tab"
            aria-selected={activeTab === "enroll"}
          >
            <Feather
              name="user-plus"
              size={14}
              color={
                activeTab === "enroll"
                  ? "#EA580C"
                  : isDark
                  ? "#94A3B8"
                  : "#64748B"
              }
            />
            <Text
              style={[
                styles.tabText,
                isDark && styles.tabTextDark,
                activeTab === "enroll" &&
                  (isDark ? styles.tabTextActiveDark : styles.tabTextActive),
              ]}
            >
              Novo Cadastro
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tab}
            onPress={() => switchTab("refresh")}
            activeOpacity={0.7}
            accessibilityRole="tab"
            aria-selected={activeTab === "refresh"}
          >
            <Feather
              name="refresh-cw"
              size={13}
              color={
                activeTab === "refresh"
                  ? "#EA580C"
                  : isDark
                  ? "#94A3B8"
                  : "#64748B"
              }
            />
            <Text
              style={[
                styles.tabText,
                isDark && styles.tabTextDark,
                activeTab === "refresh" &&
                  (isDark ? styles.tabTextActiveDark : styles.tabTextActive),
              ]}
            >
              Recadastro
            </Text>
          </TouchableOpacity>
        </View>

        <Animated.View
          style={[
            styles.contentContainer,
            {
              opacity: contentFadeAnim,
              transform: [
                {
                  translateY: contentFadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [6, 0],
                  }),
                },
              ],
            },
          ]}
        >
          {activeTab === "enroll" ? (
            <EnrollCapture tutorToken={tutorToken} isDark={isDark} />
          ) : (
            <RefreshCapture tutorToken={tutorToken} isDark={isDark} />
          )}
        </Animated.View>
      </View>

      <TutorPinModal
        visible={pinModalVisible}
        onSuccess={(token: string) => {
          setTutorToken(token);
          setPinModalVisible(false);
          switchTab("enroll", token);
        }}
        onCancel={() => {
          setPinModalVisible(false);
          switchTab("refresh");
        }}
        isDark={isDark}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC", alignItems: "center" },
  containerDark: { backgroundColor: "#090D16" },
  themeTransitionOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 100,
  },
  responsiveWrapper: {
    flex: 1,
    width: "100%",
    maxWidth: 680,
  },
  contentContainer: {
    flex: 1,
    width: "100%",
  },
  themeToggleBtn: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 4,
  },
  themeToggleBtnDark: {
    backgroundColor: "#161F30",
    borderColor: "rgba(255, 255, 255, 0.10)",
  },
  tabContainer: {
    position: "relative",
    flexDirection: "row",
    backgroundColor: "#E2E8F0",
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 6,
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  tabContainerDark: {
    backgroundColor: "#161F30",
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  slidingPill: {
    position: "absolute",
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  slidingPillDark: {
    backgroundColor: "#0F1623",
    borderColor: "rgba(255, 255, 255, 0.12)",
    shadowOpacity: 0.4,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
    paddingVertical: 10,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    zIndex: 1,
  },
  tabText: {
    color: "#64748B",
    fontSize: 13.5,
    fontWeight: "600",
  },
  tabTextDark: {
    color: "#94A3B8",
  },
  tabTextActive: {
    color: "#0F172A",
    fontWeight: "800",
  },
  tabTextActiveDark: {
    color: "#F8FAFC",
    fontWeight: "800",
  },
});
