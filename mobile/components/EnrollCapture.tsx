import React, { useCallback, useRef, useState } from "react";
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
import { CameraView, useCameraPermissions } from "expo-camera";
import { useEnroll } from "@/hooks/useEnroll";
import { ENROLL_PHOTO_COUNT } from "@/lib/config";

interface Shot {
  uri: string;
  blob: Blob;
}

export function EnrollCapture() {
  const [permission, requestPermission] = useCameraPermissions();
  const { enroll, loading } = useEnroll();
  const cameraRef = useRef<CameraView>(null);

  const [name, setName] = useState("");
  const [matricula, setMatricula] = useState("");
  const [consent, setConsent] = useState(false);
  const [shots, setShots] = useState<Shot[]>([]);
  const [capturing, setCapturing] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const remaining = ENROLL_PHOTO_COUNT - shots.length;
  const canSubmit = name.trim().length > 0 && consent && shots.length === ENROLL_PHOTO_COUNT;

  const shoot = useCallback(async () => {
    if (!cameraRef.current || capturing || remaining <= 0) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        skipProcessing: true,
      });
      if (!photo?.uri) return;
      const blob = await (await fetch(photo.uri)).blob();
      setShots((prev) => [...prev, { uri: photo.uri, blob }]);
    } finally {
      setCapturing(false);
    }
  }, [capturing, remaining]);

  const submit = useCallback(async () => {
    setFeedback(null);
    const res = await enroll(
      name.trim(),
      matricula.trim(),
      consent,
      shots.map((s) => s.blob)
    );
    if (res) {
      setFeedback({ ok: true, text: `${res.name} cadastrado(a) com ${res.photos_used} fotos.` });
      setName("");
      setMatricula("");
      setConsent(false);
      setShots([]);
    } else {
      setFeedback({ ok: false, text: "Falha no cadastro. Verifique os dados e tente de novo." });
    }
  }, [enroll, name, matricula, consent, shots]);

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <View style={styles.permContainer}>
        <Text style={styles.permText}>Camera necessaria para o cadastro.</Text>
        <TouchableOpacity style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>Permitir acesso</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.cameraWrapper}>
        <CameraView ref={cameraRef} style={styles.camera} facing="front" />
      </View>

      <TouchableOpacity
        style={[styles.captureBtn, (capturing || remaining <= 0) && styles.disabled]}
        onPress={shoot}
        disabled={capturing || remaining <= 0}
      >
        {capturing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.captureBtnText}>
            {remaining > 0 ? `Capturar foto (${shots.length}/${ENROLL_PHOTO_COUNT})` : "Fotos completas"}
          </Text>
        )}
      </TouchableOpacity>

      {shots.length > 0 && (
        <View style={styles.thumbs}>
          {shots.map((s, i) => (
            <View key={i} style={styles.thumbWrapper}>
              <Image source={{ uri: s.uri }} style={styles.thumb} />
              <TouchableOpacity
                style={styles.removeThumb}
                onPress={() => setShots((prev) => prev.filter((_, j) => j !== i))}
              >
                <Text style={styles.removeThumbText}>x</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <TextInput
        style={styles.input}
        placeholder="Nome completo"
        placeholderTextColor="#6B7280"
        value={name}
        onChangeText={setName}
      />
      <TextInput
        style={styles.input}
        placeholder="Matricula (opcional)"
        placeholderTextColor="#6B7280"
        value={matricula}
        onChangeText={setMatricula}
        autoCapitalize="characters"
      />

      <View style={styles.consentRow}>
        <Switch
          value={consent}
          onValueChange={setConsent}
          trackColor={{ true: "#6C47FF", false: "#2A2A4A" }}
          thumbColor="#fff"
        />
        <Text style={styles.consentText}>
          Autorizo o uso da minha imagem para reconhecimento facial (LGPD).
        </Text>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F0F1A" },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  cameraWrapper: { height: 300, borderRadius: 16, overflow: "hidden" },
  camera: { flex: 1 },
  captureBtn: {
    backgroundColor: "#6C47FF",
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  captureBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  disabled: { opacity: 0.4 },
  thumbs: { flexDirection: "row", gap: 10 },
  thumbWrapper: { position: "relative" },
  thumb: { width: 60, height: 60, borderRadius: 10 },
  removeThumb: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
  },
  removeThumbText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  input: {
    backgroundColor: "#1A1A2E",
    borderWidth: 1,
    borderColor: "#2A2A4A",
    borderRadius: 12,
    padding: 14,
    color: "#fff",
    fontSize: 15,
  },
  consentRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  consentText: { flex: 1, color: "#9CA3AF", fontSize: 13 },
  submitBtn: {
    backgroundColor: "#22C55E",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 4,
  },
  submitBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  permContainer: {
    flex: 1,
    backgroundColor: "#0F0F1A",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  permText: { color: "#fff", fontSize: 16, textAlign: "center", paddingHorizontal: 32 },
  btn: { backgroundColor: "#6C47FF", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  btnText: { color: "#fff", fontWeight: "700" },
  feedback: { fontSize: 14, fontWeight: "600", textAlign: "center", marginTop: 4 },
  feedbackOk: { color: "#22C55E" },
  feedbackErr: { color: "#F87171" },
});
