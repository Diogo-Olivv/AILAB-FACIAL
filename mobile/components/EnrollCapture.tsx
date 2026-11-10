import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useCameraPermissions } from "expo-camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useEnroll } from "@/hooks/useEnroll";
import { SequentialCamera } from "@/components/SequentialCamera";
import { FeedbackBadge, type FeedbackBadgeData } from "@/components/FeedbackBadge";
import { TermsModal } from "@/components/TermsModal";
import { ENROLL_PHOTO_COUNT, MATRICULA_LENGTH } from "@/lib/config";
import { notifyInteraction } from "@/lib/sound";

interface Props {
  tutorToken?: string;
  isDark?: boolean;
}

export function EnrollCapture({ tutorToken, isDark = false }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const { enroll, loading } = useEnroll();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState("");
  const [matricula, setMatricula] = useState("");
  const [consent, setConsent] = useState(false);
  const [shots, setShots] = useState<string[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [badgeData, setBadgeData] = useState<FeedbackBadgeData | null>(null);
  const [termsOpen, setTermsOpen] = useState(false);

  const matriculaValid = new RegExp(`^\\d{${MATRICULA_LENGTH}}$`).test(matricula);
  const canSubmit =
    name.trim().length > 0 &&
    matriculaValid &&
    consent &&
    shots.length === ENROLL_PHOTO_COUNT;

  const openCamera = useCallback(async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) return;
    }
    setCameraOpen(true);
  }, [permission, requestPermission]);

  const onCaptured = useCallback((uris: string[]) => {
    setShots(uris);
    setCameraOpen(false);
  }, []);

  const submit = useCallback(async () => {
    setFeedback(null);
    setBadgeData(null);
    const outcome = await enroll(
      name.trim(),
      matricula.trim(),
      consent,
      shots.map((uri, i) => ({ uri, name: `frame_${i}.jpg`, type: "image/jpeg" })),
      tutorToken
    );
    if (outcome.ok) {
      notifyInteraction("enroll");
      const { name: enrolledName, photos_used } = outcome.data;
      setBadgeData({
        type: "enroll_success",
        name: enrolledName,
        title: "Cadastro Concluído!",
        message: `Novo integrante cadastrado com ${photos_used} fotos processadas.`,
      });
      setFeedback({ ok: true, text: `${enrolledName} cadastrado(a) com ${photos_used} fotos.` });
      setName("");
      setMatricula("");
      setConsent(false);
      setShots([]);
    } else {
      notifyInteraction("error");
      setBadgeData({
        type: "error",
        title: "Falha no Cadastro",
        message: outcome.message,
      });
      setFeedback({ ok: false, text: outcome.message });
    }
  }, [enroll, name, matricula, consent, shots, tutorToken]);

  return (
    <View style={[styles.root, isDark && styles.rootDark]}>
      <FeedbackBadge
        data={badgeData}
        onDismiss={() => setBadgeData(null)}
        autoCloseMs={5000}
        isDark={isDark}
      />
      <ScrollView
        style={[styles.container, isDark && styles.containerDark]}
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom: insets.bottom + 40,
            paddingLeft: insets.left + 16,
            paddingRight: insets.right + 16,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Seção 1: Identificação Acadêmica */}
        <View style={[styles.card, isDark && styles.cardDark]}>
          <Text style={[styles.stepEyebrow, isDark && styles.stepEyebrowDark]}>
            ETAPA 1 · IDENTIFICAÇÃO ACADÊMICA
          </Text>
          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={[styles.label, isDark && styles.labelDark]}>Nome completo</Text>
              <TextInput
                style={[styles.input, isDark && styles.inputDark]}
                placeholder="Ex.: Ana Beatriz Silva"
                placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                value={name}
                onChangeText={setName}
              />
            </View>
            <View style={styles.col}>
              <View style={styles.labelRow}>
                <Text style={[styles.label, isDark && styles.labelDark]}>Matrícula</Text>
                <Text
                  style={[
                    styles.counterBadge,
                    matriculaValid && styles.counterBadgeValid,
                  ]}
                >
                  {matricula.length}/{MATRICULA_LENGTH}
                </Text>
              </View>
              <TextInput
                style={[styles.input, styles.inputMono, isDark && styles.inputDark]}
                placeholder={`${MATRICULA_LENGTH} dígitos`}
                placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                value={matricula}
                onChangeText={(t) =>
                  setMatricula(t.replace(/\D/g, "").slice(0, MATRICULA_LENGTH))
                }
                keyboardType="number-pad"
                maxLength={MATRICULA_LENGTH}
              />
              {matricula.length > 0 && !matriculaValid && (
                <Text style={styles.hint}>
                  Informe exatamente {MATRICULA_LENGTH} números.
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Seção 2: Captura Biométrica Multi-Frame */}
        <View style={[styles.card, isDark && styles.cardDark]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.stepEyebrow, isDark && styles.stepEyebrowDark]}>
              ETAPA 2 · CAPTURA BIOMÉTRICA ({ENROLL_PHOTO_COUNT} FRAMES)
            </Text>
            <View
              style={[
                styles.photoCountBadge,
                shots.length === ENROLL_PHOTO_COUNT && styles.photoCountBadgeDone,
                isDark && styles.photoCountBadgeDark,
              ]}
            >
              <Text
                style={[
                  styles.photoCountText,
                  shots.length === ENROLL_PHOTO_COUNT && styles.photoCountTextDone,
                  isDark && styles.photoCountTextDark,
                ]}
              >
                {shots.length}/{ENROLL_PHOTO_COUNT} fotos
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.captureBtn, isDark && styles.captureBtnDark]}
            onPress={openCamera}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Abrir câmera para capturar fotos"
          >
            <Feather name="camera" size={16} color="#FFFFFF" />
            <Text style={styles.captureBtnText}>
              {shots.length === ENROLL_PHOTO_COUNT
                ? "Refazer Captura de Fotos"
                : `Capturar ${ENROLL_PHOTO_COUNT} Fotos Sequenciais`}
            </Text>
          </TouchableOpacity>

          {shots.length > 0 && (
            <View style={styles.thumbs}>
              {shots.map((uri, i) => (
                <View key={i} style={styles.thumbWrap}>
                  <Image
                    source={{ uri }}
                    style={[styles.thumb, isDark && styles.thumbDark]}
                  />
                  <View style={styles.thumbNumberBadge}>
                    <Text style={styles.thumbNumberText}>#{i + 1}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          <View style={[styles.tipCard, isDark && styles.tipCardDark]}>
            <View style={styles.tipHeader}>
              <Ionicons
                name="bulb-outline"
                size={15}
                color={isDark ? "#FBBF24" : "#D97706"}
              />
              <Text style={[styles.tipTitle, isDark && styles.tipTitleDark]}>
                Dica para quem usa óculos ou barba
              </Text>
            </View>
            <Text style={[styles.tipBody, isDark && styles.tipBodyDark]}>
              Capture algumas fotos com óculos e outras sem. O sistema extrai vetores ArcFace calibrados para reconhecê-lo em qualquer variação.
            </Text>
          </View>
        </View>

        {/* Seção 3: Consentimento LGPD */}
        <View style={[styles.card, isDark && styles.cardDark]}>
          <Text style={[styles.stepEyebrow, isDark && styles.stepEyebrowDark]}>
            ETAPA 3 · CONSENTIMENTO BIOMÉTRICO (LGPD ART. 11)
          </Text>
          <Text style={[styles.consentBody, isDark && styles.consentBodyDark]}>
            Autorizo expressamente o tratamento dos meus dados biométricos faciais exclusivamente para
            controle de frequência acadêmica no AILAB Makers. As fotos são convertidas em vetor numérico
            de 512 dimensões e descartadas imediatamente da memória.
          </Text>
          <TouchableOpacity
            onPress={() => setTermsOpen(true)}
            style={[styles.termsBtn, isDark && styles.termsBtnDark]}
            activeOpacity={0.75}
            accessibilityRole="button"
          >
            <View style={styles.termsBtnRow}>
              <Feather
                name="book-open"
                size={13}
                color={isDark ? "#FB923C" : "#EA580C"}
              />
              <Text style={[styles.termsBtnText, isDark && styles.termsBtnTextDark]}>
                Ler Termos de Privacidade e LGPD Completos
              </Text>
            </View>
          </TouchableOpacity>
          <View style={[styles.consentSwitchRow, isDark && styles.consentSwitchRowDark]}>
            <Switch
              value={consent}
              onValueChange={setConsent}
              trackColor={{ true: "#059669", false: isDark ? "#334155" : "#CBD5E1" }}
              thumbColor="#FFFFFF"
            />
            <Text style={[styles.consentSwitchLabel, isDark && styles.consentSwitchLabelDark]}>
              Li e concordo com os termos de uso de biometria facial
            </Text>
          </View>
        </View>

        {/* Botão de Envio */}
        <View style={styles.submitContainer}>
          <TouchableOpacity
            style={[styles.submitBtn, (!canSubmit || loading) && styles.disabled]}
            onPress={submit}
            disabled={!canSubmit || loading}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Feather name="check-circle" size={17} color="#FFFFFF" />
                <Text style={styles.submitBtnText}>Concluir Cadastro Biométrico</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {feedback && (
          <Text style={[styles.feedback, feedback.ok ? styles.feedbackOk : styles.feedbackErr]}>
            {feedback.text}
          </Text>
        )}

        <SequentialCamera
          visible={cameraOpen}
          onComplete={onCaptured}
          onCancel={() => setCameraOpen(false)}
        />

        <TermsModal
          visible={termsOpen}
          onClose={() => setTermsOpen(false)}
          isDark={isDark}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F8FAFC", position: "relative" },
  rootDark: { backgroundColor: "#090D16" },
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  containerDark: { backgroundColor: "#090D16" },
  content: { padding: 16, gap: 14, paddingBottom: 48 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 12,
  },
  cardDark: {
    backgroundColor: "#0F1623",
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  stepEyebrow: {
    color: "#EA580C",
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  stepEyebrowDark: {
    color: "#FB923C",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  row: { flexDirection: "row", gap: 12 },
  col: { flex: 1, gap: 6 },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: { color: "#0F172A", fontSize: 13, fontWeight: "700" },
  labelDark: { color: "#F8FAFC" },
  counterBadge: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
    fontVariant: ["tabular-nums"],
  },
  counterBadgeValid: {
    color: "#10B981",
  },
  hint: { color: "#E11D48", fontSize: 11.5, fontWeight: "600" },
  input: {
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 11,
    minHeight: 44,
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "600",
  },
  inputMono: {
    fontVariant: ["tabular-nums"],
  },
  inputDark: {
    backgroundColor: "#161F30",
    borderColor: "rgba(255, 255, 255, 0.10)",
    color: "#F8FAFC",
  },
  captureBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#EA580C",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 13,
    minHeight: 46,
  },
  captureBtnDark: {
    backgroundColor: "#EA580C",
  },
  captureBtnText: { color: "#FFFFFF", fontWeight: "800", fontSize: 13.5 },
  photoCountBadge: {
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  photoCountBadgeDark: {
    backgroundColor: "#161F30",
    borderColor: "rgba(255, 255, 255, 0.10)",
  },
  photoCountBadgeDone: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderColor: "rgba(16, 185, 129, 0.35)",
  },
  photoCountText: {
    color: "#475569",
    fontSize: 11.5,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  photoCountTextDark: {
    color: "#CBD5E1",
  },
  photoCountTextDone: {
    color: "#10B981",
  },
  disabled: { opacity: 0.45 },
  thumbs: { flexDirection: "row", gap: 10, flexWrap: "wrap", marginTop: 2 },
  thumbWrap: {
    position: "relative",
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#10B981",
  },
  thumbDark: {
    borderColor: "#34D399",
  },
  thumbNumberBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    backgroundColor: "rgba(9, 13, 22, 0.80)",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 5,
  },
  thumbNumberText: {
    color: "#FFFFFF",
    fontSize: 9.5,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  consentBody: {
    color: "#475569",
    fontSize: 12.5,
    lineHeight: 18,
  },
  consentBodyDark: {
    color: "#94A3B8",
  },
  consentSwitchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  consentSwitchRowDark: {
    borderTopColor: "rgba(255, 255, 255, 0.08)",
  },
  termsBtn: {
    alignSelf: "flex-start",
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  termsBtnDark: {
    backgroundColor: "#161F30",
    borderColor: "rgba(255, 255, 255, 0.10)",
  },
  termsBtnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  termsBtnText: {
    color: "#EA580C",
    fontSize: 12,
    fontWeight: "700",
  },
  termsBtnTextDark: {
    color: "#FB923C",
  },
  consentSwitchLabel: {
    flex: 1,
    color: "#0F172A",
    fontSize: 13,
    fontWeight: "700",
  },
  consentSwitchLabelDark: {
    color: "#F8FAFC",
  },
  submitContainer: {
    alignItems: "center",
    marginTop: 4,
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#059669",
    width: "100%",
    maxWidth: 360,
    paddingVertical: 13,
    paddingHorizontal: 24,
    borderRadius: 14,
    minHeight: 48,
    shadowColor: "#059669",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  submitBtnText: { color: "#FFFFFF", fontWeight: "800", fontSize: 15 },
  feedback: { fontSize: 13.5, fontWeight: "700", textAlign: "center", marginTop: 4 },
  feedbackOk: { color: "#10B981" },
  feedbackErr: { color: "#F43F5E" },
  tipCard: {
    backgroundColor: "rgba(245, 158, 11, 0.10)",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.25)",
    gap: 4,
  },
  tipCardDark: {
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    borderColor: "rgba(245, 158, 11, 0.28)",
  },
  tipHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  tipTitle: {
    color: "#92400E",
    fontSize: 12.5,
    fontWeight: "800",
  },
  tipTitleDark: {
    color: "#FDE68A",
  },
  tipBody: {
    color: "#78350F",
    fontSize: 12,
    lineHeight: 17,
  },
  tipBodyDark: {
    color: "#FCD34D",
  },
});
