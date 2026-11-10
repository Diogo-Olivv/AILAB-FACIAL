import React, { useEffect, useRef } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";

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
  durationMinutes?: number | string;
  isTutor?: boolean;
}

interface Props {
  data: FeedbackBadgeData | null;
  onDismiss: () => void;
  autoCloseMs?: number;
  isDark?: boolean;
}

interface BadgeConfig {
  pillText: string;
  pillBg: string;
  pillBgDark: string;
  pillColor: string;
  pillColorDark: string;
  accentColor: string;
  iconBg: string;
  iconBgDark: string;
  iconSymbolColor: string;
  iconSymbolColorDark: string;
  defaultTitle: string;
  defaultMessage: string;
}

const BADGE_CONFIGS: Record<FeedbackBadgeType, BadgeConfig> = {
  check_in: {
    pillText: "ENTRADA REGISTRADA",
    pillBg: "rgba(16, 185, 129, 0.12)",
    pillBgDark: "rgba(16, 185, 129, 0.18)",
    pillColor: "#065F46",
    pillColorDark: "#6EE7B7",
    accentColor: "#10B981",
    iconBg: "rgba(16, 185, 129, 0.12)",
    iconBgDark: "rgba(16, 185, 129, 0.18)",
    iconSymbolColor: "#059669",
    iconSymbolColorDark: "#34D399",
    defaultTitle: "Presença Confirmada",
    defaultMessage: "Tenha um excelente período de atividades no AILAB Makers.",
  },
  check_out: {
    pillText: "SAÍDA REGISTRADA",
    pillBg: "rgba(234, 88, 12, 0.12)",
    pillBgDark: "rgba(249, 115, 22, 0.18)",
    pillColor: "#9A3412",
    pillColorDark: "#FDBA74",
    accentColor: "#EA580C",
    iconBg: "rgba(234, 88, 12, 0.12)",
    iconBgDark: "rgba(249, 115, 22, 0.18)",
    iconSymbolColor: "#EA580C",
    iconSymbolColorDark: "#FB923C",
    defaultTitle: "Sessão Finalizada",
    defaultMessage: "Até a próxima! Suas horas foram computadas.",
  },
  enroll_success: {
    pillText: "CADASTRO CONCLUÍDO",
    pillBg: "rgba(16, 185, 129, 0.12)",
    pillBgDark: "rgba(16, 185, 129, 0.18)",
    pillColor: "#065F46",
    pillColorDark: "#6EE7B7",
    accentColor: "#10B981",
    iconBg: "rgba(16, 185, 129, 0.12)",
    iconBgDark: "rgba(16, 185, 129, 0.18)",
    iconSymbolColor: "#059669",
    iconSymbolColorDark: "#34D399",
    defaultTitle: "Biometria Registrada",
    defaultMessage: "Integrante apto para reconhecimento no totem.",
  },
  not_recognized: {
    pillText: "NÃO RECONHECIDO",
    pillBg: "rgba(245, 158, 11, 0.14)",
    pillBgDark: "rgba(245, 158, 11, 0.20)",
    pillColor: "#92400E",
    pillColorDark: "#FDE68A",
    accentColor: "#F59E0B",
    iconBg: "rgba(245, 158, 11, 0.14)",
    iconBgDark: "rgba(245, 158, 11, 0.20)",
    iconSymbolColor: "#D97706",
    iconSymbolColorDark: "#FBBF24",
    defaultTitle: "Rosto Não Identificado",
    defaultMessage: "Aproxime-se do centro da lente ou contate um tutor.",
  },
  spoof_detected: {
    pillText: "VIVACIDADE PRESENCIAL",
    pillBg: "rgba(244, 63, 94, 0.12)",
    pillBgDark: "rgba(244, 63, 94, 0.20)",
    pillColor: "#9F1239",
    pillColorDark: "#FDA4AF",
    accentColor: "#F43F5E",
    iconBg: "rgba(244, 63, 94, 0.12)",
    iconBgDark: "rgba(244, 63, 94, 0.20)",
    iconSymbolColor: "#E11D48",
    iconSymbolColorDark: "#FB7185",
    defaultTitle: "Falha de Vivacidade",
    defaultMessage: "Fique de frente para a câmera. Não são permitidas fotos ou telas.",
  },
  warning: {
    pillText: "ATENÇÃO",
    pillBg: "rgba(245, 158, 11, 0.14)",
    pillBgDark: "rgba(245, 158, 11, 0.20)",
    pillColor: "#92400E",
    pillColorDark: "#FDE68A",
    accentColor: "#F59E0B",
    iconBg: "rgba(245, 158, 11, 0.14)",
    iconBgDark: "rgba(245, 158, 11, 0.20)",
    iconSymbolColor: "#D97706",
    iconSymbolColorDark: "#FBBF24",
    defaultTitle: "Aviso de Presença",
    defaultMessage: "Verifique seu status no laboratório.",
  },
  error: {
    pillText: "ERRO DE COMUNICAÇÃO",
    pillBg: "rgba(244, 63, 94, 0.12)",
    pillBgDark: "rgba(244, 63, 94, 0.20)",
    pillColor: "#9F1239",
    pillColorDark: "#FDA4AF",
    accentColor: "#F43F5E",
    iconBg: "rgba(244, 63, 94, 0.12)",
    iconBgDark: "rgba(244, 63, 94, 0.20)",
    iconSymbolColor: "#E11D48",
    iconSymbolColorDark: "#FB7185",
    defaultTitle: "Não foi possível concluir",
    defaultMessage: "Verifique a conexão de rede do totem e tente novamente.",
  },
};

export function FeedbackBadge({ data, onDismiss, autoCloseMs = 4500, isDark = false }: Props) {
  const slideAnim = useRef(new Animated.Value(-40)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.96)).current;
  const progressAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!data) return;

    slideAnim.setValue(-30);
    opacityAnim.setValue(0);
    scaleAnim.setValue(0.96);
    progressAnim.setValue(1);

    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 50,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 7,
        tension: 55,
        useNativeDriver: true,
      }),
      Animated.timing(progressAnim, {
        toValue: 0,
        duration: autoCloseMs,
        useNativeDriver: false,
      }),
    ]).start();

    const timer = setTimeout(() => {
      dismiss();
    }, autoCloseMs);

    return () => clearTimeout(timer);
  }, [data, autoCloseMs]);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -20,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.96,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss();
    });
  };

  if (!data) return null;

  const baseCfg = BADGE_CONFIGS[data.type] || BADGE_CONFIGS.warning;
  const isTutor = Boolean(data.isTutor);
  const cfg: BadgeConfig = isTutor
    ? {
        ...baseCfg,
        pillText: data.type === "check_out" ? "SAÍDA DE TUTOR" : "TUTOR REGISTRADO",
        pillBg: "rgba(234, 88, 12, 0.14)",
        pillBgDark: "rgba(249, 115, 22, 0.22)",
        pillColor: "#9A3412",
        pillColorDark: "#FDBA74",
        accentColor: "#EA580C",
        iconBg: "rgba(234, 88, 12, 0.14)",
        iconBgDark: "rgba(249, 115, 22, 0.22)",
        iconSymbolColor: "#EA580C",
        iconSymbolColorDark: "#FB923C",
        defaultTitle: data.type === "check_out" ? "Saída de Tutor" : "Tutor no Laboratório",
        defaultMessage:
          data.type === "check_out"
            ? "Atividades de tutoria finalizadas."
            : "Atividades de tutoria confirmadas no AILAB Makers.",
      }
    : baseCfg;

  const title = data.title || cfg.defaultTitle;
  const message = data.message || cfg.defaultMessage;
  const symbolColor = isDark ? cfg.iconSymbolColorDark : cfg.iconSymbolColor;

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
        style={[
          styles.card,
          isDark && styles.cardDark,
          { borderColor: cfg.accentColor + (isDark ? "55" : "40") },
        ]}
      >
        <View style={[styles.topStrip, { backgroundColor: cfg.accentColor }]} />

        <View style={styles.cardContent}>
          <View
            style={[
              styles.iconContainer,
              {
                backgroundColor: isDark ? cfg.iconBgDark : cfg.iconBg,
                borderColor: cfg.accentColor + "35",
              },
            ]}
          >
            {data.type === "check_in" && <Feather name="log-in" size={18} color={symbolColor} />}
            {data.type === "check_out" && <Feather name="log-out" size={18} color={symbolColor} />}
            {data.type === "enroll_success" && <Feather name="user-check" size={18} color={symbolColor} />}
            {data.type === "not_recognized" && <Feather name="help-circle" size={18} color={symbolColor} />}
            {data.type === "spoof_detected" && <Feather name="shield" size={18} color={symbolColor} />}
            {data.type === "warning" && <Feather name="alert-triangle" size={18} color={symbolColor} />}
            {data.type === "error" && <Feather name="alert-circle" size={18} color={symbolColor} />}
          </View>

          <View style={styles.textColumn}>
            <View
              style={[
                styles.pillBadge,
                { backgroundColor: isDark ? cfg.pillBgDark : cfg.pillBg },
              ]}
            >
              <View
                style={[
                  styles.pillDot,
                  { backgroundColor: isDark ? cfg.pillColorDark : cfg.pillColor },
                ]}
              />
              <Text
                style={[
                  styles.pillText,
                  { color: isDark ? cfg.pillColorDark : cfg.pillColor },
                ]}
              >
                {cfg.pillText}
              </Text>
            </View>

            {data.name ? (
              <Text style={[styles.nameTitle, isDark && styles.nameTitleDark]} numberOfLines={1}>
                {data.name}
              </Text>
            ) : (
              <Text style={[styles.headerTitle, isDark && styles.headerTitleDark]} numberOfLines={1}>
                {title}
              </Text>
            )}

            {data.name && title !== data.name && (
              <Text style={[styles.subTitle, isDark && styles.subTitleDark]} numberOfLines={1}>
                {title}
              </Text>
            )}

            <Text style={[styles.messageText, isDark && styles.messageTextDark]} numberOfLines={2}>
              {message}
            </Text>

            {data.durationMinutes != null && data.durationMinutes !== "" && (
              <View style={styles.metaRow}>
                <View style={[styles.durationTag, isDark && styles.durationTagDark]}>
                  <Text style={[styles.durationLabel, isDark && styles.durationLabelDark]}>
                    Duração:{" "}
                    <Text style={[styles.durationValue, isDark && styles.durationValueDark]}>
                      {data.durationMinutes} min
                    </Text>
                  </Text>
                </View>
              </View>
            )}

            {data.detail && <Text style={styles.detailText}>{data.detail}</Text>}
          </View>

          <View style={[styles.closeHint, isDark && styles.closeHintDark]}>
            <Feather name="x" size={14} color={isDark ? "#94A3B8" : "#64748B"} />
          </View>
        </View>

        <View style={[styles.progressBarContainer, isDark && styles.progressBarContainerDark]}>
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
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 999,
    paddingHorizontal: 16,
  },
  card: {
    width: "100%",
    maxWidth: 500,
    backgroundColor: "rgba(255, 255, 255, 0.97)",
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 10,
  },
  cardDark: {
    backgroundColor: "rgba(15, 22, 35, 0.97)",
    shadowColor: "#000000",
    shadowOpacity: 0.5,
  },
  topStrip: {
    height: 3,
    width: "100%",
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 13,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  textColumn: {
    flex: 1,
    gap: 2.5,
  },
  pillBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 999,
    marginBottom: 2,
  },
  pillDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  pillText: {
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  nameTitle: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  nameTitleDark: {
    color: "#F8FAFC",
  },
  headerTitle: {
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  headerTitleDark: {
    color: "#F8FAFC",
  },
  subTitle: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "600",
  },
  subTitleDark: {
    color: "#CBD5E1",
  },
  messageText: {
    color: "#64748B",
    fontSize: 12,
    lineHeight: 16,
  },
  messageTextDark: {
    color: "#94A3B8",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
  },
  durationTag: {
    backgroundColor: "rgba(234, 88, 12, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(234, 88, 12, 0.25)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  durationTagDark: {
    backgroundColor: "rgba(249, 115, 22, 0.16)",
    borderColor: "rgba(249, 115, 22, 0.32)",
  },
  durationLabel: {
    fontSize: 11,
    color: "#475569",
    fontVariant: ["tabular-nums"],
  },
  durationLabelDark: {
    color: "#CBD5E1",
  },
  durationValue: {
    fontWeight: "800",
    color: "#EA580C",
    fontVariant: ["tabular-nums"],
  },
  durationValueDark: {
    color: "#FB923C",
  },
  detailText: {
    color: "#EA580C",
    fontSize: 11,
    marginTop: 1,
    fontWeight: "600",
  },
  closeHint: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  closeHintDark: {
    backgroundColor: "#161F30",
  },
  progressBarContainer: {
    height: 2.5,
    width: "100%",
    backgroundColor: "rgba(15, 23, 42, 0.05)",
  },
  progressBarContainerDark: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },
  progressBar: {
    height: 2.5,
  },
});
