import React from "react";
import { SafeAreaView, StyleSheet } from "react-native";
import { CameraCapture } from "@/components/CameraCapture";

export default function CameraScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <CameraCapture />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F0F1A" },
});
