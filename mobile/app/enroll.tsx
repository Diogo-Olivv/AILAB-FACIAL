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
import { triggerHaptic } from "@/lib/sound";

type TabMode = "enroll" | "refresh";

export default function Enroll() {
  const router = useRouter();
  const { tutorToken, initialMode, mode, isDark: isDarkParam } = useLocalSearchParams<{
    tutorToken?: string;
    initialMode?: TabMode;
    mode?: TabMode;
    isDark?: string;
  }>();

  const [isDark, setIsDark] = useState(isDarkParam === "true");
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
    if (!tutorToken) {
      router.replace("/");
    }
  }, [tutorToken, router]);

  const pillWidth = Math.max(0, (containerWidth - 8) / 2);
  const pillTranslateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, pillWidth],
  });

  const switchTab = (target: TabMode) => {
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
        duration: 220,
        useNativeDriver: true,
      }).start();
    }
  };

  // PanResponder fluido para touch com arrasto em tempo real estilo iOS
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
        }
      },
      onPanResponderRelease: (_, gesture) => {
        const delta = pillWidth > 0 ? gesture.dx / pillWidth : 0;
        const currentPos = dragStart.current + delta;
        const target: TabMode = currentPos > 0.5 ? "refresh" : "enroll";
        switchTab(target);
      },
      onPanResponderTerminate: () => {
        switchTab(activeTabRef.current);
      },
    })
  ).current;

  // Suporte a arrasto de ponteiro/mouse na web
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
    }
  };

  const handlePointerUp = (e: any) => {
    if (isWebDragging.current) {
      isWebDragging.current = false;
      e.currentTarget?.releasePointerCapture?.(e.pointerId);
      const delta = pillWidth > 0 ? (e.clientX - webDragStartX.current) / pillWidth : 0;
      const currentPos = Math.max(0, Math.min(1, webDragStartValue.current + delta));
      switchTab(currentPos > 0.5 ? "refresh" : "enroll");
    }
  };

  if (!tutorToken) {
    return null;
  }

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <Stack.Screen
        options={{
          title: activeTab === "refresh" ? "Recadastro Biométrico" : "Cadastro de Integrante",
          headerStyle: {
            backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
          },
          headerTintColor: isDark ? "#F8FAFC" : "#171715",
          headerShadowVisible: false,
          headerRight: () => (
            <TouchableOpacity
              onPress={() => {
                triggerHaptic("tap");
                setIsDark((prev) => !prev);
              }}
              style={[styles.themeToggleBtn, isDark && styles.themeToggleBtnDark]}
              accessibilityRole="button"
              accessibilityLabel={isDark ? "Mudar para modo claro" : "Mudar para modo escuro"}
              activeOpacity={0.7}
            >
              <Feather
                name={isDark ? "sun" : "moon"}
                size={17}
                color={isDark ? "#F8FAFC" : "#171715"}
              />
            </TouchableOpacity>
          ),
        }}
      />

      <View style={styles.responsiveWrapper}>
        {/* Segmented control Fluido iOS com Arraste (Drag) e Pílula Deslizante */}
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
          {/* Pílula Deslizante com Física de Mola iOS */}
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
            <Text
              style={[
                styles.tabText,
                isDark && styles.tabTextDark,
                activeTab === "enroll" && (isDark ? styles.tabTextActiveDark : styles.tabTextActive),
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
            <Text
              style={[
                styles.tabText,
                isDark && styles.tabTextDark,
                activeTab === "refresh" && (isDark ? styles.tabTextActiveDark : styles.tabTextActive),
              ]}
            >
              Recadastro
            </Text>
          </TouchableOpacity>
        </View>

        {/* Conteúdo com transição animada de fade e slide suave */}
        <Animated.View
          style={[
            styles.contentContainer,
            {
              opacity: contentFadeAnim,
              transform: [
                {
                  translateY: contentFadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [8, 0],
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAF9F5", alignItems: "center" },
  containerDark: { backgroundColor: "#0B0F19" },
  responsiveWrapper: {
    flex: 1,
    width: "100%",
    maxWidth: 640,
  },
  contentContainer: {
    flex: 1,
    width: "100%",
  },
  themeToggleBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 4,
  },
  themeToggleBtnDark: {
    backgroundColor: "#1E293B",
  },
  tabContainer: {
    position: "relative",
    flexDirection: "row",
    backgroundColor: "rgba(0, 0, 0, 0.04)",
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 8,
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.04)",
  },
  tabContainerDark: {
    backgroundColor: "#1E293B",
    borderColor: "#334155",
  },
  slidingPill: {
    position: "absolute",
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.06)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  slidingPillDark: {
    backgroundColor: "#0F172A",
    borderColor: "#334155",
    shadowOpacity: 0.3,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    zIndex: 1,
  },
  tabText: {
    color: "#78716C",
    fontSize: 13.5,
    fontWeight: "600",
  },
  tabTextDark: {
    color: "#94A3B8",
  },
  tabTextActive: {
    color: "#171715",
    fontWeight: "800",
  },
  tabTextActiveDark: {
    color: "#F8FAFC",
    fontWeight: "800",
  },
});
