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
  iconSymbolColor: string;
  iconSymbol: string;
  defaultTitle: string;
  defaultMessage: string;
}

const BADGE_CONFIGS: Record<FeedbackBadgeType, BadgeConfig> = {
  check_in: {
    pillText: "ENTRADA REGISTRADA",
    pillBg: "#ECFDF5",
    pillColor: "#065F46",
    accentColor: "#10B981",
    iconBg: "#ECFDF5",
    iconSymbolColor: "#059669",
    iconSymbol: "✓",
    defaultTitle: "Presença Confirmada",
    defaultMessage: "Tenha um excelente período de atividades no AILAB Makers.",
  },
  check_out: {
    pillText: "SAÍDA REGISTRADA",
    pillBg: "#FAF5F0",
    pillColor: "#C15F3D",
    accentColor: "#C15F3D",
    iconBg: "#FAF5F0",
    iconSymbolColor: "#C15F3D",
    iconSymbol: "⏱",
    defaultTitle: "Sessão Finalizada",
    defaultMessage: "Até a próxima! Suas horas foram computadas.",
  },
  enroll_success: {
    pillText: "CADASTRO CONCLUÍDO",
    pillBg: "#FEFCE8",
    pillColor: "#854D0E",
    accentColor: "#EAB308",
    iconBg: "#FEFCE8",
    iconSymbolColor: "#CA8A04",
    iconSymbol: "★",
    defaultTitle: "Biometria Registrada",
    defaultMessage: "Novo integrante apto para reconhecimento no totem.",
  },
  not_recognized: {
    pillText: "NÃO RECONHECIDO",
    pillBg: "#FFFBEB",
    pillColor: "#92400E",
    accentColor: "#F59E0B",
    iconBg: "#FFFBEB",
    iconSymbolColor: "#D97706",
    iconSymbol: "?",
    defaultTitle: "Rosto Não Identificado",
    defaultMessage: "Aproxime-se do centro da lente ou contate um tutor.",
  },
  spoof_detected: {
    pillText: "VIVACIDADE PRESENCIAL",
    pillBg: "#FEF2F2",
    pillColor: "#991B1B",
    accentColor: "#EF4444",
    iconBg: "#FEF2F2",
    iconSymbolColor: "#DC2626",
    iconSymbol: "!",
    defaultTitle: "Falha de Vivacidade",
    defaultMessage: "Fique de frente para a câmera. Não são permitidas fotos ou telas.",
  },
  warning: {
    pillText: "AVISO",
    pillBg: "#FAF9F5",
    pillColor: "#706E6A",
    accentColor: "#706E6A",
    iconBg: "#FAF9F5",
    iconSymbolColor: "#706E6A",
    iconSymbol: "ℹ",
    defaultTitle: "Aviso de Presença",
    defaultMessage: "Verifique seu status no laboratório.",
  },
  error: {
    pillText: "ERRO DE COMUNICAÇÃO",
    pillBg: "#FEF2F2",
    pillColor: "#991B1B",
    accentColor: "#DC2626",
    iconBg: "#FEF2F2",
    iconSymbolColor: "#DC2626",
    iconSymbol: "✕",
    defaultTitle: "Não foi possível concluir",
    defaultMessage: "Verifique a conexão de rede do totem e tente novamente.",
  },
};

export function FeedbackBadge({ data, onDismiss, autoCloseMs = 4500 }: Props) {
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

    // Entrada fluída estilo Apple Spring
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 50,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 7,
        tension: 55,
        useNativeDriver: true,
      }),
      // Barra de progresso suave
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
        toValue: -20,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.96,
        duration: 180,
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
        style={[styles.card, { borderColor: cfg.accentColor + "40" }]}
      >
        {/* Linha sutil de acento superior */}
        <View style={[styles.topStrip, { backgroundColor: cfg.accentColor }]} />

        <View style={styles.cardContent}>
          {/* Badge de Ícone Circular Minimalista */}
          <View style={[styles.iconContainer, { backgroundColor: cfg.iconBg, borderColor: cfg.accentColor + "30" }]}>
            <Text style={[styles.iconGlyph, { color: cfg.iconSymbolColor }]}>{cfg.iconSymbol}</Text>
          </View>

          {/* Coluna de Textos */}
          <View style={styles.textColumn}>
            {/* Tag Categoria estilo Perplexity Mono Pill */}
            <View style={[styles.pillBadge, { backgroundColor: cfg.pillBg }]}>
              <View style={[styles.pillDot, { backgroundColor: cfg.pillColor }]} />
              <Text style={[styles.pillText, { color: cfg.pillColor }]}>{cfg.pillText}</Text>
            </View>

            {/* Nome do Integrante ou Título */}
            {data.name ? (
              <Text style={styles.nameTitle} numberOfLines={1}>
                {data.name}
              </Text>
            ) : (
              <Text style={styles.headerTitle} numberOfLines={1}>
                {title}
              </Text>
            )}

            {/* Subtítulo / Detalhes */}
            {data.name && title !== data.name && (
              <Text style={styles.subTitle} numberOfLines={1}>
                {title}
              </Text>
            )}

            <Text style={styles.messageText} numberOfLines={2}>
              {message}
            </Text>

            {/* Pílula de Duração em Monospace */}
            {data.durationMinutes != null && data.durationMinutes > 0 && (
              <View style={styles.metaRow}>
                <View style={styles.durationTag}>
                  <Text style={styles.durationLabel}>
                    Duração: <Text style={styles.durationValue}>{data.durationMinutes} min</Text>
                  </Text>
                </View>
              </View>
            )}

            {data.detail && <Text style={styles.detailText}>{data.detail}</Text>}
          </View>

          {/* Botão de Fechar Sutil */}
          <View style={styles.closeHint}>
            <Text style={styles.closeHintText}>✕</Text>
          </View>
        </View>

        {/* Barra de Progresso Fina */}
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
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 999,
    paddingHorizontal: 16,
  },
  card: {
    width: "100%",
    maxWidth: 480,
    backgroundColor: "rgba(255, 255, 255, 0.96)",
    borderRadius: 22,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#171715",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
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
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  iconGlyph: {
    fontSize: 20,
    fontWeight: "700",
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
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  nameTitle: {
    color: "#171715",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  headerTitle: {
    color: "#171715",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  subTitle: {
    color: "#706E6A",
    fontSize: 12,
    fontWeight: "500",
  },
  messageText: {
    color: "#706E6A",
    fontSize: 12,
    lineHeight: 16,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  durationTag: {
    backgroundColor: "#FAF5F0",
    borderWidth: 1,
    borderColor: "#F0DCD3",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  durationLabel: {
    fontSize: 11,
    color: "#706E6A",
  },
  durationValue: {
    fontWeight: "700",
    color: "#C15F3D",
  },
  detailText: {
    color: "#C15F3D",
    fontSize: 11,
    marginTop: 1,
    fontWeight: "500",
  },
  closeHint: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0, 0, 0, 0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeHintText: {
    color: "#706E6A",
    fontSize: 11,
    fontWeight: "600",
  },
  progressBarContainer: {
    height: 2,
    width: "100%",
    backgroundColor: "rgba(0, 0, 0, 0.04)",
  },
  progressBar: {
    height: 2,
  },
});
