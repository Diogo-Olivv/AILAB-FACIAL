import React, { useEffect, useRef } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export type FeedbackBadgeType =
  | "check_in"
  | "check_out"
  | "enroll_success"
  | "not_recognized"
  | "spoof_detected"
  | "warning"
  | "error";

export interface FeedbackBadgeData {
  type: FeedbackBadgeType;
  title?: string;
  name?: string;
  message?: string;
  detail?: string;
  durationMinutes?: number;
}

interface Props {
  data: FeedbackBadgeData | null;
  onDismiss: () => void;
  autoCloseMs?: number;
}

interface BadgeConfig {
  pillText: string;
  pillBg: string;
  pillColor: string;
  accentColor: string;
  iconBg: string;
  iconSymbol: string;
  defaultTitle: string;
  defaultMessage: string;
}

const BADGE_CONFIGS: Record<FeedbackBadgeType, BadgeConfig> = {
  check_in: {
    pillText: "ENTRADA REGISTRADA",
    pillBg: "rgba(22, 101, 52, 0.12)",
    pillColor: "#166534",
    accentColor: "#166534",
    iconBg: "#166534",
    iconSymbol: "✓",
    defaultTitle: "Presença Confirmada!",
    defaultMessage: "Tenha um excelente período de atividades no AILAB Makers.",
  },
  check_out: {
    pillText: "SAÍDA REGISTRADA",
    pillBg: "rgba(30, 45, 95, 0.12)",
    pillColor: "#1E2D5F",
    accentColor: "#1E2D5F",
    iconBg: "#1E2D5F",
    iconSymbol: "⏱",
    defaultTitle: "Sessão Finalizada!",
    defaultMessage: "Até a próxima! Suas horas de hoje foram contabilizadas.",
  },
  enroll_success: {
    pillText: "CADASTRO CONCLUÍDO",
    pillBg: "rgba(201, 169, 97, 0.18)",
    pillColor: "#9A7B38",
    accentColor: "#C9A961",
    iconBg: "#166534",
    iconSymbol: "★",
    defaultTitle: "Biometria Registrada!",
    defaultMessage: "Novo integrante apto para reconhecimento no totem do laboratório.",
  },
  not_recognized: {
    pillText: "ROSTO NÃO RECONHECIDO",
    pillBg: "rgba(217, 119, 6, 0.14)",
    pillColor: "#B45309",
    accentColor: "#D97706",
    iconBg: "#B45309",
    iconSymbol: "?",
    defaultTitle: "Não Encontrado na Base",
    defaultMessage: "Aproxime-se e olhe diretamente para a lente ou contate um tutor.",
  },
  spoof_detected: {
    pillText: "VERIFICAÇÃO DE VIVACIDADE",
    pillBg: "rgba(220, 38, 38, 0.14)",
    pillColor: "#DC2626",
    accentColor: "#DC2626",
    iconBg: "#DC2626",
    iconSymbol: "!",
    defaultTitle: "Falha de Vivacidade Presencial",
    defaultMessage: "Fique de frente para a câmera. Não são permitidas fotos ou telas.",
  },
  warning: {
    pillText: "ATENÇÃO",
    pillBg: "rgba(217, 119, 6, 0.14)",
    pillColor: "#B45309",
    accentColor: "#D97706",
    iconBg: "#B45309",
    iconSymbol: "i",
    defaultTitle: "Aviso de Presença",
    defaultMessage: "Verifique seu status no laboratório.",
  },
  error: {
    pillText: "ERRO DE COMUNICAÇÃO",
    pillBg: "rgba(220, 38, 38, 0.14)",
    pillColor: "#DC2626",
    accentColor: "#DC2626",
    iconBg: "#DC2626",
    iconSymbol: "✕",
    defaultTitle: "Não foi possível concluir",
    defaultMessage: "Verifique a conexão de rede do totem e tente novamente.",
  },
};

export function FeedbackBadge({ data, onDismiss, autoCloseMs = 4500 }: Props) {
  const slideAnim = useRef(new Animated.Value(-60)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.94)).current;
  const progressAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!data) return;

    slideAnim.setValue(-40);
    opacityAnim.setValue(0);
    scaleAnim.setValue(0.95);
    progressAnim.setValue(1);

    // Entrada suave com amortecimento elástico
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 7,
        tension: 45,
        useNativeDriver: true,
      }),
      // Barra de progresso do auto-dismiss
      Animated.timing(progressAnim, {
        toValue: 0,
        duration: autoCloseMs,
        useNativeDriver: false,
      }),
    ]).start();

    // Timer de auto-dismiss
    const timer = setTimeout(() => {
      dismiss();
    }, autoCloseMs);

    return () => clearTimeout(timer);
  }, [data, autoCloseMs]);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -30,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss();
    });
  };

  if (!data) return null;

  const cfg = BADGE_CONFIGS[data.type] || BADGE_CONFIGS.warning;
  const title = data.title || cfg.defaultTitle;
  const message = data.message || cfg.defaultMessage;

  return (
    <Animated.View
      style={[
        styles.wrapper,
        {
          opacity: opacityAnim,
          transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={dismiss}
        style={[styles.card, { borderColor: cfg.accentColor }]}
      >
        {/* Top Accent Strip */}
        <View style={[styles.topStrip, { backgroundColor: cfg.accentColor }]} />

        <View style={styles.cardContent}>
          {/* Circular Visual Icon Badge */}
          <View style={[styles.iconContainer, { backgroundColor: cfg.iconBg }]}>
            <Text style={styles.iconGlyph}>{cfg.iconSymbol}</Text>
          </View>

          {/* Texts Column */}
          <View style={styles.textColumn}>
            {/* Pill Category Tag */}
            <View style={[styles.pillBadge, { backgroundColor: cfg.pillBg }]}>
              <View style={[styles.pillDot, { backgroundColor: cfg.pillColor }]} />
              <Text style={[styles.pillText, { color: cfg.pillColor }]}>{cfg.pillText}</Text>
            </View>

            {/* Member Name or Main Title */}
            {data.name ? (
              <Text style={styles.nameTitle} numberOfLines={1}>
                {data.name}
              </Text>
            ) : (
              <Text style={styles.headerTitle} numberOfLines={1}>
                {title}
              </Text>
            )}

            {/* Subtitle / Details */}
            {data.name && title !== data.name && (
              <Text style={styles.subTitle} numberOfLines={1}>
                {title}
              </Text>
            )}

            <Text style={styles.messageText} numberOfLines={2}>
              {message}
            </Text>

            {/* Session Duration Pill if present */}
            {data.durationMinutes != null && data.durationMinutes > 0 && (
              <View style={styles.metaRow}>
                <Text style={styles.durationTag}>
                  Duração: <Text style={styles.durationValue}>{data.durationMinutes} min</Text>
                </Text>
              </View>
            )}

            {data.detail && <Text style={styles.detailText}>{data.detail}</Text>}
          </View>

          {/* Dismiss hint button */}
          <View style={styles.closeHint}>
            <Text style={styles.closeHintText}>✕</Text>
          </View>
        </View>

        {/* Bottom smooth progress bar */}
        <View style={styles.progressBarContainer}>
          <Animated.View
            style={[
              styles.progressBar,
              {
                backgroundColor: cfg.accentColor,
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0%", "100%"],
                }),
              },
            ]}
          />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    top: 14,
    left: 14,
    right: 14,
    zIndex: 999,
    shadowColor: "#141A33",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 12,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1.5,
    overflow: "hidden",
  },
  topStrip: {
    height: 4,
    width: "100%",
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
    elevation: 4,
  },
  iconGlyph: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
  },
  textColumn: {
    flex: 1,
    gap: 3,
  },
  pillBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    marginBottom: 2,
  },
  pillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pillText: {
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  nameTitle: {
    color: "#141A33",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  headerTitle: {
    color: "#141A33",
    fontSize: 16,
    fontWeight: "700",
  },
  subTitle: {
    color: "#1E2D5F",
    fontSize: 13,
    fontWeight: "600",
  },
  messageText: {
    color: "#6B6F82",
    fontSize: 12.5,
    lineHeight: 16,
    marginTop: 1,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
  },
  durationTag: {
    fontSize: 12,
    color: "#1E2D5F",
    fontWeight: "600",
    backgroundColor: "rgba(30, 45, 95, 0.08)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  durationValue: {
    fontWeight: "800",
    color: "#166534",
  },
  detailText: {
    color: "#9A3412",
    fontSize: 11,
    marginTop: 2,
    fontWeight: "500",
  },
  closeHint: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(30, 45, 95, 0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeHintText: {
    color: "#6B6F82",
    fontSize: 12,
    fontWeight: "700",
  },
  progressBarContainer: {
    height: 3,
    width: "100%",
    backgroundColor: "rgba(30, 45, 95, 0.08)",
  },
  progressBar: {
    height: 3,
  },
});
