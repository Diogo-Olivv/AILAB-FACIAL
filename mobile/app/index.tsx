import React, { useState } from "react";
import {
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

const logo = require("../assets/ailab_makers.jpeg");

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isCompact = width < 768;

  const [isDark, setIsDark] = useState(false);
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [termsVisible, setTermsVisible] = useState(false);
  const [presenceModalVisible, setPresenceModalVisible] = useState(false);
  const [pendingMode, setPendingMode] = useState<"enroll" | "refresh">("enroll");

  const toggleTheme = () => {
    triggerHaptic("tap");
    setIsDark((prev) => !prev);
  };

  const openTutorAuth = (mode: "enroll" | "refresh") => {
    triggerHaptic("tap");
    setPendingMode(mode);
    setPinModalVisible(true);
  };

  return (
    <View style={[styles.safe, isDark && styles.safeDark]}>
      {/* Faixa Superior de Identidade AILAB Makers (Terracota, Azul Petróleo e Verde Esmeralda) */}
      <View style={styles.brandStripeContainer}>
        <View style={[styles.brandStripeSegment, { backgroundColor: "#C15F3D" }]} />
        <View style={[styles.brandStripeSegment, { backgroundColor: "#009E90" }]} />
        <View style={[styles.brandStripeSegment, { backgroundColor: "#059669" }]} />
      </View>

      <View
        style={[
          styles.header,
          isDark && styles.headerDark,
          {
            paddingTop: insets.top + 10,
            paddingLeft: insets.left + 16,
            paddingRight: insets.right + 16,
          },
        ]}
      >
        <View style={styles.brand}>
          <Image source={logo} style={styles.brandLogo} />
          <View style={styles.brandTextGroup}>
            <Text style={[styles.title, isDark && styles.titleDark]}>AILAB Makers</Text>
            <View style={styles.statusPill}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Totem Ativo</Text>
            </View>
          </View>
        </View>
        <View style={styles.headerActions}>
          {/* Botão de Alternância de Modo Escuro / Claro */}
          <TouchableOpacity
            style={[styles.themeBtn, isDark && styles.themeBtnDark]}
            onPress={toggleTheme}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={isDark ? "Alternar para modo claro" : "Alternar para modo escuro"}
          >
            <Feather
              name={isDark ? "sun" : "moon"}
              size={17}
              color={isDark ? "#F8FAFC" : "#171715"}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.termsBtn, isDark && styles.termsBtnDark]}
            onPress={() => {
              triggerHaptic("tap");
              setTermsVisible(true);
            }}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Abrir termos de privacidade e LGPD"
          >
            <Text style={[styles.termsBtnText, isDark && styles.termsBtnTextDark]}>
              {width < 450 ? "LGPD" : "Termos LGPD"}
            </Text>
          </TouchableOpacity>

          {isCompact && (
            <TouchableOpacity
              style={[styles.presenceToggleBtn, isDark && styles.presenceToggleBtnDark]}
              onPress={() => {
                triggerHaptic("tap");
                setPresenceModalVisible(true);
              }}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Ver integrantes presentes no laboratório"
            >
              <View style={styles.presenceBtnContent}>
                <Feather
                  name="users"
                  size={14}
                  color={isDark ? "#F8FAFC" : "#171715"}
                />
                <Text style={[styles.presenceToggleBtnText, isDark && styles.presenceToggleBtnTextDark]}>
                  Presentes
                </Text>
              </View>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.refreshBtn, isDark && styles.refreshBtnDark]}
            onPress={() => openTutorAuth("refresh")}
            activeOpacity={0.75}
          >
            <Text style={[styles.refreshBtnText, isDark && styles.refreshBtnTextDark]}>Recadastrar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.registerBtn, isDark && styles.registerBtnDark]}
            onPress={() => openTutorAuth("enroll")}
            activeOpacity={0.75}
          >
            <Text style={styles.registerBtnText}>Cadastrar</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View
        style={[
          styles.body,
          { paddingLeft: insets.left, paddingRight: insets.right, paddingBottom: insets.bottom },
        ]}
      >
        <View style={styles.cameraColumn}>
          <RecognitionPanel />
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
          <View style={[styles.presenceModalContent, isDark && styles.presenceModalContentDark, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }]}>
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
        onSuccess={(token: string) => {
          setPinModalVisible(false);
          router.push({
            pathname: "/enroll",
            params: {
              tutorToken: token,
              initialMode: pendingMode,
              isDark: isDark ? "true" : "false",
            },
          });
        }}
        onCancel={() => setPinModalVisible(false)}
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
  safe: { flex: 1, backgroundColor: "#FAF9F5" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E2DC",
    paddingBottom: 13,
    shadowColor: "#171715",
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 11 },
  brandLogo: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E2DC",
  },
  brandTextGroup: { gap: 1 },
  title: {
    color: "#171715",
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#059669",
    letterSpacing: 0.1,
  },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 9 },
  termsBtn: {
    backgroundColor: "#FAF9F5",
    borderWidth: 1,
    borderColor: "#E5E2DC",
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 14,
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  termsBtnText: { color: "#706E6A", fontWeight: "600", fontSize: 12.5 },
  presenceToggleBtn: {
    backgroundColor: "#FAF9F5",
    borderWidth: 1,
    borderColor: "#E5E2DC",
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 14,
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  presenceToggleBtnText: { color: "#171715", fontWeight: "600", fontSize: 12.5 },
  presenceBtnContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  refreshBtn: {
    backgroundColor: "#FAF9F5",
    borderWidth: 1,
    borderColor: "#E5E2DC",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 14,
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  refreshBtnText: { color: "#171715", fontWeight: "600", fontSize: 12.5 },
  registerBtn: {
    backgroundColor: "#171715",
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 14,
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  registerBtnText: { color: "#FAF9F5", fontWeight: "600", fontSize: 12.5 },
  body: { flex: 1, flexDirection: "row" },
  cameraColumn: { flex: 1, padding: 16 },
  presenceModalContent: {
    flex: 1,
    backgroundColor: "#FAF9F5",
  },
  presenceModalContentDark: {
    backgroundColor: "#0B0F19",
  },
  presenceModalSidebar: {
    width: "100%",
    flex: 1,
    borderLeftWidth: 0,
  },
  brandStripeContainer: {
    height: 4,
    width: "100%",
    flexDirection: "row",
  },
  brandStripeSegment: {
    flex: 1,
    height: "100%",
  },
  themeBtn: {
    backgroundColor: "#FAF9F5",
    borderWidth: 1,
    borderColor: "#E5E2DC",
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  themeBtnDark: {
    backgroundColor: "#1E293B",
    borderColor: "#334155",
  },
  themeBtnText: {
    fontSize: 15,
  },
  safeDark: {
    backgroundColor: "#0B0F19",
  },
  headerDark: {
    backgroundColor: "#0F172A",
    borderBottomColor: "#1E293B",
  },
  titleDark: {
    color: "#F8FAFC",
  },
  termsBtnDark: {
    backgroundColor: "#1E293B",
    borderColor: "#334155",
  },
  termsBtnTextDark: {
    color: "#94A3B8",
  },
  presenceToggleBtnDark: {
    backgroundColor: "#1E293B",
    borderColor: "#334155",
  },
  presenceToggleBtnTextDark: {
    color: "#F8FAFC",
  },
  refreshBtnDark: {
    backgroundColor: "#1E293B",
    borderColor: "#334155",
  },
  refreshBtnTextDark: {
    color: "#F8FAFC",
  },
  registerBtnDark: {
    backgroundColor: "#059669",
  },
});
