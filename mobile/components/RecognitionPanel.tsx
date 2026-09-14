import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRecognize } from "@/hooks/useRecognize";
import { useCameraFocus } from "@/hooks/useCameraFocus";
import { triggerPresenceRefresh } from "@/hooks/usePresence";
import { FeedbackBadge, type FeedbackBadgeData } from "@/components/FeedbackBadge";
import { GENERIC_ERROR_MESSAGE } from "@/lib/errors";

export function RecognitionPanel() {
  const [permission, requestPermission] = useCameraPermissions();
  const { recognize, loading } = useRecognize();
  const cameraRef = useRef<CameraView>(null);
  const [busy, setBusy] = useState(false);
  const [currentAction, setCurrentAction] = useState<"check_in" | "check_out" | null>(null);
  const [badgeData, setBadgeData] = useState<FeedbackBadgeData | null>(null);
  const { active, cameraKey } = useCameraFocus();

  const capture = useCallback(
    async (action: "check_in" | "check_out") => {
      if (!cameraRef.current || busy || loading) return;
      setBusy(true);
      setCurrentAction(action);
      setBadgeData(null);

      try {
        // Disparo único, sem som e sem animação de obturador para fluidez máxima
        let photoUri: string | null = null;
        try {
          const photo = await cameraRef.current.takePictureAsync({
            quality: 0.82,
            shutterSound: false,
          });
          photoUri = photo?.uri ?? null;
        } catch {
          // Fallback resiliente caso o sensor necessite de configuração alternativa
          try {
            const photoFallback = await cameraRef.current.takePictureAsync({
              quality: 0.75,
              shutterSound: false,
            });
            photoUri = photoFallback?.uri ?? null;
          } catch {
            // Ignora se não conseguiu obter o frame
          }
        }

        if (!photoUri) {
          setBadgeData({
            type: "warning",
            title: "Câmera Ocupada",
            message: "Não foi possível capturar a imagem. Tente novamente.",
          });
          return;
        }

        const captured = [{
          uri: photoUri,
          name: "frame_1.jpg",
          type: "image/jpeg",
        }];

        const res = await recognize(captured, action);

        if (!res) {
          setBadgeData({
            type: "error",
            title: "Falha de Conexão",
            message: "Não foi possível comunicar com o servidor do laboratório.",
          });
        } else if (!res.recognized || !res.event) {
          if (res.status === "spoof_detected") {
            setBadgeData({
              type: "spoof_detected",
              title: "Falha de Vivacidade Presencial",
              message:
                res.message ||
                "Posicione-se diretamente de frente para a câmera. Não são permitidas fotos ou telas.",
            });
          } else if (res.status === "blur_detected") {
            setBadgeData({
              type: "warning",
              title: "Imagem Borrada",
              message:
                res.message || "Mantenha o tablet estável e olhe fixamente para a lente.",
            });
          } else if (res.status === "face_too_small") {
            setBadgeData({
              type: "warning",
              title: "Aproxime-se",
              message:
                res.message || "Posicione o rosto mais perto do centro da tela.",
            });
          } else {
            // Rosto não encontrado na base
            setBadgeData({
              type: "not_recognized",
              title: "Não Reconhecido",
              message:
                res.message ||
                "Rosto não cadastrado. Procure um tutor ou toque em 'Cadastrar' acima.",
            });
          }
        } else {
          // Sucesso no reconhecimento
          triggerPresenceRefresh();
          const evtAction = res.event.action;

          if (evtAction === "check_in") {
            setBadgeData({
              type: "check_in",
              name: res.name || "Integrante",
              title: "Entrada Registrada",
              message: "Presença confirmada no AILAB Makers. Bom trabalho!",
            });
          } else if (evtAction === "check_out") {
            const mins = res.event.duration_minutes;
            setBadgeData({
              type: "check_out",
              name: res.name || "Integrante",
              title: "Saída Registrada",
              durationMinutes: mins ?? undefined,
              message:
                mins != null
                  ? `Sessão encerrada com ${mins} minutos computados.`
                  : "Saída registrada com sucesso no sistema.",
            });
          } else if (evtAction === "already_in") {
            setBadgeData({
              type: "warning",
              name: res.name,
              title: "Usuário Já Presente",
              message: "Sua entrada já está ativa. Caso deseje sair, clique no botão 'Saída'.",
            });
          } else if (evtAction === "not_in") {
            setBadgeData({
              type: "warning",
              name: res.name,
              title: "Entrada Não Encontrada",
              message: "Você ainda não deu entrada no laboratório hoje. Clique em 'Entrada'.",
            });
          } else if (evtAction === "debounced") {
            setBadgeData({
              type: "warning",
              title: "Registro Recente",
              message: "Aguarde alguns segundos antes de registrar nova presença.",
            });
          } else {
            setBadgeData({
              type: action === "check_in" ? "check_in" : "check_out",
              name: res.name,
              message: "Operação biométrica concluída.",
            });
          }
        }
      } catch {
        setBadgeData({
          type: "error",
          title: "Erro de Comunicação",
          message: GENERIC_ERROR_MESSAGE,
        });
      } finally {
        setBusy(false);
        setCurrentAction(null);
      }
    },
    [busy, loading, recognize]
  );

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.permText}>Câmera necessária para o reconhecimento facial.</Text>
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
          <CameraView
            key={cameraKey}
            ref={cameraRef}
            style={styles.camera}
            facing="front"
            animateShutter={false}
          />
        )}

        {/* Banner com Instruções Claras para o Usuário */}
        <View style={styles.guideBanner} pointerEvents="none">
          <Text style={styles.guideText}>
            👤 Alinhe seu rosto no centro e selecione Entrada ou Saída
          </Text>
        </View>

        {/* Guia Oval de Posicionamento Facial Quando Ocioso */}
        {!disabled && (
          <View style={styles.idleOvalContainer} pointerEvents="none">
            <View style={styles.idleOval} />
          </View>
        )}

        {/* HUD Fluido de Escaneamento Biométrico */}
        {disabled && <BiometricScanHUD action={currentAction} />}

        {/* Badge Animada de Notificação Flutuante */}
        <FeedbackBadge
          data={badgeData}
          onDismiss={() => setBadgeData(null)}
          autoCloseMs={4500}
        />
      </View>

      <View style={styles.actions}>
        <SmoothActionButton
          label="Entrada"
          type="entrada"
          busy={disabled && currentAction === "check_in"}
          disabled={disabled}
          onPress={() => capture("check_in")}
          accessibilityLabel="Registrar Entrada"
          accessibilityHint="Captura seu rosto e inicia o registro de presença"
        />

        <SmoothActionButton
          label="Saída"
          type="saida"
          busy={disabled && currentAction === "check_out"}
          disabled={disabled}
          onPress={() => capture("check_out")}
          accessibilityLabel="Registrar Saída"
          accessibilityHint="Captura seu rosto e encerra a sessão com horas computadas"
        />
      </View>
    </View>
  );
}

/** Botão Premium com feedback tátil suave e física de mola */
function SmoothActionButton({
  label,
  type,
  busy,
  disabled,
  onPress,
  accessibilityLabel,
  accessibilityHint,
}: {
  label: string;
  type: "entrada" | "saida";
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityHint: string;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.94,
      friction: 5,
      tension: 120,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 4,
      tension: 90,
      useNativeDriver: true,
    }).start();
  };

  useEffect(() => {
    Animated.timing(opacityAnim, {
      toValue: disabled && !busy ? 0.65 : 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [disabled, busy]);

  return (
    <Animated.View
      style={[
        styles.actionWrapper,
        {
          transform: [{ scale: scaleAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      <TouchableOpacity
        style={[
          styles.action,
          type === "entrada" ? styles.entrada : styles.saida,
          busy && styles.actionBusy,
        ]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        activeOpacity={0.92}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
      >
        {busy ? (
          <View style={styles.buttonBusy}>
            <ActivityIndicator color="#FFFFFF" size="small" />
            <Text style={styles.actionText}>Verificando...</Text>
          </View>
        ) : (
          <Text style={styles.actionText}>{label}</Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

/** HUD Suave com Retículo e Varredura sem corte de vídeo */
function BiometricScanHUD({ action }: { action: "check_in" | "check_out" | null }) {
  const scanAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(scanAnim, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [scanAnim]);

  const translateY = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 170],
  });

  const accentColor = action === "check_in" ? "#22C55E" : "#C9A961";

  return (
    <View style={styles.hudOverlay} pointerEvents="none">
      {/* Moldura de Foco Biométrico */}
      <View style={[styles.reticle, { borderColor: "rgba(255, 255, 255, 0.35)" }]}>
        <View style={[styles.corner, styles.cTL, { borderColor: accentColor }]} />
        <View style={[styles.corner, styles.cTR, { borderColor: accentColor }]} />
        <View style={[styles.corner, styles.cBL, { borderColor: accentColor }]} />
        <View style={[styles.corner, styles.cBR, { borderColor: accentColor }]} />

        {/* Linha de Varredura Suave */}
        <Animated.View
          style={[
            styles.scanLaser,
            {
              backgroundColor: accentColor,
              shadowColor: accentColor,
              transform: [{ translateY }],
            },
          ]}
        />
      </View>

      {/* Pílula de Status Inferior */}
      <View style={styles.hudPill}>
        <ActivityIndicator color="#FFFFFF" size="small" />
        <Text style={styles.hudText}>
          {action === "check_in" ? "Verificando Entrada..." : "Verificando Saída..."}
        </Text>
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
    backgroundColor: "#0F172A",
    position: "relative",
  },
  camera: { flex: 1 },
  hudOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15, 23, 42, 0.18)",
  },
  reticle: {
    width: 220,
    height: 220,
    borderWidth: 1,
    borderRadius: 24,
    position: "relative",
    overflow: "hidden",
    alignItems: "center",
  },
  corner: {
    position: "absolute",
    width: 24,
    height: 24,
  },
  cTL: { top: 0, left: 0, borderTopWidth: 3.5, borderLeftWidth: 3.5, borderTopLeftRadius: 18 },
  cTR: { top: 0, right: 0, borderTopWidth: 3.5, borderRightWidth: 3.5, borderTopRightRadius: 18 },
  cBL: { bottom: 0, left: 0, borderBottomWidth: 3.5, borderLeftWidth: 3.5, borderBottomLeftRadius: 18 },
  cBR: { bottom: 0, right: 0, borderBottomWidth: 3.5, borderRightWidth: 3.5, borderBottomRightRadius: 18 },
  scanLaser: {
    width: "90%",
    height: 2.5,
    borderRadius: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 6,
  },
  hudPill: {
    position: "absolute",
    bottom: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(20, 26, 51, 0.82)",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  hudText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  guideBanner: {
    position: "absolute",
    top: 14,
    left: 16,
    right: 16,
    alignItems: "center",
    zIndex: 10,
  },
  guideText: {
    backgroundColor: "rgba(20, 26, 51, 0.76)",
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 999,
    overflow: "hidden",
    textAlign: "center",
  },
  idleOvalContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  idleOval: {
    width: 200,
    height: 250,
    borderRadius: 100,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "rgba(255, 255, 255, 0.40)",
  },
  actions: { flexDirection: "row", gap: 14 },
  actionWrapper: { flex: 1 },
  action: {
    width: "100%",
    paddingVertical: 18,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.22)",
  },
  buttonBusy: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  entrada: {
    backgroundColor: "#166534",
    shadowColor: "#166534",
  },
  saida: {
    backgroundColor: "#1E2D5F",
    shadowColor: "#1E2D5F",
  },
  actionBusy: {
    backgroundColor: "#0F172A",
    borderColor: "rgba(255, 255, 255, 0.35)",
  },
  disabled: { opacity: 0.65 },
  actionText: { color: "#FFFFFF", fontWeight: "800", fontSize: 18, letterSpacing: 0.3 },
  permText: { color: "#141A33", fontSize: 16, textAlign: "center", paddingHorizontal: 32 },
  permBtn: {
    backgroundColor: "#1E2D5F",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  permBtnText: { color: "#FFFFFF", fontWeight: "700" },
});
