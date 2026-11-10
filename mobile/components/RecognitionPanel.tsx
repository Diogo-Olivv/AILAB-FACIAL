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
import { extractErrorMessage, GENERIC_ERROR_MESSAGE } from "@/lib/errors";
import { notifyInteraction, triggerHaptic } from "@/lib/sound";
import { classifyRecognitionFailure, RECOGNITION_FAILURE_COPY } from "@/lib/errors";
import { Feather, Ionicons } from "@expo/vector-icons";

interface RecognitionPanelProps {
  isDark?: boolean;
}

export function RecognitionPanel({ isDark = false }: RecognitionPanelProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const { recognize, loading } = useRecognize();
  const cameraRef = useRef<CameraView>(null);
  const [busy, setBusy] = useState(false);
  const [currentAction, setCurrentAction] = useState<"check_in" | "check_out" | null>(null);
  const [badgeData, setBadgeData] = useState<FeedbackBadgeData | null>(null);
  const { active, cameraKey } = useCameraFocus();

  // Estados Hands-Free e Resiliência Offline
  const [isHandsFree, setIsHandsFree] = useState(false);
  const [flashPulseActive, setFlashPulseActive] = useState(false);
  const lastSuccessTimeRef = useRef<number>(0);
  const busyRef = useRef(false);
  busyRef.current = busy || loading;

  // FSM Hands-Free: IDLE | PROCESSING | SUCCESS | COOLDOWN
  type KioskState = "IDLE" | "PROCESSING" | "SUCCESS" | "COOLDOWN";
  const kioskState = useRef<KioskState>("IDLE");
  const cooldownEndRef = useRef<number>(0);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const COOLDOWN_MS = 4500;

  const startCooldown = useCallback(() => {
    kioskState.current = "COOLDOWN";
    const endTime = Date.now() + COOLDOWN_MS;
    cooldownEndRef.current = endTime;
    setCooldownRemaining(Math.ceil(COOLDOWN_MS / 1000));
    notifyInteraction("cooldown_alert");

    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    cooldownTimerRef.current = setInterval(() => {
      const remaining = Math.max(0, cooldownEndRef.current - Date.now());
      const secs = Math.ceil(remaining / 1000);
      setCooldownRemaining(secs);
      if (remaining <= 0) {
        clearInterval(cooldownTimerRef.current!);
        cooldownTimerRef.current = null;
        kioskState.current = "IDLE";
        setCooldownRemaining(0);
      }
    }, 200);
  }, []);

  // Pulso animado sutil da moldura oval durante modo ocioso / hands-free
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.03,
          duration: 1100,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1100,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  const capture = useCallback(
    async (action?: "check_in" | "check_out" | null) => {
      if (!cameraRef.current || busy || loading) return;
      setBusy(true);
      setCurrentAction(action ?? null);
      setBadgeData(null);

      try {
        // Captura rápida em rajada (burst multi-frame) para tolerância a tremor e piscadas
        const uris: string[] = [];
        try {
          const photo1 = await cameraRef.current.takePictureAsync({
            quality: 0.82,
            shutterSound: false,
          });
          if (photo1?.uri) uris.push(photo1.uri);
        } catch {
          try {
            const photoFallback = await cameraRef.current.takePictureAsync({
              quality: 0.75,
              shutterSound: false,
            });
            if (photoFallback?.uri) uris.push(photoFallback.uri);
          } catch {
            // ignora falha de frame
          }
        }

        // Segundo frame com pulso fotométrico ativo (segundo frame com a tela mais clara; heurística do servidor)
        if (uris.length > 0 && cameraRef.current) {
          try {
            setFlashPulseActive(true);
            await new Promise((r) => setTimeout(r, 85));
            const photo2 = await cameraRef.current.takePictureAsync({
              quality: 0.82,
              shutterSound: false,
            });
            if (photo2?.uri) uris.push(photo2.uri);
          } catch {
            // Se o segundo frame falhar, segue com o primeiro com segurança
          } finally {
            setFlashPulseActive(false);
          }
        }

        if (uris.length === 0) {
          setBadgeData({
            type: "warning",
            title: "Câmera Ocupada",
            message: "Não foi possível capturar a imagem. Tente novamente.",
          });
          return;
        }

        const captured = uris.map((uri, idx) => ({
          uri,
          name: `frame_${idx + 1}.jpg`,
          type: "image/jpeg",
        }));

        const res = await recognize(captured, action);

        if (!res) {
          // Chamada cancelada por outra mais recente: nada a informar.
        } else if (!res.recognized || !res.event) {
          startCooldown();
          if (res.status === "spoof_detected") {
            notifyInteraction("denied");
          } else {
            notifyInteraction("warning");
          }
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
              title: "Mantenha o Tablet Estável",
              message:
                res.message || "Evite movimentos bruscos e olhe fixamente para a lente.",
            });
          } else if (res.status === "face_too_small") {
            setBadgeData({
              type: "warning",
              title: "Aproxime-se da Câmera",
              message:
                res.message || "Posicione o rosto mais perto do centro da tela para melhor leitura.",
            });
          } else if (res.status === "no_face") {
            setBadgeData({
              type: "warning",
              title: "Rosto Não Detectado",
              message:
                res.message || "Alinhe seu rosto dentro da guia central e olhe para a câmera.",
            });
          } else if (res.status === "uncertain") {
            setBadgeData({
              type: "warning",
              title: "Aproxime-se e Olhe para a Lente",
              message:
                res.message || "Similaridade parcial. Olhe diretamente para a lente e mantenha boa iluminação.",
            });
          } else {
            setBadgeData({
              type: "not_recognized",
              title: "Não Reconhecido",
              message:
                res.message ||
                "Rosto não cadastrado. Procure um tutor ou toque em 'Cadastrar' acima.",
            });
          }
        } else {
          lastSuccessTimeRef.current = Date.now();
          kioskState.current = "SUCCESS";
          setTimeout(() => {
            if (kioskState.current === "SUCCESS") {
              kioskState.current = "IDLE";
            }
          }, COOLDOWN_MS);
          triggerPresenceRefresh();
          const evtAction = res.event.action;

          if (evtAction === "check_in") {
            notifyInteraction("check_in");
            setBadgeData({
              type: "check_in",
              isTutor: Boolean(res.is_tutor),
              name: res.name || "Integrante",
              title: "Entrada Registrada",
              message: "Presença confirmada no AILAB Makers. Bom trabalho!",
            });
          } else if (evtAction === "check_out") {
            notifyInteraction("check_out");
            const rawMins = res.event.duration_minutes;
            let displayMins: string | number | undefined;
            let durationMsg = "Saída registrada com sucesso no sistema.";

            if (rawMins != null) {
              if (rawMins < 1) {
                displayMins = "< 1";
                durationMsg = "Sessão encerrada com menos de 1 minuto computado.";
              } else {
                const roundedMins = Math.round(rawMins);
                displayMins = roundedMins;
                durationMsg = `Sessão encerrada com ${roundedMins} ${roundedMins === 1 ? "minuto" : "minutos"} computados.`;
              }
            }

            setBadgeData({
              type: "check_out",
              name: res.name || "Integrante",
              title: "Saída Registrada",
              isTutor: Boolean(res.is_tutor),
              durationMinutes: displayMins,
              message: durationMsg,
            });
          } else if (evtAction === "already_in") {
            notifyInteraction("warning");
            setBadgeData({
              type: "warning",
              name: res.name,
              isTutor: Boolean(res.is_tutor),
              title: "Usuário Já Presente",
              message: "Sua entrada já está ativa. Caso deseje sair, toque no botão 'Saída'.",
            });
          } else if (evtAction === "not_in") {
            notifyInteraction("warning");
            setBadgeData({
              type: "warning",
              name: res.name,
              isTutor: Boolean(res.is_tutor),
              title: "Entrada Não Encontrada",
              message: "Você ainda não deu entrada no laboratório hoje. Toque em 'Entrada'.",
            });
          } else if (evtAction === "debounced") {
            notifyInteraction("warning");
            setBadgeData({
              type: "warning",
              title: "Registro Recente",
              message: "Aguarde alguns segundos antes de registrar nova presença.",
            });
          } else {
            notifyInteraction(action === "check_in" ? "check_in" : "check_out");
            setBadgeData({
              type: action === "check_in" ? "check_in" : "check_out",
              name: res.name,
              message: "Operação biométrica concluída.",
            });
          }
        }
      } catch (err: unknown) {
        startCooldown();
        const kind = classifyRecognitionFailure(err);
        console.warn(`[RecognitionPanel] Falha no registro (${kind}).`);
        notifyInteraction("error");
        setBadgeData({
          type: "error",
          title: RECOGNITION_FAILURE_COPY[kind].title,
          message: RECOGNITION_FAILURE_COPY[kind].message,
        });
      } finally {
        setBusy(false);
        setCurrentAction(null);
      }
    },
    [busy, loading, recognize, startCooldown]
  );

  // Hands-Free: trigger controlado pela FSM (IDLE -> PROCESSING -> SUCCESS / COOLDOWN)
  const handleFaceDetected = useCallback(() => {
    if (
      !isHandsFree ||
      !active ||
      !permission?.granted ||
      kioskState.current !== "IDLE" ||
      busyRef.current
    )
      return;

    kioskState.current = "PROCESSING";
    capture(null).finally(() => {
      if (kioskState.current === "PROCESSING") {
        kioskState.current = "IDLE";
      }
    });
  }, [isHandsFree, active, permission?.granted, capture]);

  useEffect(() => {
    if (!isHandsFree || !active || !permission?.granted) return;

    const interval = setInterval(() => {
      handleFaceDetected();
    }, 2000);

    return () => clearInterval(interval);
  }, [isHandsFree, active, permission?.granted, handleFaceDetected]);

  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    };
  }, []);

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <View style={[styles.container, styles.permCard, isDark && styles.permCardDark]}>
        <View style={styles.permIconCircle}>
          <Feather name="camera" size={26} color="#EA580C" />
        </View>
        <Text style={[styles.permTitle, isDark && styles.permTitleDark]}>
          Permissão de Câmera Necessária
        </Text>
        <Text style={[styles.permText, isDark && styles.permTextDark]}>
          O totem utiliza a câmera frontal exclusivamente para extrair o vetor biométrico em memória RAM e confirmar sua presença.
        </Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission} activeOpacity={0.85}>
          <Feather name="check-circle" size={16} color="#FFFFFF" />
          <Text style={styles.permBtnText}>Habilitar Câmera do Totem</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const disabled = busy || loading;
  const cornerBracketColor =
    cooldownRemaining > 0
      ? "#F59E0B"
      : isHandsFree
      ? "#10B981"
      : "rgba(255, 255, 255, 0.72)";

  return (
    <View style={styles.container}>
      <View style={[styles.cameraWrapper, isDark && styles.cameraWrapperDark]}>
        {active && (
          <CameraView
            key={cameraKey}
            ref={cameraRef}
            style={styles.camera}
            facing="front"
            animateShutter={false}
          />
        )}

        {/* Barra Superior de Telemetria do Visor: Modo Mãos-Livres + Status IA/Offline */}
        <View style={styles.topStatusRow}>
          <TouchableOpacity
            style={[styles.handsFreeToggle, isHandsFree && styles.handsFreeToggleActive]}
            onPress={() => {
              triggerHaptic("tap");
              setIsHandsFree((prev) => !prev);
            }}
            activeOpacity={0.75}
            accessibilityRole="switch"
            accessibilityLabel="Alternar modo mãos-livres"
          >
            <Ionicons
              name={isHandsFree ? "sparkles" : "hand-left-outline"}
              size={14}
              color="#FFFFFF"
            />
            <Text style={styles.handsFreeText}>
              {isHandsFree ? "Auto-Scan: Ativo" : "Modo Manual"}
            </Text>
          </TouchableOpacity>

          <View style={styles.telemetryPill}>
            <View style={styles.telemetryDot} />
            <Text style={styles.telemetryText}>Reconhecimento Ativo</Text>
          </View>
        </View>

        {/* Guia Biométrico Central com Cantoneiras Técnicas (HUD) */}
        {!disabled && (
          <Animated.View
            style={[
              styles.idleOvalContainer,
              { transform: [{ scale: isHandsFree ? pulseAnim : 1 }] },
            ]}
            pointerEvents="none"
          >
            <View style={styles.reticleFrame}>
              <View style={[styles.corner, styles.cTL, { borderColor: cornerBracketColor }]} />
              <View style={[styles.corner, styles.cTR, { borderColor: cornerBracketColor }]} />
              <View style={[styles.corner, styles.cBL, { borderColor: cornerBracketColor }]} />
              <View style={[styles.corner, styles.cBR, { borderColor: cornerBracketColor }]} />

              <View
                style={[
                  styles.idleOval,
                  isHandsFree && styles.idleOvalHandsFree,
                  cooldownRemaining > 0 && styles.idleOvalCooldown,
                ]}
              />
            </View>
          </Animated.View>
        )}

        {/* Contador Regressivo de Cooldown */}
        {cooldownRemaining > 0 && (
          <View style={styles.cooldownOverlay} pointerEvents="none">
            <Text style={styles.cooldownText}>{cooldownRemaining}s</Text>
            <Text style={styles.cooldownSub}>Aguarde para nova leitura</Text>
          </View>
        )}

        {/* Barra Inferior de Instrução Contextual (Zero colisão com FeedbackBadge no topo) */}
        {!disabled && cooldownRemaining === 0 && (
          <View style={styles.bottomGuideBar} pointerEvents="none">
            <View style={styles.guidePill}>
              <Feather
                name={isHandsFree ? "eye" : "user-check"}
                size={13}
                color={isHandsFree ? "#34D399" : "#F8FAFC"}
              />
              <Text style={styles.guideText}>
                {isHandsFree
                  ? "Olhe para a câmera — leitura automática em andamento"
                  : "Alinhe o rosto no guia central e toque em Entrada ou Saída"}
              </Text>
            </View>
          </View>
        )}

        {/* HUD Fluido de Escaneamento Biométrico */}
        {disabled && <BiometricScanHUD action={currentAction} />}

        {/* Pulso Fotométrico de Tela para Vivacidade Ativa (clareia a tela no segundo frame) */}
        {flashPulseActive && <View style={styles.flashOverlay} pointerEvents="none" />}

        {/* Badge Animada de Notificação Flutuante */}
        <FeedbackBadge
          data={badgeData}
          onDismiss={() => setBadgeData(null)}
          autoCloseMs={4500}
          isDark={isDark}
        />
      </View>

      {/* Botões de Ação Tátil de Quiosque (Lei de Fitts: minHeight 64) */}
      <View style={styles.actions}>
        <SmoothActionButton
          label="Entrada"
          sublabel="Registrar chegada"
          type="entrada"
          busy={disabled && currentAction === "check_in"}
          disabled={disabled}
          onPress={() => capture("check_in")}
          accessibilityLabel="Registrar Entrada"
          accessibilityHint="Captura seu rosto e inicia o registro de presença"
        />

        <SmoothActionButton
          label="Saída"
          sublabel="Encerrar permanência"
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

/** Botão Tátil de Quiosque com física de mola */
function SmoothActionButton({
  label,
  sublabel,
  type,
  busy,
  disabled,
  onPress,
  accessibilityLabel,
  accessibilityHint,
}: {
  label: string;
  sublabel?: string;
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
    triggerHaptic("tap");
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      friction: 6,
      tension: 180,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      tension: 120,
      useNativeDriver: true,
    }).start();
  };

  useEffect(() => {
    Animated.timing(opacityAnim, {
      toValue: disabled && !busy ? 0.65 : 1,
      duration: 180,
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
            <Text style={styles.actionText}>Verificando biometria...</Text>
          </View>
        ) : (
          <View style={styles.buttonRow}>
            <View style={styles.buttonIconTile}>
              <Feather
                name={type === "entrada" ? "log-in" : "log-out"}
                size={20}
                color="#FFFFFF"
              />
            </View>
            <View style={styles.buttonContent}>
              <Text style={styles.actionText}>{label}</Text>
              {sublabel && <Text style={styles.sublabelText}>{sublabel}</Text>}
            </View>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

/** HUD de Varredura Biométrica */
function BiometricScanHUD({ action }: { action: "check_in" | "check_out" | null }) {
  const scanAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, {
          toValue: 1,
          duration: 850,
          useNativeDriver: true,
        }),
        Animated.timing(scanAnim, {
          toValue: 0,
          duration: 850,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [scanAnim]);

  const translateY = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 180],
  });

  const accentColor = action === "check_in" ? "#10B981" : "#EA580C";

  return (
    <View style={styles.hudOverlay} pointerEvents="none">
      <View style={[styles.reticle, { borderColor: "rgba(255, 255, 255, 0.32)" }]}>
        <View style={[styles.corner, styles.cTL, { borderColor: accentColor }]} />
        <View style={[styles.corner, styles.cTR, { borderColor: accentColor }]} />
        <View style={[styles.corner, styles.cBL, { borderColor: accentColor }]} />
        <View style={[styles.corner, styles.cBR, { borderColor: accentColor }]} />

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

      <View style={styles.hudPill}>
        <ActivityIndicator color="#FFFFFF" size="small" />
        <Text style={styles.hudText}>
          {action === "check_in"
            ? "Verificando Entrada..."
            : action === "check_out"
            ? "Verificando Saída..."
            : "Analisando Biometria..."}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: 12 },
  permCard: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 28,
  },
  permCardDark: {
    backgroundColor: "#0F1623",
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  permIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "rgba(234, 88, 12, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(234, 88, 12, 0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  permTitle: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  permTitleDark: {
    color: "#F8FAFC",
  },
  permText: {
    color: "#64748B",
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 420,
  },
  permTextDark: {
    color: "#94A3B8",
  },
  permBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#EA580C",
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 14,
    minHeight: 46,
    marginTop: 4,
  },
  permBtnText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 14,
  },
  cameraWrapper: {
    flex: 1,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#090D16",
    position: "relative",
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  cameraWrapperDark: {
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  camera: { flex: 1 },
  topStatusRow: {
    position: "absolute",
    top: 14,
    left: 14,
    right: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 20,
  },
  handsFreeToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(9, 13, 22, 0.78)",
    paddingHorizontal: 13,
    paddingVertical: 8,
    minHeight: 36,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
  },
  handsFreeToggleActive: {
    backgroundColor: "rgba(5, 150, 105, 0.88)",
    borderColor: "rgba(52, 211, 153, 0.6)",
  },
  handsFreeText: {
    color: "#FFFFFF",
    fontSize: 11.5,
    fontWeight: "700",
  },
  telemetryPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(9, 13, 22, 0.72)",
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
  },
  telemetryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
  },
  telemetryText: {
    color: "#E2E8F0",
    fontSize: 10.5,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  offlineBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(217, 119, 6, 0.90)",
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.55)",
  },
  offlineBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
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
  reticleFrame: {
    width: 224,
    height: 268,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  idleOval: {
    width: 192,
    height: 238,
    borderRadius: 98,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "rgba(255, 255, 255, 0.50)",
  },
  idleOvalHandsFree: {
    borderColor: "rgba(16, 185, 129, 0.88)",
    borderWidth: 2.5,
    borderStyle: "solid",
  },
  idleOvalCooldown: {
    borderColor: "rgba(245, 158, 11, 0.85)",
  },
  bottomGuideBar: {
    position: "absolute",
    bottom: 14,
    left: 14,
    right: 14,
    alignItems: "center",
    zIndex: 15,
  },
  guidePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(9, 13, 22, 0.80)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
  },
  guideText: {
    color: "#F8FAFC",
    fontSize: 12.5,
    fontWeight: "700",
    textAlign: "center",
  },
  hudOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(9, 13, 22, 0.28)",
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
  cTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 16 },
  cTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 16 },
  cBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 16 },
  cBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 16 },
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
    bottom: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(9, 13, 22, 0.88)",
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
  },
  hudText: {
    color: "#FFFFFF",
    fontSize: 13.5,
    fontWeight: "700",
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  actionWrapper: {
    flex: 1,
  },
  action: {
    width: "100%",
    minHeight: 64,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
    borderWidth: 1,
  },
  buttonBusy: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  buttonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  buttonIconTile: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonContent: {
    alignItems: "flex-start",
    gap: 1,
  },
  entrada: {
    backgroundColor: "#059669",
    borderColor: "rgba(52, 211, 153, 0.45)",
    shadowColor: "#059669",
  },
  saida: {
    backgroundColor: "#EA580C",
    borderColor: "rgba(251, 146, 60, 0.45)",
    shadowColor: "#EA580C",
  },
  actionBusy: {
    backgroundColor: "#1E293B",
    borderColor: "rgba(255, 255, 255, 0.22)",
  },
  actionText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 16,
    letterSpacing: -0.2,
  },
  sublabelText: {
    color: "rgba(255, 255, 255, 0.80)",
    fontSize: 11.5,
    fontWeight: "600",
  },
  flashOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#E0F7FA",
    opacity: 0.88,
    zIndex: 999,
  },
  cooldownOverlay: {
    position: "absolute",
    bottom: 62,
    alignSelf: "center",
    backgroundColor: "rgba(15, 22, 35, 0.90)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.55)",
    paddingHorizontal: 18,
    paddingVertical: 8,
    alignItems: "center",
    gap: 1,
  },
  cooldownText: {
    color: "#FBBF24",
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -0.5,
    lineHeight: 28,
    fontVariant: ["tabular-nums"],
  },
  cooldownSub: {
    color: "#F8FAFC",
    fontSize: 11,
    fontWeight: "600",
  },
});
