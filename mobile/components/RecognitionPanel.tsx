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
import { GENERIC_ERROR_MESSAGE } from "@/lib/errors";

const FEEDBACK: Record<RecognitionAction, (name?: string, min?: number) => string> = {
  check_in: (name) => `Entrada Registrada: ${name ?? ""}`.trimEnd(),
  check_out: (_name, min) => `Saida registrada.${min != null ? ` (${min} min)` : ""}`,
  already_in: () => "Usuário já presente no laboratório.",
  not_in: () => "O usuário não deu entrada no laboratório.",
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
        const captured: { uri: string; name: string; type: string }[] = [];

        // 1. Captura imediata do frame principal
        try {
          const photo1 = await cameraRef.current.takePictureAsync({
            quality: 0.85,
            skipProcessing: true,
          });
          if (photo1?.uri) {
            captured.push({
              uri: photo1.uri,
              name: "frame_1.jpg",
              type: "image/jpeg",
            });
          }
        } catch {
          // Fallback caso o sensor do tablet exija pós-processamento
          try {
            const photo1 = await cameraRef.current.takePictureAsync({
              quality: 0.80,
            });
            if (photo1?.uri) {
              captured.push({
                uri: photo1.uri,
                name: "frame_1.jpg",
                type: "image/jpeg",
              });
            }
          } catch {
            // Ignora falha de câmera
          }
        }

        // 2. Disparo opcional do segundo frame para verificação temporal
        if (captured.length > 0 && cameraRef.current) {
          try {
            await new Promise((r) => setTimeout(r, 120));
            const photo2 = await cameraRef.current.takePictureAsync({
              quality: 0.80,
            });
            if (photo2?.uri) {
              captured.push({
                uri: photo2.uri,
                name: "frame_2.jpg",
                type: "image/jpeg",
              });
            }
          } catch {
            // Prossegue com o primeiro frame caso a câmera ainda esteja ocupada
          }
        }

        if (captured.length === 0) return;

        const res = await recognize(captured, action);

        if (!res) {
          Alert.alert("Erro", "Falha ao comunicar com o servidor.");
        } else if (!res.recognized || !res.event) {
          const title =
            res.status === "spoof_detected"
              ? "Aviso de Segurança"
              : res.status === "blur_detected"
              ? "Imagem Borrada"
              : res.status === "face_too_small"
              ? "Aproxime-se"
              : "Não Reconhecido";

          const detail =
            res.message ||
            (res.status === "spoof_detected"
              ? "Falha na verificação de vivacidade presencial."
              : res.status === "blur_detected"
              ? "Mantenha o tablet estável e olhe para a câmera."
              : res.status === "face_too_small"
              ? "Posicione o rosto mais perto do centro da tela."
              : "Rosto não encontrado na base de dados.");

          Alert.alert(title, detail);
        } else {
          Alert.alert(
            action === "check_in" ? "Entrada" : "Saída",
            FEEDBACK[res.event.action](res.name, res.event.duration_minutes)
          );
        }
      } catch {
        Alert.alert("Erro", GENERIC_ERROR_MESSAGE);
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
