import React from "react";
import { SafeAreaView, StyleSheet, View } from "react-native";
import { CameraCapture } from "@/components/CameraCapture";
import { PresenceSidebar } from "@/components/PresenceSidebar";

export default function CameraScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.row}>
        <View style={styles.cameraArea}>
          <CameraCapture />
        </View>
        <PresenceSidebar />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F0F1A" },
  row: { flex: 1, flexDirection: "row" },
  cameraArea: { flex: 1 },
});
