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

export function CameraCapture() {
  const [permission, requestPermission] = useCameraPermissions();
  const { recognize, loading, result } = useRecognize();
  const cameraRef = useRef<CameraView>(null);
  const [capturing, setCapturing] = useState(false);

  const capture = useCallback(async () => {
    if (!cameraRef.current || capturing || loading) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        base64: false,
        skipProcessing: true,
      });
      if (!photo?.uri) return;

      // Converte URI local em Blob para enviar ao backend
      const resp = await fetch(photo.uri);
      const blob = await resp.blob();
      const res = await recognize(blob);

      if (res?.recognized && res.event) {
        const action = res.event.action === "check_in" ? "✅ Check-in" : "🚪 Check-out";
        const duration =
          res.event.action === "check_out"
            ? ` (${res.event.duration_minutes} min)`
            : "";
        Alert.alert(action, `Bem-vindo(a)!${duration}`);
      } else if (res && !res.recognized) {
        Alert.alert("Não reconhecido", "Rosto não encontrado na base de dados.");
      }
    } catch (err: any) {
      Alert.alert("Erro", err.message ?? "Falha ao capturar");
    } finally {
      setCapturing(false);
    }
  }, [capturing, loading, recognize]);

  if (!permission) return <View />;

  if (!permission.granted) {
    return (
      <View style={styles.permContainer}>
        <Text style={styles.permText}>Câmera necessária para reconhecimento.</Text>
        <TouchableOpacity style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>Permitir acesso</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing="front" />
      <TouchableOpacity
        style={[styles.captureBtn, (capturing || loading) && styles.captureBtnDisabled]}
        onPress={capture}
        disabled={capturing || loading}
      >
        {capturing || loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.captureBtnText}>📸 Identificar</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  camera: { flex: 1, borderRadius: 16, overflow: "hidden" },
  permContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  permText: { color: "#fff", fontSize: 16, textAlign: "center", paddingHorizontal: 32 },
  btn: { backgroundColor: "#6C47FF", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  btnText: { color: "#fff", fontWeight: "700" },
  captureBtn: {
    margin: 16,
    backgroundColor: "#6C47FF",
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  captureBtnDisabled: { opacity: 0.5 },
  captureBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
