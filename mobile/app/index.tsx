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

const logo = require("../assets/ailab_makers.jpeg");

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isCompact = width < 768;

  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [termsVisible, setTermsVisible] = useState(false);
  const [presenceModalVisible, setPresenceModalVisible] = useState(false);
  const [pendingMode, setPendingMode] = useState<"enroll" | "refresh">("enroll");

  const openTutorAuth = (mode: "enroll" | "refresh") => {
    setPendingMode(mode);
    setPinModalVisible(true);
  };

  return (
    <View style={styles.safe}>
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 12,
            paddingLeft: insets.left + 16,
            paddingRight: insets.right + 16,
          },
        ]}
      >
        <View style={styles.brand}>
          <Image source={logo} style={styles.brandLogo} />
          <Text style={styles.title}>AILAB Makers</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.termsBtn}
            onPress={() => setTermsVisible(true)}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Abrir termos de privacidade e LGPD"
          >
            <Text style={styles.termsBtnText}>Termos LGPD</Text>
          </TouchableOpacity>

          {isCompact && (
            <TouchableOpacity
              style={styles.presenceToggleBtn}
              onPress={() => setPresenceModalVisible(true)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Ver integrantes presentes no laboratório"
            >
              <Text style={styles.presenceToggleBtnText}>👥 Presentes</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={() => openTutorAuth("refresh")}
            activeOpacity={0.75}
          >
            <Text style={styles.refreshBtnText}>Recadastrar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.registerBtn}
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

        {!isCompact && <PresenceSidebar />}
      </View>

      {/* Modal de Presentes para Telas Compactas / Smartphones */}
      {isCompact && (
        <Modal
          visible={presenceModalVisible}
          animationType="slide"
          onRequestClose={() => setPresenceModalVisible(false)}
        >
          <View style={[styles.presenceModalContent, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }]}>
            <PresenceSidebar
              onClose={() => setPresenceModalVisible(false)}
              style={styles.presenceModalSidebar}
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
            params: { tutorToken: token, initialMode: pendingMode },
          });
        }}
        onCancel={() => setPinModalVisible(false)}
      />

      <TermsModal
        visible={termsVisible}
        onClose={() => setTermsVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F6F8FD" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 0, 0, 0.06)",
    paddingBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandLogo: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.08)",
  },
  title: {
    color: "#0F172A",
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  termsBtn: {
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.06)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  termsBtnText: { color: "#475569", fontWeight: "600", fontSize: 13 },
  presenceToggleBtn: {
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.06)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  presenceToggleBtnText: { color: "#0F172A", fontWeight: "700", fontSize: 13 },
  refreshBtn: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "rgba(37, 99, 235, 0.2)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  refreshBtnText: { color: "#2563EB", fontWeight: "700", fontSize: 13 },
  registerBtn: {
    backgroundColor: "#059669",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 12,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#059669",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  registerBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 13 },
  body: { flex: 1, flexDirection: "row" },
  cameraColumn: { flex: 1, padding: 16 },
  presenceModalContent: {
    flex: 1,
    backgroundColor: "#F6F8FD",
  },
  presenceModalSidebar: {
    width: "100%",
    flex: 1,
    borderLeftWidth: 0,
  },
});
