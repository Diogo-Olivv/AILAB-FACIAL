import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { RecognitionPanel } from "@/components/RecognitionPanel";
import { PresenceSidebar } from "@/components/PresenceSidebar";

export default function Home() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom", "left", "right"]}>
      <View style={styles.header}>
        <Text style={styles.title}>AILAB Presenca</Text>
        <TouchableOpacity style={styles.registerBtn} onPress={() => router.push("/enroll")}>
          <Text style={styles.registerBtnText}>Cadastrar</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        <View style={styles.cameraColumn}>
          <RecognitionPanel />
        </View>
        <PresenceSidebar />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0F0F1A" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: { color: "#fff", fontSize: 20, fontWeight: "800" },
  registerBtn: {
    backgroundColor: "#6C47FF",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  registerBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  body: { flex: 1, flexDirection: "row" },
  cameraColumn: { flex: 1, padding: 16 },
});
