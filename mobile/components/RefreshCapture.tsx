import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useCameraPermissions } from "expo-camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useProfiles, type ProfileItem } from "@/hooks/useProfiles";
import { useRefreshEmbedding } from "@/hooks/useRefreshEmbedding";
import { SequentialCamera } from "@/components/SequentialCamera";
import { ENROLL_PHOTO_COUNT } from "@/lib/config";

interface Props {
  tutorToken?: string;
  onSuccess?: () => void;
}

export function RefreshCapture({ tutorToken, onSuccess }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const { profiles, loading: loadingProfiles, error: profilesError, reload } = useProfiles();
  const { refresh, loading: refreshing } = useRefreshEmbedding();
  const insets = useSafeAreaInsets();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProfile, setSelectedProfile] = useState<ProfileItem | null>(null);
  const [shots, setShots] = useState<string[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const filteredProfiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return profiles.slice(0, 8);
    return profiles.filter((p) => {
      const nameMatch = p.name.toLowerCase().includes(q);
      const matMatch = p.matricula ? p.matricula.includes(q) : false;
      return nameMatch || matMatch;
    });
  }, [profiles, searchQuery]);

  const canSubmit =
    Boolean(selectedProfile) &&
    shots.length === ENROLL_PHOTO_COUNT &&
    !refreshing;

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

  const handleSelect = useCallback((item: ProfileItem) => {
    setSelectedProfile(item);
    setSearchQuery("");
    setFeedback(null);
  }, []);

  const handleResetSelection = useCallback(() => {
    setSelectedProfile(null);
    setShots([]);
    setFeedback(null);
  }, []);

  const submit = useCallback(async () => {
    if (!selectedProfile) return;
    setFeedback(null);

    const outcome = await refresh(
      selectedProfile.id,
      shots.map((uri, i) => ({ uri, name: `refresh_${i}.jpg`, type: "image/jpeg" })),
      tutorToken
    );

    if (outcome.ok) {
      const { name: refreshedName, photos_used } = outcome.data;
      setFeedback({
        ok: true,
        text: `Biometria de ${refreshedName} atualizada com sucesso (${photos_used} fotos processadas).`,
      });
      setSelectedProfile(null);
      setShots([]);
      if (onSuccess) onSuccess();
    } else {
      setFeedback({ ok: false, text: outcome.message });
    }
  }, [refresh, selectedProfile, shots, tutorToken, onSuccess]);

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
      keyboardShouldPersistTaps="handled"
    >
      {/* ── SEÇÃO 1: SELEÇÃO DO INTEGRANTE ── */}
      <Text style={styles.sectionHeader}>1. Selecione o integrante cadastrado</Text>

      {selectedProfile ? (
        <View style={styles.selectedCard}>
          <View style={styles.selectedInfo}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitials}>
                {selectedProfile.name
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </Text>
            </View>
            <View style={styles.selectedMeta}>
              <Text style={styles.selectedName}>{selectedProfile.name}</Text>
              <Text style={styles.selectedMatricula}>
                {selectedProfile.matricula
                  ? `Matrícula: ${selectedProfile.matricula}`
                  : "Sem matrícula registrada"}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.changeBtn}
            onPress={handleResetSelection}
            disabled={refreshing}
          >
            <Text style={styles.changeBtnText}>Trocar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.searchSection}>
          <TextInput
            style={styles.searchInput}
            placeholder="Digite o nome ou matrícula..."
            placeholderTextColor="#6B6F82"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
          />

          {loadingProfiles ? (
            <View style={styles.centerLoading}>
              <ActivityIndicator color="#1E2D5F" size="small" />
              <Text style={styles.loadingText}>Carregando integrantes...</Text>
            </View>
          ) : profilesError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorBoxText}>{profilesError}</Text>
              <TouchableOpacity onPress={reload} style={styles.retryBtn}>
                <Text style={styles.retryBtnText}>Tentar novamente</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.resultsList}>
              {filteredProfiles.length === 0 ? (
                <Text style={styles.emptyText}>Nenhum integrante encontrado.</Text>
              ) : (
                filteredProfiles.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={styles.profileRow}
                    onPress={() => handleSelect(p)}
                  >
                    <View style={styles.rowAvatar}>
                      <Text style={styles.rowAvatarText}>
                        {p.name
                          .split(" ")
                          .map((w) => w[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.rowInfo}>
                      <Text style={styles.rowName} numberOfLines={1}>
                        {p.name}
                      </Text>
                      <Text style={styles.rowMatricula}>
                        {p.matricula ? `Matrícula: ${p.matricula}` : "Sem matrícula"}
                      </Text>
                    </View>
                    <View style={styles.selectBadge}>
                      <Text style={styles.selectBadgeText}>Selecionar</Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}
        </View>
      )}

      {/* ── SEÇÃO 2: CAPTURA FACIAL ── */}
      <Text style={styles.sectionHeader}>2. Captura biométrica facial</Text>

      <TouchableOpacity
        style={[
          styles.captureBtn,
          (!selectedProfile || refreshing) && styles.disabled,
        ]}
        onPress={openCamera}
        disabled={!selectedProfile || refreshing}
      >
        <Text style={styles.captureBtnText}>
          {shots.length === ENROLL_PHOTO_COUNT
            ? "Refazer 5 fotos"
            : `Tirar ${ENROLL_PHOTO_COUNT} novas fotos`}
        </Text>
      </TouchableOpacity>

      {!selectedProfile && (
        <Text style={styles.hintNotice}>
          * Selecione um integrante acima antes de iniciar a captura facial.
        </Text>
      )}

      {shots.length > 0 && (
        <View style={styles.thumbs}>
          {shots.map((uri, i) => (
            <Image key={i} source={{ uri }} style={styles.thumb} />
          ))}
        </View>
      )}

      {/* ── SEÇÃO 3: TERMO DE RENOVAÇÃO / LGPD ── */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Atualização do Vetor Biométrico</Text>
        <Text style={styles.infoBody}>
          O recadastro recalcula as representações biométricas faciais do integrante e
          atualiza os vetores na base. Todas as sessões anteriores, horas
          acumuladas e histórico de presença continuam vinculados ao perfil sem qualquer perda.
        </Text>
      </View>

      <View style={styles.tipCard}>
        <Text style={styles.tipTitle}>💡 Dica para quem usa óculos ou barba</Text>
        <Text style={styles.tipBody}>
          Se você começou a usar óculos, mudou a armação ou alterou a barba recentemente, capture algumas fotos com óculos e outras sem para atualizar o reconhecimento em todas as suas variações.
        </Text>
      </View>

      {/* ── SEÇÃO 4: BOTÃO DE ENVIO ── */}
      <TouchableOpacity
        style={[styles.submitBtn, (!canSubmit || refreshing) && styles.disabled]}
        onPress={submit}
        disabled={!canSubmit || refreshing}
      >
        {refreshing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitBtnText}>Atualizar Biometria</Text>
        )}
      </TouchableOpacity>

      {feedback && (
        <View
          style={[
            styles.feedbackCard,
            feedback.ok ? styles.feedbackCardOk : styles.feedbackCardErr,
          ]}
        >
          <Text
            style={[
              styles.feedbackText,
              feedback.ok ? styles.feedbackTextOk : styles.feedbackTextErr,
            ]}
          >
            {feedback.text}
          </Text>
        </View>
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
  sectionHeader: {
    color: "#141A33",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 4,
  },
  searchSection: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(30,45,95,.14)",
    padding: 12,
    gap: 10,
  },
  searchInput: {
    backgroundColor: "#F9F8F5",
    borderWidth: 1,
    borderColor: "rgba(30,45,95,.12)",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: "#141A33",
    fontSize: 14,
  },
  centerLoading: {
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loadingText: { color: "#6B6F82", fontSize: 13 },
  errorBox: {
    padding: 12,
    alignItems: "center",
    gap: 8,
  },
  errorBoxText: { color: "#DC2626", fontSize: 13, textAlign: "center" },
  retryBtn: {
    backgroundColor: "rgba(30,45,95,.08)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  retryBtnText: { color: "#1E2D5F", fontWeight: "600", fontSize: 12 },
  resultsList: {
    gap: 6,
    maxHeight: 240,
  },
  emptyText: {
    color: "#6B6F82",
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 12,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#FDFCFA",
    borderWidth: 1,
    borderColor: "rgba(30,45,95,.06)",
    gap: 10,
  },
  rowAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#1E2D5F",
    alignItems: "center",
    justifyContent: "center",
  },
  rowAvatarText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  rowInfo: { flex: 1 },
  rowName: { color: "#141A33", fontWeight: "700", fontSize: 14 },
  rowMatricula: { color: "#6B6F82", fontSize: 12 },
  selectBadge: {
    backgroundColor: "rgba(30,45,95,.08)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  selectBadgeText: { color: "#1E2D5F", fontWeight: "700", fontSize: 12 },

  selectedCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: "#166534",
    gap: 12,
  },
  selectedInfo: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#166534",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: { color: "#fff", fontWeight: "800", fontSize: 16 },
  selectedMeta: { flex: 1 },
  selectedName: { color: "#141A33", fontWeight: "800", fontSize: 15 },
  selectedMatricula: { color: "#166534", fontWeight: "600", fontSize: 12, marginTop: 2 },
  changeBtn: {
    backgroundColor: "rgba(220,38,38,.10)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  changeBtnText: { color: "#DC2626", fontWeight: "700", fontSize: 13 },

  captureBtn: {
    backgroundColor: "#1E2D5F",
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  captureBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  hintNotice: { color: "#6B6F82", fontSize: 12, fontStyle: "italic" },
  disabled: { opacity: 0.45 },
  thumbs: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  thumb: { width: 60, height: 60, borderRadius: 10 },

  infoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(30,45,95,.14)",
    gap: 6,
  },
  infoTitle: { color: "#141A33", fontSize: 13, fontWeight: "700" },
  infoBody: { color: "#6B6F82", fontSize: 12, lineHeight: 18 },

  submitBtn: {
    backgroundColor: "#166534",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 4,
  },
  submitBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },

  feedbackCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  feedbackCardOk: {
    backgroundColor: "rgba(22,101,52,.08)",
    borderColor: "#166534",
  },
  feedbackCardErr: {
    backgroundColor: "rgba(220,38,38,.08)",
    borderColor: "#DC2626",
  },
  feedbackText: { fontSize: 14, fontWeight: "600", textAlign: "center" },
  feedbackTextOk: { color: "#166534" },
  feedbackTextErr: { color: "#DC2626" },
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
