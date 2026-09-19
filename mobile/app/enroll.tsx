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

  useEffect(() => {
    if (!tutorToken) {
      router.replace("/");
    }
  }, [tutorToken, router]);

  const switchTab = (target: TabMode) => {
    if (target === activeTab) return;
    triggerHaptic("tap");
    setActiveTab(target);
    Animated.spring(animatedValue, {
      toValue: target === "refresh" ? 1 : 0,
      tension: 65,
      friction: 9,
      useNativeDriver: true,
    }).start();
  };

  // PanResponder para permitir arrasto (drag) fluido entre as abas estilo iOS
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 10,
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > 30) {
          switchTab("refresh");
        } else if (gesture.dx < -30) {
          switchTab("enroll");
        }
      },
    })
  ).current;

  if (!tutorToken) {
    return null;
  }

  const pillWidth = Math.max(0, (containerWidth - 8) / 2);
  const pillTranslateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, pillWidth],
  });

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
              activeOpacity={0.75}
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
            activeOpacity={0.8}
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
            activeOpacity={0.8}
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

        <View style={styles.contentContainer}>
          {activeTab === "enroll" ? (
            <EnrollCapture tutorToken={tutorToken} isDark={isDark} />
          ) : (
            <RefreshCapture tutorToken={tutorToken} isDark={isDark} />
          )}
        </View>
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
