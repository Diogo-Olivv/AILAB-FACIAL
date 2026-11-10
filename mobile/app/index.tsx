import { clearTutorToken, setTutorToken } from "@/lib/tutorSession";
import { useKioskIdentity } from "@/lib/kioskIdentity";
import { KioskProvisionModal } from "@/components/KioskProvisionModal";
import React, { useEffect, useMemo, useState } from "react";
import {
  Animated,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { RecognitionPanel } from "@/components/RecognitionPanel";
import { PresenceSidebar } from "@/components/PresenceSidebar";
import { TutorPinModal } from "@/components/TutorPinModal";
import { TermsModal } from "@/components/TermsModal";
import { triggerHaptic } from "@/lib/sound";
import { Feather } from "@expo/vector-icons";
import { isEnrollmentWindowActive } from "@/lib/enrollmentWindow";
import { usePresence } from "@/hooks/usePresence";
import { useKioskTheme } from "@/lib/theme";

const logo = require("../assets/ailab_makers.jpeg");

function formatClock(date: Date): string {
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isCompact = width < 768;
  const isUltraCompact = width < 480;

  const { isDark, toggleTheme: toggleGlobalTheme } = useKioskTheme();
  const [themeTransitionColor, setThemeTransitionColor] = useState("#090D16");
  const themeFadeAnim = React.useRef(new Animated.Value(0)).current;
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [termsVisible, setTermsVisible] = useState(false);
  const [presenceModalVisible, setPresenceModalVisible] = useState(false);
  const [pendingMode, setPendingMode] = useState<"enroll" | "refresh" | "provision">("enroll");
  const [provisionToken, setProvisionToken] = useState<string | null>(null);
  const kioskStatus = useKioskIdentity();
  const [clockText, setClockText] = useState<string>(() => formatClock(new Date()));

  const { members } = usePresence();
  const activeTutor = useMemo(() => members.find((m) => m.profile?.is_tutor), [members]);

  useEffect(() => {
    setClockText(formatClock(new Date()));
    const interval = setInterval(() => {
      setClockText(formatClock(new Date()));
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const toggleTheme = () => {
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
  };

  const openTutorAuth = (mode: "enroll" | "refresh") => {
    triggerHaptic("tap");
    if (mode === "refresh" && isEnrollmentWindowActive()) {
      router.push({
        pathname: "/enroll",
        params: { initialMode: "refresh", mode: "refresh", isDark: String(isDark) },
      });
      return;
    }
    setPendingMode(mode);
    setPinModalVisible(true);
  };

  return (
    <View style={[styles.safe, isDark && styles.safeDark]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.themeTransitionOverlay,
          { opacity: themeFadeAnim, backgroundColor: themeTransitionColor },
        ]}
      />

      {/* Faixa Superior Institucional AILAB Makers (Laranja, Esmeralda e Índigo) */}
      <View style={styles.brandStripeContainer}>
        <View style={[styles.brandStripeSegment, { backgroundColor: "#EA580C" }]} />
        <View style={[styles.brandStripeSegment, { backgroundColor: "#10B981" }]} />
        <View style={[styles.brandStripeSegment, { backgroundColor: "#6366F1" }]} />
      </View>

      {/* Header Executivo do Totem */}
      <View
        style={[
          styles.header,
          isDark && styles.headerDark,
          {
            paddingTop: Math.max(insets.top, 8) + 6,
            paddingLeft: Math.max(insets.left, 14),
            paddingRight: Math.max(insets.right, 14),
          },
        ]}
      >
        {/* Esquerda: Marca + Status Ao Vivo + Relógio + Tutor no Lab */}
        <View style={styles.brand}>
          <Image source={logo} style={[styles.brandLogo, isDark && styles.brandLogoDark]} />
          <View style={styles.brandTextGroup}>
            <View style={styles.titleRow}>
              <Text style={[styles.title, isDark && styles.titleDark]} numberOfLines={1}>
                AILAB <Text style={styles.titleAccent}>Makers</Text>
              </Text>
              {!isUltraCompact && (
                <View style={[styles.clockPill, isDark && styles.clockPillDark]}>
                  <Feather
                    name="clock"
                    size={11}
                    color={isDark ? "#94A3B8" : "#64748B"}
                  />
                  <Text style={[styles.clockText, isDark && styles.clockTextDark]}>
                    {clockText}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.statusPillsRow}>
              <View style={[styles.statusPill, isDark && styles.statusPillDark]}>
                <View style={styles.statusDot} />
                <Text style={[styles.statusText, isDark && styles.statusTextDark]}>
                  Totem Ativo
                </Text>
              </View>

              {activeTutor && (
                <View style={[styles.tutorHeaderPill, isDark && styles.tutorHeaderPillDark]}>
                  <Feather name="award" size={11} color={isDark ? "#FB923C" : "#EA580C"} />
                  <Text
                    style={[styles.tutorHeaderPillText, isDark && styles.tutorHeaderPillTextDark]}
                    numberOfLines={1}
                  >
                    Tutor: {activeTutor.profile.name.split(" ")[0]}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Direita: Controles do Quiosque (Alvos de 44px — Lei de Fitts) */}
        <View style={styles.headerActions}>
          {/* Alternador de Tema */}
          <TouchableOpacity
            style={[styles.iconBtn, isDark && styles.iconBtnDark]}
            onPress={toggleTheme}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={isDark ? "Alternar para modo claro" : "Alternar para modo escuro"}
          >
            <Feather
              name={isDark ? "sun" : "moon"}
              size={16}
              color={isDark ? "#FBBF24" : "#334155"}
            />
          </TouchableOpacity>

          {/* Termos LGPD */}
          <TouchableOpacity
            style={[
              isUltraCompact ? styles.iconBtn : styles.secondaryBtn,
              isDark && (isUltraCompact ? styles.iconBtnDark : styles.secondaryBtnDark),
            ]}
            onPress={() => {
              triggerHaptic("tap");
              setTermsVisible(true);
            }}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Abrir termos de privacidade e LGPD"
          >
            <Feather
              name="shield"
              size={14}
              color={isDark ? "#FB923C" : "#EA580C"}
            />
            {!isUltraCompact && (
              <Text style={[styles.secondaryBtnText, isDark && styles.secondaryBtnTextDark]}>
                LGPD
              </Text>
            )}
          </TouchableOpacity>

          {/* Em telas compactas (< 768px): Botão Presentes com Contador Ao Vivo */}
          {isCompact && (
            <TouchableOpacity
              style={[styles.secondaryBtn, isDark && styles.secondaryBtnDark]}
              onPress={() => {
                triggerHaptic("tap");
                setPresenceModalVisible(true);
              }}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={`Ver ${members.length} integrantes presentes no laboratório`}
            >
              <Feather
                name="users"
                size={14}
                color={isDark ? "#34D399" : "#059669"}
              />
              {!isUltraCompact && (
                <Text style={[styles.secondaryBtnText, isDark && styles.secondaryBtnTextDark]}>
                  Presentes
                </Text>
              )}
              <View style={[styles.countPill, isDark && styles.countPillDark]}>
                <Text style={[styles.countPillText, isDark && styles.countPillTextDark]}>
                  {members.length}
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {!isCompact && (
            <View style={[styles.headerDivider, isDark && styles.headerDividerDark]} />
          )}

          {/* Recadastrar */}
          <TouchableOpacity
            style={[styles.secondaryBtn, isDark && styles.secondaryBtnDark]}
            onPress={() => {
              if (isEnrollmentWindowActive()) {
                triggerHaptic("tap");
                router.push({
                  pathname: "/enroll",
                  params: {
                    initialMode: "refresh",
                    isDark: isDark ? "true" : "false",
                  },
                });
              } else {
                openTutorAuth("refresh");
              }
            }}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Recadastrar biometria facial"
          >
            <Feather
              name="refresh-cw"
              size={13}
              color={isDark ? "#CBD5E1" : "#334155"}
            />
            {!isUltraCompact && (
              <Text style={[styles.secondaryBtnText, isDark && styles.secondaryBtnTextDark]}>
                Recadastrar
              </Text>
            )}
          </TouchableOpacity>

          {/* Cadastrar (Ação Primária Institucional) */}
          <TouchableOpacity
            style={styles.registerBtn}
            onPress={() => openTutorAuth("enroll")}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Cadastrar novo integrante"
          >
            <Feather name="user-plus" size={14} color="#FFFFFF" />
            <Text style={styles.registerBtnText}>Cadastrar</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Corpo Principal: Visor da Câmera + Sidebar de Presentes */}
      <View
        style={[
          styles.body,
          {
            paddingLeft: insets.left,
            paddingRight: insets.right,
            paddingBottom: insets.bottom,
          },
        ]}
      >
        <View style={[styles.cameraColumn, isCompact && styles.cameraColumnCompact]}>
          {kioskStatus === "provisioned" ? (
            <RecognitionPanel isDark={isDark} />
          ) : (
            <View
              style={[styles.activationCard, isDark && styles.activationCardDark]}
              accessibilityRole="summary"
            >
              <Feather name="tablet" size={34} color={isDark ? "#FB923C" : "#EA580C"} />
              <Text style={[styles.activationTitle, isDark && styles.activationTitleDark]}>
                {kioskStatus === "loading" ? "Verificando o dispositivo…" : "Totem não ativado"}
              </Text>
              {kioskStatus === "unprovisioned" && (
                <>
                  <Text style={[styles.activationText, isDark && styles.activationTextDark]}>
                    Este dispositivo ainda não tem autorização para registrar presença.
                    Um tutor precisa ativá-lo.
                  </Text>
                  <TouchableOpacity
                    style={styles.activationBtn}
                    onPress={() => {
                      triggerHaptic("tap");
                      setPendingMode("provision");
                      setPinModalVisible(true);
                    }}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel="Ativar este totem com login de tutor"
                  >
                    <Feather name="key" size={16} color="#FFFFFF" />
                    <Text style={styles.activationBtnText}>Sou tutor — ativar totem</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}
        </View>

        {!isCompact && <PresenceSidebar isDark={isDark} />}
      </View>

      {/* Modal de Presentes para Telas Compactas / Smartphones */}
      {isCompact && (
        <Modal
          visible={presenceModalVisible}
          animationType="slide"
          onRequestClose={() => setPresenceModalVisible(false)}
        >
          <View
            style={[
              styles.presenceModalContent,
              isDark && styles.presenceModalContentDark,
              { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 },
            ]}
          >
            <PresenceSidebar
              onClose={() => setPresenceModalVisible(false)}
              style={styles.presenceModalSidebar}
              isDark={isDark}
            />
          </View>
        </Modal>
      )}

      <TutorPinModal
        visible={pinModalVisible}
        isDark={isDark}
        onSuccess={(token: string) => {
          setPinModalVisible(false);
          if (pendingMode === "provision") {
            // Ativação do totem: o token do tutor fica só neste estado, em memória.
            setProvisionToken(token);
            return;
          }
          setTutorToken(token);
          router.push({
            pathname: "/enroll",
            params: {
              initialMode: pendingMode,
              isDark: isDark ? "true" : "false",
            },
          });
        }}
        onCancel={() => setPinModalVisible(false)}
      />

      <KioskProvisionModal
        visible={provisionToken !== null}
        tutorToken={provisionToken}
        isDark={isDark}
        onDone={() => {
          setProvisionToken(null);
          void clearTutorToken();
        }}
        onCancel={() => {
          setProvisionToken(null);
          void clearTutorToken();
        }}
      />

      <TermsModal
        visible={termsVisible}
        onClose={() => setTermsVisible(false)}
        isDark={isDark}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  activationCard: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    padding: 28,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
  },
  activationCardDark: { backgroundColor: "#0F1623", borderColor: "rgba(255, 255, 255, 0.08)" },
  activationTitle: { fontSize: 22, fontWeight: "800", color: "#0F172A", textAlign: "center" },
  activationTitleDark: { color: "#F8FAFC" },
  activationText: { fontSize: 15, lineHeight: 22, color: "#475569", textAlign: "center", maxWidth: 420 },
  activationTextDark: { color: "#CBD5E1" },
  activationBtn: {
    minHeight: 64,
    paddingHorizontal: 26,
    borderRadius: 16,
    backgroundColor: "#EA580C",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  activationBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  safe: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  safeDark: {
    backgroundColor: "#090D16",
  },
  themeTransitionOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 100,
  },
  brandStripeContainer: {
    height: 3,
    width: "100%",
    flexDirection: "row",
  },
  brandStripeSegment: {
    flex: 1,
    height: "100%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    paddingBottom: 10,
    gap: 10,
  },
  headerDark: {
    backgroundColor: "#0F1623",
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexShrink: 1,
  },
  brandLogo: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  brandLogoDark: {
    borderColor: "rgba(255, 255, 255, 0.14)",
  },
  brandTextGroup: {
    gap: 2,
    flexShrink: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    color: "#0F172A",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  titleDark: {
    color: "#F8FAFC",
  },
  titleAccent: {
    color: "#EA580C",
  },
  clockPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  clockPillDark: {
    backgroundColor: "#161F30",
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  clockText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
    fontVariant: ["tabular-nums"],
  },
  clockTextDark: {
    color: "#CBD5E1",
  },
  statusPillsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(16, 185, 129, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.25)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  statusPillDark: {
    backgroundColor: "rgba(16, 185, 129, 0.14)",
    borderColor: "rgba(16, 185, 129, 0.30)",
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
  },
  statusText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#059669",
    letterSpacing: 0.1,
  },
  statusTextDark: {
    color: "#34D399",
  },
  tutorHeaderPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(234, 88, 12, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(234, 88, 12, 0.25)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  tutorHeaderPillDark: {
    backgroundColor: "rgba(249, 115, 22, 0.15)",
    borderColor: "rgba(249, 115, 22, 0.32)",
  },
  tutorHeaderPillText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#C2410C",
  },
  tutorHeaderPillTextDark: {
    color: "#FDBA74",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  headerDivider: {
    width: 1,
    height: 22,
    backgroundColor: "#E2E8F0",
    marginHorizontal: 2,
  },
  headerDividerDark: {
    backgroundColor: "rgba(255, 255, 255, 0.10)",
  },
  iconBtn: {
    width: 40,
    height: 40,
    minWidth: 40,
    minHeight: 40,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnDark: {
    backgroundColor: "#161F30",
    borderColor: "rgba(255, 255, 255, 0.10)",
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    minHeight: 40,
  },
  secondaryBtnDark: {
    backgroundColor: "#161F30",
    borderColor: "rgba(255, 255, 255, 0.10)",
  },
  secondaryBtnText: {
    color: "#0F172A",
    fontWeight: "700",
    fontSize: 12.5,
  },
  secondaryBtnTextDark: {
    color: "#F8FAFC",
  },
  countPill: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
  },
  countPillDark: {
    backgroundColor: "rgba(16, 185, 129, 0.22)",
  },
  countPillText: {
    color: "#059669",
    fontSize: 11,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  countPillTextDark: {
    color: "#34D399",
  },
  registerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#EA580C",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    minHeight: 40,
    shadowColor: "#EA580C",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  registerBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 12.5,
  },
  body: {
    flex: 1,
    flexDirection: "row",
  },
  cameraColumn: {
    flex: 1,
    padding: 14,
  },
  cameraColumnCompact: {
    padding: 10,
  },
  presenceModalContent: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  presenceModalContentDark: {
    backgroundColor: "#090D16",
  },
  presenceModalSidebar: {
    width: "100%",
    flex: 1,
    borderLeftWidth: 0,
  },
});
