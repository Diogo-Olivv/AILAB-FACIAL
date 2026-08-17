import React from "react";
import { SafeAreaView, StyleSheet } from "react-native";
import { EnrollCapture } from "@/components/EnrollCapture";

export default function EnrollScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <EnrollCapture />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F0F1A" },
});
