import React, { useState } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { RecognitionPanel } from "@/components/RecognitionPanel";
import { PresenceSidebar } from "@/components/PresenceSidebar";
import { TutorPinModal } from "@/components/TutorPinModal";

const logo = require("../assets/ailab_makers.jpeg");

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [pinModalVisible, setPinModalVisible] = useState(false);

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
        <TouchableOpacity style={styles.registerBtn} onPress={() => setPinModalVisible(true)}>
          <Text style={styles.registerBtnText}>Cadastrar</Text>
        </TouchableOpacity>
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
        <PresenceSidebar />
      </View>

      <TutorPinModal
        visible={pinModalVisible}
        onSuccess={() => {
          setPinModalVisible(false);
          router.push("/enroll");
        }}
        onCancel={() => setPinModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4EFE4" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1E2D5F",
    paddingBottom: 12,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandLogo: { width: 40, height: 40, borderRadius: 9 },
  title: { color: "#fff", fontSize: 20, fontWeight: "800" },
  registerBtn: {
    backgroundColor: "#166534",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  registerBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  body: { flex: 1, flexDirection: "row" },
  cameraColumn: { flex: 1, padding: 16 },
});
