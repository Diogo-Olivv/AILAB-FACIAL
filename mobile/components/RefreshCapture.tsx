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
import { FeedbackBadge, type FeedbackBadgeData } from "@/components/FeedbackBadge";
import { TermsModal } from "@/components/TermsModal";
import { ENROLL_PHOTO_COUNT, getAvatarColor } from "@/lib/config";
import { playAudioFeedback } from "@/lib/sound";

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
  const [termsOpen, setTermsOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [badgeData, setBadgeData] = useState<FeedbackBadgeData | null>(null);

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
    setBadgeData(null);

    const outcome = await refresh(
      selectedProfile.id,
      shots.map((uri, i) => ({ uri, name: `refresh_${i}.jpg`, type: "image/jpeg" })),
      tutorToken
    );

    if (outcome.ok) {
      playAudioFeedback("enroll");
      const { name: refreshedName, photos_used } = outcome.data;
      setBadgeData({
        type: "enroll_success",
        name: refreshedName,
        title: "Recadastro Concluído!",
        message: `Biometria atualizada com sucesso (${photos_used} fotos processadas).`,
      });
      setFeedback({
        ok: true,
        text: `Biometria de ${refreshedName} atualizada com sucesso (${photos_used} fotos processadas).`,
      });
      setSelectedProfile(null);
      setShots([]);
      if (onSuccess) onSuccess();
    } else {
      playAudioFeedback("error");
      setBadgeData({
        type: "error",
        title: "Falha na Atualização",
        message: outcome.message,
      });
      setFeedback({ ok: false, text: outcome.message });
    }
  }, [refresh, selectedProfile, shots, tutorToken, onSuccess]);

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
      keyboardShouldPersistTaps="handled"
    >
      {/* ── SEÇÃO 1: SELEÇÃO DO INTEGRANTE ── */}
      <Text style={styles.sectionHeader}>1. Selecione o integrante cadastrado</Text>

      {selectedProfile ? (
        <View style={styles.selectedCard}>
          <View style={styles.selectedInfo}>
            <View
              style={[
                styles.avatarCircle,
                { backgroundColor: getAvatarColor(selectedProfile.name).bg },
              ]}
            >
              <Text
                style={[
                  styles.avatarInitials,
                  { color: getAvatarColor(selectedProfile.name).text },
                ]}
              >
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
            activeOpacity={0.8}
          >
            <Text style={styles.changeBtnText}>Trocar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.searchSection}>
          <TextInput
            style={styles.searchInput}
            placeholder="Digite o nome ou matrícula..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
          />

          {loadingProfiles ? (
            <View style={styles.centerLoading}>
              <ActivityIndicator color="#2563EB" size="small" />
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
                filteredProfiles.map((p) => {
                  const avatar = getAvatarColor(p.name);
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={styles.profileRow}
                      onPress={() => handleSelect(p)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.rowAvatar, { backgroundColor: avatar.bg }]}>
                        <Text style={[styles.rowAvatarText, { color: avatar.text }]}>
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
                  );
                })
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
        <TouchableOpacity
          onPress={() => setTermsOpen(true)}
          style={styles.termsBtn}
          activeOpacity={0.8}
        >
          <Text style={styles.termsBtnText}>📖 Ler Termos de Privacidade e LGPD Completos</Text>
        </TouchableOpacity>
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

      <TermsModal
        visible={termsOpen}
        onClose={() => setTermsOpen(false)}
      />
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F6F8FD", position: "relative" },
  container: { flex: 1, backgroundColor: "#F6F8FD" },
  content: { padding: 16, gap: 16, paddingBottom: 48 },
  sectionHeader: {
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
    marginTop: 6,
  },
  searchSection: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    padding: 14,
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  searchInput: {
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "500",
  },
  centerLoading: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loadingText: { color: "#64748B", fontSize: 13, fontWeight: "500" },
  errorBox: {
    padding: 14,
    alignItems: "center",
    gap: 8,
  },
  errorBoxText: { color: "#DC2626", fontSize: 13, textAlign: "center" },
  retryBtn: {
    backgroundColor: "rgba(220,38,38,0.08)",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
  },
  retryBtnText: { color: "#DC2626", fontWeight: "600", fontSize: 12.5 },
  resultsList: {
    gap: 8,
  },
  emptyText: {
    color: "#64748B",
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 14,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  rowAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  rowAvatarText: { fontWeight: "700", fontSize: 13.5 },
  rowInfo: { flex: 1 },
  rowName: { color: "#0F172A", fontWeight: "700", fontSize: 14.5 },
  rowMatricula: { color: "#64748B", fontSize: 12.5, marginTop: 1 },
  selectBadge: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "rgba(37,99,235,0.15)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  selectBadgeText: { color: "#2563EB", fontWeight: "700", fontSize: 12 },

  selectedCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    borderColor: "#10B981",
    gap: 12,
    shadowColor: "#10B981",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  selectedInfo: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: { fontWeight: "800", fontSize: 16 },
  selectedMeta: { flex: 1 },
  selectedName: { color: "#0F172A", fontWeight: "800", fontSize: 15.5 },
  selectedMatricula: { color: "#059669", fontWeight: "600", fontSize: 12.5, marginTop: 2 },
  changeBtn: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  changeBtnText: { color: "#DC2626", fontWeight: "700", fontSize: 13 },

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
  hintNotice: { color: "#64748B", fontSize: 12.5, fontStyle: "italic", marginTop: 2 },
  disabled: { opacity: 0.45 },
  thumbs: { flexDirection: "row", gap: 10, flexWrap: "wrap", marginTop: 4 },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },

  infoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    gap: 8,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  infoTitle: { color: "#0F172A", fontSize: 14, fontWeight: "700" },
  infoBody: { color: "#475569", fontSize: 12.5, lineHeight: 19 },
  termsBtn: {
    alignSelf: "flex-start",
    paddingVertical: 4,
    marginTop: 2,
  },
  termsBtnText: {
    color: "#2563EB",
    fontSize: 13,
    fontWeight: "700",
    textDecorationLine: "underline",
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

  feedbackCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
  },
  feedbackCardOk: {
    backgroundColor: "#F0FDF4",
    borderColor: "#86EFAC",
  },
  feedbackCardErr: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  feedbackText: { fontSize: 14, fontWeight: "600", textAlign: "center" },
  feedbackTextOk: { color: "#166534" },
  feedbackTextErr: { color: "#DC2626" },
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
