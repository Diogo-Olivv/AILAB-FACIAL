import React, { useCallback, useRef, useState } from "react";
import { Modal, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { CameraView } from "expo-camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ENROLL_CAPTURE_INTERVAL_MS, ENROLL_PHOTO_COUNT } from "@/lib/config";

interface Props {
  visible: boolean;
  onComplete: (uris: string[]) => void;
  onCancel: () => void;
}

function delayWithCountdown(ms: number, onTick: (msLeft: number) => void): Promise<void> {
  return new Promise((resolve) => {
    const start = Date.now();
    onTick(ms);
    const id = setInterval(() => {
      const left = ms - (Date.now() - start);
      if (left <= 0) {
        clearInterval(id);
        onTick(0);
        resolve();
      } else {
        onTick(left);
      }
    }, 100);
  });
}

export function SequentialCamera({ visible, onComplete, onCancel }: Props) {
  const cameraRef = useRef<CameraView>(null);
  const insets = useSafeAreaInsets();
  const [ready, setReady] = useState(false);
  const [running, setRunning] = useState(false);
  const [captured, setCaptured] = useState(0);
  const [countdown, setCountdown] = useState(0);

  const run = useCallback(async () => {
    if (!ready || running || !cameraRef.current) return;
    setRunning(true);
    setCaptured(0);
    const uris: string[] = [];
    for (let i = 0; i < ENROLL_PHOTO_COUNT; i++) {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        skipProcessing: true,
      });
      if (photo?.uri) uris.push(photo.uri);
      setCaptured(uris.length);
      if (i < ENROLL_PHOTO_COUNT - 1) {
        await delayWithCountdown(ENROLL_CAPTURE_INTERVAL_MS, setCountdown);
      }
    }
    setRunning(false);
    setReady(false);
    onComplete(uris);
  }, [ready, running, onComplete]);

  const cancel = useCallback(() => {
    if (running) return;
    setReady(false);
    onCancel();
  }, [running, onCancel]);

  const topInset = Math.max(insets.top, StatusBar.currentHeight ?? 0, 12);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={cancel}>
      <View style={styles.container}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="front"
          onCameraReady={() => setReady(true)}
        />

        <View
          style={[
            styles.topBar,
            { paddingTop: topInset + 8, paddingRight: insets.right + 16, paddingLeft: insets.left + 16 },
          ]}
        >
          <TouchableOpacity
            style={[styles.cancelBtn, running && styles.disabled]}
            onPress={cancel}
            disabled={running}
          >
            <Text style={styles.cancelText}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.shootBtn, (!ready || running) && styles.disabled]}
            onPress={run}
            disabled={!ready || running}
          >
            <Text style={styles.shootText}>
              {running ? "Capturando..." : `Tirar ${ENROLL_PHOTO_COUNT} fotos`}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.overlay, { paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.dots}>
            {Array.from({ length: ENROLL_PHOTO_COUNT }).map((_, i) => (
              <View key={i} style={[styles.dot, i < captured && styles.dotFilled]} />
            ))}
          </View>

          {running ? (
            <Text style={styles.status}>
              {countdown > 0
                ? `Proxima foto em ${(countdown / 1000).toFixed(1)}s`
                : `Capturando ${captured}/${ENROLL_PHOTO_COUNT}`}
            </Text>
          ) : (
            <Text style={styles.status}>
              {ready ? "Pronto para capturar" : "Iniciando camera..."}
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  camera: { flex: 1 },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    paddingBottom: 12,
  },
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    gap: 16,
    alignItems: "center",
    backgroundColor: "#00000066",
  },
  dots: { flexDirection: "row", gap: 10 },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#FFFFFF44",
    borderWidth: 2,
    borderColor: "#FFFFFFAA",
  },
  dotFilled: { backgroundColor: "#166534", borderColor: "#166534" },
  status: { color: "#fff", fontSize: 18, fontWeight: "700" },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
    alignItems: "center",
    backgroundColor: "#DC2626",
  },
  cancelText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  shootBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
    alignItems: "center",
    backgroundColor: "#1E2D5F",
  },
  shootText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  disabled: { opacity: 0.4 },
});
