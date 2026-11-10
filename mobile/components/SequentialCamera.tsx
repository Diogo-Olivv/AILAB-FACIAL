import React, { useCallback, useRef, useState } from "react";
import { Modal, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { CameraView } from "expo-camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
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
      let photo;
      try {
        photo = await cameraRef.current.takePictureAsync({
          quality: 0.75,
          shutterSound: false,
        });
      } catch {
        try {
          photo = await cameraRef.current.takePictureAsync({
            quality: 0.7,
            shutterSound: false,
          });
        } catch {
          // Ignora falha de frame isolado
        }
      }
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
  const bracketColor = running ? "#10B981" : "rgba(255, 255, 255, 0.75)";

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={cancel}>
      <View style={styles.container}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="front"
          animateShutter={false}
          onCameraReady={() => setReady(true)}
        />

        {/* Barra Superior de Ações */}
        <View
          style={[
            styles.topBar,
            {
              paddingTop: topInset + 8,
              paddingRight: insets.right + 16,
              paddingLeft: insets.left + 16,
            },
          ]}
        >
          <View style={styles.topBadge}>
            <Feather name="cpu" size={13} color="#34D399" />
            <Text style={styles.topBadgeText}>
              Captura Multi-Frame · {captured}/{ENROLL_PHOTO_COUNT}
            </Text>
          </View>

          <View style={styles.topButtons}>
            <TouchableOpacity
              style={[styles.cancelBtn, running && styles.disabled]}
              onPress={cancel}
              disabled={running}
              activeOpacity={0.8}
            >
              <Feather name="x" size={15} color="#FFFFFF" />
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.shootBtn, (!ready || running) && styles.disabled]}
              onPress={run}
              disabled={!ready || running}
              activeOpacity={0.85}
            >
              <Feather name="camera" size={15} color="#FFFFFF" />
              <Text style={styles.shootText}>
                {running ? "Capturando..." : `Capturar ${ENROLL_PHOTO_COUNT} Fotos`}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Guia Oval Central com Cantoneiras Técnicas (HUD) */}
        <View style={styles.centerGuide} pointerEvents="none">
          <View style={styles.reticleFrame}>
            <View style={[styles.corner, styles.cTL, { borderColor: bracketColor }]} />
            <View style={[styles.corner, styles.cTR, { borderColor: bracketColor }]} />
            <View style={[styles.corner, styles.cBL, { borderColor: bracketColor }]} />
            <View style={[styles.corner, styles.cBR, { borderColor: bracketColor }]} />
            <View style={[styles.oval, running && styles.ovalRunning]} />
          </View>
        </View>

        {/* HUD Inferior com Progresso Numerado */}
        <View style={[styles.overlay, { paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.dots}>
            {Array.from({ length: ENROLL_PHOTO_COUNT }).map((_, i) => {
              const done = i < captured;
              return (
                <View key={i} style={[styles.stepPill, done && styles.stepPillDone]}>
                  <Text style={[styles.stepPillText, done && styles.stepPillTextDone]}>
                    {i + 1}
                  </Text>
                </View>
              );
            })}
          </View>

          {running ? (
            <Text style={styles.status}>
              {countdown > 0
                ? `Próxima foto em ${(countdown / 1000).toFixed(1)}s`
                : `Capturando frame ${captured}/${ENROLL_PHOTO_COUNT}`}
            </Text>
          ) : (
            <Text style={styles.status}>
              {ready ? "Pronto para iniciar captura" : "Inicializando sensor..."}
            </Text>
          )}
          <Text style={styles.substatus}>
            {running
              ? "Mantenha o rosto dentro do guia oval e olhe para a lente"
              : "Centralize seu rosto no guia acima e toque em Capturar"}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#090D16" },
  camera: { flex: 1 },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingBottom: 12,
    zIndex: 20,
  },
  topBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(9, 13, 22, 0.80)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  topBadgeText: {
    color: "#F8FAFC",
    fontSize: 12,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  topButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  centerGuide: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  reticleFrame: {
    width: 220,
    height: 264,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: 24,
    height: 24,
  },
  cTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 16 },
  cTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 16 },
  cBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 16 },
  cBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 16 },
  oval: {
    width: 188,
    height: 232,
    borderRadius: 96,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "rgba(255, 255, 255, 0.55)",
  },
  ovalRunning: {
    borderStyle: "solid",
    borderColor: "#10B981",
    borderWidth: 2.5,
  },
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 18,
    paddingHorizontal: 24,
    gap: 10,
    alignItems: "center",
    backgroundColor: "rgba(9, 13, 22, 0.84)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.12)",
  },
  dots: { flexDirection: "row", gap: 10 },
  stepPill: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  stepPillDone: {
    backgroundColor: "#10B981",
    borderColor: "#34D399",
  },
  stepPillText: {
    color: "rgba(255, 255, 255, 0.75)",
    fontSize: 12,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  stepPillTextDone: {
    color: "#FFFFFF",
  },
  status: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  substatus: {
    color: "#CBD5E1",
    fontSize: 12.5,
    textAlign: "center",
  },
  cancelBtn: {
    flexDirection: "row",
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(15, 22, 35, 0.80)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.22)",
  },
  cancelText: { color: "#FFFFFF", fontWeight: "700", fontSize: 13.5 },
  shootBtn: {
    flexDirection: "row",
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: "#EA580C",
    shadowColor: "#EA580C",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  shootText: { color: "#FFFFFF", fontWeight: "800", fontSize: 13.5 },
  disabled: { opacity: 0.45 },
});
