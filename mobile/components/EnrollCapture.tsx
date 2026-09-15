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
import { useEnroll } from "@/hooks/useEnroll";
import { SequentialCamera } from "@/components/SequentialCamera";
import { FeedbackBadge, type FeedbackBadgeData } from "@/components/FeedbackBadge";
import { TermsModal } from "@/components/TermsModal";
import { ENROLL_PHOTO_COUNT, MATRICULA_LENGTH } from "@/lib/config";

interface Props {
  tutorToken?: string;
}

export function EnrollCapture({ tutorToken }: Props) {
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
      setBadgeData({
        type: "error",
        title: "Falha no Cadastro",
        message: outcome.message,
      });
      setFeedback({ ok: false, text: outcome.message });
    }
  }, [enroll, name, matricula, consent, shots, tutorToken]);

  return (
    <View style={styles.root}>
      <FeedbackBadge
        data={badgeData}
        onDismiss={() => setBadgeData(null)}
        autoCloseMs={5000}
      />
      <ScrollView
        style={styles.container}
      contentContainerStyle={[
        styles.content,
        {
          paddingBottom: insets.bottom + 40,
          paddingLeft: insets.left + 16,
          paddingRight: insets.right + 16,
        },
      ]}
    >
      <View style={styles.row}>
        <View style={styles.col}>
          <Text style={styles.label}>Nome completo</Text>
          <TextInput
            style={styles.input}
            placeholder="Nome completo"
            placeholderTextColor="#94A3B8"
            value={name}
            onChangeText={setName}
          />
        </View>
        <View style={styles.col}>
          <Text style={styles.label}>Matrícula</Text>
          <TextInput
            style={styles.input}
            placeholder="9 dígitos"
            placeholderTextColor="#94A3B8"
            value={matricula}
            onChangeText={(t) => setMatricula(t.replace(/\D/g, "").slice(0, MATRICULA_LENGTH))}
            keyboardType="number-pad"
            maxLength={MATRICULA_LENGTH}
          />
          {matricula.length > 0 && !matriculaValid && (
            <Text style={styles.hint}>Informe {MATRICULA_LENGTH} números.</Text>
          )}
        </View>
      </View>

      <TouchableOpacity
        style={styles.captureBtn}
        onPress={openCamera}
        activeOpacity={0.85}
      >
        <Text style={styles.captureBtnText}>
          {shots.length === ENROLL_PHOTO_COUNT
            ? "Refazer fotos"
            : `Tirar ${ENROLL_PHOTO_COUNT} fotos`}
        </Text>
      </TouchableOpacity>

      {shots.length > 0 && (
        <View style={styles.thumbs}>
          {shots.map((uri, i) => (
            <Image key={i} source={{ uri }} style={styles.thumb} />
          ))}
        </View>
      )}

      <View style={styles.tipCard}>
        <Text style={styles.tipTitle}>💡 Dica para quem usa óculos ou barba</Text>
        <Text style={styles.tipBody}>
          Se você costuma usar óculos ou variar a barba, capture algumas fotos com óculos e outras sem. O sistema salva representações calibradas para reconhecê-lo em qualquer situação.
        </Text>
      </View>

      <View style={styles.consentCard}>
        <Text style={styles.consentTitle}>Termo de Consentimento Biométrico (LGPD - v1.0)</Text>
        <Text style={styles.consentBody}>
          Autorizo expressamente o tratamento dos meus dados biométricos faciais exclusivamente para
          controle de frequência acadêmica e presença no AILAB Makers. As fotos capturadas são
          convertidas em vetor numérico e descartadas. O titular pode revogar este consentimento ou
          solicitar a exclusão definitiva a qualquer momento.
        </Text>
        <TouchableOpacity
          onPress={() => setTermsOpen(true)}
          style={styles.termsBtn}
          activeOpacity={0.8}
        >
          <Text style={styles.termsBtnText}>📖 Ler Termos de Privacidade e LGPD Completos</Text>
        </TouchableOpacity>
        <View style={styles.consentSwitchRow}>
          <Switch
            value={consent}
            onValueChange={setConsent}
            trackColor={{ true: "#059669", false: "#CBD5E1" }}
            thumbColor="#FFFFFF"
          />
          <Text style={styles.consentSwitchLabel}>
            Li e concordo com os termos de uso de biometria facial
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.submitBtn, (!canSubmit || loading) && styles.disabled]}
        onPress={submit}
        disabled={!canSubmit || loading}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitBtnText}>Cadastrar</Text>
        )}
      </TouchableOpacity>

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
    </ScrollView>

    <TermsModal
      visible={termsOpen}
      onClose={() => setTermsOpen(false)}
    />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F6F8FD", position: "relative" },
  container: { flex: 1, backgroundColor: "#F6F8FD" },
  content: { padding: 16, gap: 16, paddingBottom: 48 },
  row: { flexDirection: "row", gap: 12 },
  col: { flex: 1, gap: 6 },
  label: { color: "#0F172A", fontSize: 13.5, fontWeight: "700" },
  hint: { color: "#DC2626", fontSize: 12, fontWeight: "500" },
  captureBtn: {
    backgroundColor: "#2563EB",
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 16,
    alignItems: "center",
    shadowColor: "#2563EB",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  captureBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 15 },
  disabled: { opacity: 0.45 },
  thumbs: { flexDirection: "row", gap: 10, flexWrap: "wrap", marginTop: 4 },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    borderRadius: 14,
    padding: 14,
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "500",
    shadowColor: "#000",
    shadowOpacity: 0.02,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  consentCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  consentTitle: {
    color: "#0F172A",
    fontSize: 14.5,
    fontWeight: "700",
  },
  consentBody: {
    color: "#475569",
    fontSize: 12.5,
    lineHeight: 19,
  },
  consentSwitchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.06)",
  },
  termsBtn: {
    alignSelf: "flex-start",
    paddingVertical: 4,
    marginBottom: 4,
  },
  termsBtnText: {
    color: "#2563EB",
    fontSize: 13,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  consentSwitchLabel: {
    flex: 1,
    color: "#0F172A",
    fontSize: 13.5,
    fontWeight: "600",
  },
  submitBtn: {
    backgroundColor: "#059669",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 6,
    shadowColor: "#059669",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  submitBtnText: { color: "#FFFFFF", fontWeight: "800", fontSize: 16 },
  feedback: { fontSize: 14, fontWeight: "600", textAlign: "center", marginTop: 4 },
  feedbackOk: { color: "#166534" },
  feedbackErr: { color: "#DC2626" },
  tipCard: {
    backgroundColor: "#FFFBEB",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#FDE68A",
    gap: 4,
  },
  tipTitle: {
    color: "#92400E",
    fontSize: 13.5,
    fontWeight: "700",
  },
  tipBody: {
    color: "#78350F",
    fontSize: 12.5,
    lineHeight: 18,
  },
});
