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
    const outcome = await enroll(
      name.trim(),
      matricula.trim(),
      consent,
      shots.map((uri, i) => ({ uri, name: `frame_${i}.jpg`, type: "image/jpeg" })),
      tutorToken
    );
    if (outcome.ok) {
      const { name: enrolledName, photos_used } = outcome.data;
      setFeedback({ ok: true, text: `${enrolledName} cadastrado(a) com ${photos_used} fotos.` });
      setName("");
      setMatricula("");
      setConsent(false);
      setShots([]);
    } else {
      setFeedback({ ok: false, text: outcome.message });
    }
  }, [enroll, name, matricula, consent, shots, tutorToken]);

  return (
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
            placeholderTextColor="#6B6F82"
            value={name}
            onChangeText={setName}
          />
        </View>
        <View style={styles.col}>
          <Text style={styles.label}>Matricula</Text>
          <TextInput
            style={styles.input}
            placeholder="9 digitos"
            placeholderTextColor="#6B6F82"
            value={matricula}
            onChangeText={(t) => setMatricula(t.replace(/\D/g, "").slice(0, MATRICULA_LENGTH))}
            keyboardType="number-pad"
            maxLength={MATRICULA_LENGTH}
          />
          {matricula.length > 0 && !matriculaValid && (
            <Text style={styles.hint}>Informe {MATRICULA_LENGTH} numeros.</Text>
          )}
        </View>
      </View>

      <TouchableOpacity style={styles.captureBtn} onPress={openCamera}>
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
        <View style={styles.consentSwitchRow}>
          <Switch
            value={consent}
            onValueChange={setConsent}
            trackColor={{ true: "#166534", false: "#C9C4B6" }}
            thumbColor="#fff"
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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4EFE4" },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  row: { flexDirection: "row", gap: 12 },
  col: { flex: 1, gap: 6 },
  label: { color: "#141A33", fontSize: 13, fontWeight: "700" },
  hint: { color: "#DC2626", fontSize: 12 },
  captureBtn: {
    backgroundColor: "#1E2D5F",
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  captureBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  disabled: { opacity: 0.4 },
  thumbs: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  thumb: { width: 60, height: 60, borderRadius: 10 },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(30,45,95,.14)",
    borderRadius: 12,
    padding: 14,
    color: "#141A33",
    fontSize: 15,
  },
  consentCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(30,45,95,.14)",
    gap: 10,
  },
  consentTitle: {
    color: "#141A33",
    fontSize: 14,
    fontWeight: "700",
  },
  consentBody: {
    color: "#6B6F82",
    fontSize: 12,
    lineHeight: 18,
  },
  consentSwitchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "rgba(30,45,95,.08)",
  },
  consentSwitchLabel: {
    flex: 1,
    color: "#141A33",
    fontSize: 13,
    fontWeight: "600",
  },
  submitBtn: {
    backgroundColor: "#166534",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 4,
  },
  submitBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  feedback: { fontSize: 14, fontWeight: "600", textAlign: "center", marginTop: 4 },
  feedbackOk: { color: "#166534" },
  feedbackErr: { color: "#DC2626" },
  tipCard: {
    backgroundColor: "rgba(30,45,95,.06)",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(30,45,95,.12)",
    gap: 4,
  },
  tipTitle: {
    color: "#1E2D5F",
    fontSize: 13,
    fontWeight: "700",
  },
  tipBody: {
    color: "#6B6F82",
    fontSize: 12,
    lineHeight: 17,
  },
});
