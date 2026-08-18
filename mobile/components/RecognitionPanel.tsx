import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRecognize } from "@/hooks/useRecognize";
import { useCameraFocus } from "@/hooks/useCameraFocus";
import type { RecognitionAction } from "@/lib/api";

const FEEDBACK: Record<RecognitionAction, (min?: number) => string> = {
  check_in: () => "Entrada registrada.",
  check_out: (min) => `Saida registrada.${min != null ? ` (${min} min)` : ""}`,
  already_in: () => "Ja estava presente.",
  not_in: () => "Nao havia entrada aberta.",
  debounced: () => "Aguarde alguns segundos e tente de novo.",
};

export function RecognitionPanel() {
  const [permission, requestPermission] = useCameraPermissions();
  const { recognize, loading } = useRecognize();
  const cameraRef = useRef<CameraView>(null);
  const [busy, setBusy] = useState(false);
  const { active, cameraKey } = useCameraFocus();

  const capture = useCallback(
    async (action: "check_in" | "check_out") => {
      if (!cameraRef.current || busy || loading) return;
      setBusy(true);
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.7,
          skipProcessing: true,
        });
        if (!photo?.uri) return;

        const res = await recognize(
          { uri: photo.uri, name: "frame.jpg", type: "image/jpeg" },
          action
        );

        if (!res) {
          Alert.alert("Erro", "Falha ao comunicar com o servidor.");
        } else if (!res.recognized || !res.event) {
          Alert.alert("Nao reconhecido", "Rosto nao encontrado na base.");
        } else {
          Alert.alert(
            action === "check_in" ? "Entrada" : "Saida",
            FEEDBACK[res.event.action](res.event.duration_minutes)
          );
        }
      } catch (err: any) {
        Alert.alert("Erro", err?.message ?? "Falha ao capturar.");
      } finally {
        setBusy(false);
      }
    },
    [busy, loading, recognize]
  );

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.permText}>Camera necessaria para o reconhecimento.</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Permitir acesso</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const disabled = busy || loading;

  return (
    <View style={styles.container}>
      <View style={styles.cameraWrapper}>
        {active && (
          <CameraView key={cameraKey} ref={cameraRef} style={styles.camera} facing="front" />
        )}
        {disabled && (
          <View style={styles.overlay}>
            <ActivityIndicator color="#fff" size="large" />
          </View>
        )}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.action, styles.entrada, disabled && styles.disabled]}
          onPress={() => capture("check_in")}
          disabled={disabled}
        >
          <Text style={styles.actionText}>Entrada</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.action, styles.saida, disabled && styles.disabled]}
          onPress={() => capture("check_out")}
          disabled={disabled}
        >
          <Text style={styles.actionText}>Saida</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: 14 },
  center: { alignItems: "center", justifyContent: "center", gap: 16 },
  cameraWrapper: {
    flex: 1,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  camera: { flex: 1 },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00000055",
  },
  actions: { flexDirection: "row", gap: 14 },
  action: {
    flex: 1,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: "center",
  },
  entrada: { backgroundColor: "#166534" },
  saida: { backgroundColor: "#1E2D5F" },
  disabled: { opacity: 0.5 },
  actionText: { color: "#fff", fontWeight: "800", fontSize: 18 },
  permText: { color: "#141A33", fontSize: 16, textAlign: "center", paddingHorizontal: 32 },
  permBtn: {
    backgroundColor: "#1E2D5F",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  permBtnText: { color: "#fff", fontWeight: "700" },
});
