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
import { enqueueOfflineAttendance, getOfflineQueueCount } from "@/lib/offlineQueue";
import { Feather, Ionicons } from "@expo/vector-icons";

export function RecognitionPanel() {
  const [permission, requestPermission] = useCameraPermissions();
  const { recognize, loading } = useRecognize();
  const cameraRef = useRef<CameraView>(null);
  const [busy, setBusy] = useState(false);
  const [currentAction, setCurrentAction] = useState<"check_in" | "check_out" | null>(null);
  const [badgeData, setBadgeData] = useState<FeedbackBadgeData | null>(null);
  const { active, cameraKey } = useCameraFocus();

  // Estados Hands-Free e Resiliência Offline
  const [isHandsFree, setIsHandsFree] = useState(false);
  const [pendingOfflineCount, setPendingOfflineCount] = useState(0);
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
          toValue: 1.035,
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

  // Monitora contagem de presenças offline pendentes de sincronização
  useEffect(() => {
    let mounted = true;
    const checkQueue = async () => {
      try {
        const count = await getOfflineQueueCount();
        if (mounted) setPendingOfflineCount(count);
      } catch {
        // ignora
      }
    };
    checkQueue();
    const interval = setInterval(checkQueue, 8000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

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

        // Segundo frame com pulso fotométrico ativo (3D Flash Liveness - ISO/IEC 30107-3)
        if (uris.length > 0 && cameraRef.current) {
          try {
            // Emite pulso luminoso na tela para análise de reflexo especular na face
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
          startCooldown();
          try {
            await enqueueOfflineAttendance({
              timestamp: new Date().toISOString(),
              action: action || null,
            });
            const count = await getOfflineQueueCount();
            setPendingOfflineCount(count);
            notifyInteraction("warning");
            setBadgeData({
              type: "warning",
              title: "Presença Salva Offline",
              message:
                "Sem conexão com o servidor. A presença foi armazenada no tablet e será sincronizada assim que a internet retornar.",
            });
          } catch {
            notifyInteraction("error");
            setBadgeData({
              type: "error",
              title: "Falha de Conexão",
              message: "Não foi possível comunicar com o servidor do laboratório.",
            });
          }
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
              durationMinutes: displayMins,
              message: durationMsg,
            });
          } else if (evtAction === "already_in") {
            notifyInteraction("warning");
            setBadgeData({
              type: "warning",
              name: res.name,
              title: "Usuário Já Presente",
              message: "Sua entrada já está ativa. Caso deseje sair, clique no botão 'Saída'.",
            });
          } else if (evtAction === "not_in") {
            notifyInteraction("warning");
            setBadgeData({
              type: "warning",
              name: res.name,
              title: "Entrada Não Encontrada",
              message: "Você ainda não deu entrada no laboratório hoje. Clique em 'Entrada'.",
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
      } catch (err: any) {
        startCooldown();
        console.error("[RecognitionPanel] Erro ao registrar biometria:", err);
        // Em caso de falha de conexão, salva no buffer offline
        try {
          await enqueueOfflineAttendance({
            timestamp: new Date().toISOString(),
            action: action || null,
          });
          const count = await getOfflineQueueCount();
          setPendingOfflineCount(count);
          notifyInteraction("warning");
          setBadgeData({
            type: "warning",
            title: "Presença Salva Offline",
            message:
              "Rede instável. Presença registrada localmente no totem para sincronização posterior.",
          });
        } catch {
          notifyInteraction("error");
          setBadgeData({
            type: "error",
            title: "Erro de Comunicação",
            message: extractErrorMessage(err) || GENERIC_ERROR_MESSAGE,
          });
        }
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
    ) return;

    kioskState.current = "PROCESSING";
    capture(null).finally(() => {
      // capture() vai setBusy(false) no finally — se der erro vira COOLDOWN
      // O estado SUCCESS/COOLDOWN é definido dentro do capture baseado no resultado
      if (kioskState.current === "PROCESSING") {
        kioskState.current = "IDLE";
      }
    });
  }, [isHandsFree, active, permission?.granted, capture]);

  // Scheduler da FSM para modo mãos-livres: dispara apenas se estado for rigorosamente IDLE
  useEffect(() => {
    if (!isHandsFree || !active || !permission?.granted) return;

    const interval = setInterval(() => {
      handleFaceDetected();
    }, 2000);

    return () => clearInterval(interval);
  }, [isHandsFree, active, permission?.granted, handleFaceDetected]);

  // Limpa timer de cooldown ao desmontar
  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    };
  }, []);

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

        {/* Barra superior de status do Kiosk: Modo Mãos-Livres e Buffer Offline */}
        <View style={styles.topStatusRow}>
          <TouchableOpacity
            style={[styles.handsFreeToggle, isHandsFree && styles.handsFreeToggleActive]}
            onPress={() => {
              triggerHaptic("tap");
              setIsHandsFree((prev) => !prev);
            }}
            activeOpacity={0.7}
            accessibilityRole="switch"
            accessibilityLabel="Alternar modo mãos-livres"
          >
            <Ionicons
              name={isHandsFree ? "sparkles" : "hand-left-outline"}
              size={14}
              color={isHandsFree ? "#065F46" : "#57534E"}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.handsFreeText, isHandsFree && styles.handsFreeTextActive]}>
              {isHandsFree ? "Mãos-Livres: Ativo" : "Manual"}
            </Text>
          </TouchableOpacity>

          {pendingOfflineCount > 0 && (
            <View style={[styles.offlineBadge, { flexDirection: "row", alignItems: "center", gap: 4 }]}>
              <Feather name="zap" size={11} color="#FFFFFF" />
              <Text style={styles.offlineBadgeText}>
                {pendingOfflineCount} offline
              </Text>
            </View>
          )}
        </View>

        {/* Banner com Instruções Claras para o Usuário */}
        <View style={styles.guideBanner} pointerEvents="none">
          <Text style={styles.guideText}>
            {isHandsFree
              ? "Mãos-livres: Centralize o rosto para registro automático"
              : "Alinhe seu rosto no centro e selecione Entrada ou Saída"}
          </Text>
        </View>

        {/* Contador regressivo de cooldown */}
        {cooldownRemaining > 0 && (
          <View style={styles.cooldownOverlay} pointerEvents="none">
            <Text style={styles.cooldownText}>{cooldownRemaining}s</Text>
            <Text style={styles.cooldownSub}>Aguarde para nova tentativa</Text>
          </View>
        )}

        {/* Guia Oval de Posicionamento Facial com Feedback Inteligente */}
        {!disabled && (
          <Animated.View
            style={[
              styles.idleOvalContainer,
              { transform: [{ scale: isHandsFree ? pulseAnim : 1 }] },
            ]}
            pointerEvents="none"
          >
            <View style={[styles.idleOval, isHandsFree && styles.idleOvalHandsFree]} />
          </Animated.View>
        )}

        {/* HUD Fluido de Escaneamento Biométrico */}
        {disabled && <BiometricScanHUD action={currentAction} />}

        {/* Pulso Fotométrico de Tela para Vivacidade Ativa (3D Flash Liveness PAD) */}
        {flashPulseActive && (
          <View style={styles.flashOverlay} pointerEvents="none" />
        )}

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

/** Botão Premium com feedback tátil suave e física de mola */
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
      toValue: 0.95,
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
          <View style={styles.buttonContent}>
            <View style={styles.buttonLabelRow}>
              {type === "entrada" ? (
                <Feather name="check" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              ) : (
                <Feather name="clock" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              )}
              <Text style={styles.actionText}>{label}</Text>
            </View>
            {sublabel && <Text style={styles.sublabelText}>{sublabel}</Text>}
          </View>
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

  const accentColor = action === "check_in" ? "#10B981" : "#3B82F6";

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
  container: { flex: 1, gap: 16 },
  center: { alignItems: "center", justifyContent: "center", gap: 16 },
  cameraWrapper: {
    flex: 1,
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: "#0F172A",
    position: "relative",
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.08)",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
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
    backgroundColor: "rgba(15, 23, 42, 0.22)",
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
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
  },
  hudText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  topStatusRow: {
    position: "absolute",
    top: 14,
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 20,
  },
  handsFreeToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  handsFreeToggleActive: {
    backgroundColor: "rgba(5, 150, 105, 0.85)",
    borderColor: "rgba(16, 185, 129, 0.5)",
  },
  handsFreeIcon: {
    fontSize: 13,
  },
  handsFreeText: {
    color: "#E2E8F0",
    fontSize: 11,
    fontWeight: "600",
  },
  handsFreeTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  offlineBadge: {
    backgroundColor: "rgba(217, 119, 6, 0.85)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.5)",
  },
  offlineBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  guideBanner: {
    position: "absolute",
    top: 50,
    left: 16,
    right: 16,
    alignItems: "center",
    zIndex: 10,
  },
  guideText: {
    backgroundColor: "rgba(15, 23, 42, 0.76)",
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 999,
    overflow: "hidden",
    textAlign: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
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
    borderColor: "rgba(255, 255, 255, 0.45)",
  },
  idleOvalHandsFree: {
    borderColor: "rgba(16, 185, 129, 0.8)",
    borderWidth: 2.5,
    borderStyle: "solid",
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
  },
  actions: { flexDirection: "row", gap: 14 },
  actionWrapper: { flex: 1 },
  action: {
    width: "100%",
    minHeight: 56,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
  },
  buttonBusy: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  buttonContent: {
    alignItems: "center",
    gap: 2,
  },
  buttonLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  buttonIcon: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  entrada: {
    backgroundColor: "#059669",
    borderColor: "rgba(16, 185, 129, 0.45)",
    shadowColor: "#059669",
  },
  saida: {
    backgroundColor: "#C15F3D",
    borderColor: "rgba(193, 95, 61, 0.45)",
    shadowColor: "#C15F3D",
  },
  actionBusy: {
    backgroundColor: "#334155",
    borderColor: "rgba(255, 255, 255, 0.30)",
  },
  disabled: { opacity: 0.65 },
  actionText: { color: "#FFFFFF", fontWeight: "700", fontSize: 16, letterSpacing: -0.2 },
  sublabelText: { color: "rgba(255, 255, 255, 0.72)", fontSize: 11, fontWeight: "500" },
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
  permText: { color: "#171715", fontSize: 16, textAlign: "center", paddingHorizontal: 32 },
  permBtn: {
    backgroundColor: "#171715",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  permBtnText: { color: "#FAF9F5", fontWeight: "600" },
  cooldownOverlay: {
    position: 'absolute',
    bottom: 80,
    alignSelf: 'center',
    backgroundColor: 'rgba(220, 38, 38, 0.88)',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 8,
    alignItems: 'center',
    gap: 2,
  },
  cooldownText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  cooldownSub: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
