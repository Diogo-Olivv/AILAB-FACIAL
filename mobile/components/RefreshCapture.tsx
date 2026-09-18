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
import { notifyInteraction } from "@/lib/sound";
import { isEnrollmentWindowActive, getEnrollmentWindowInfo } from "@/lib/enrollmentWindow";

interface Props {
  tutorToken?: string;
  onSuccess?: () => void;
}

export function RefreshCapture({ tutorToken, onSuccess }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const { profiles, loading: loadingProfiles, error: profilesError, reload } = useProfiles();
  const { refresh, loading: refreshing } = useRefreshEmbedding();
  const insets = useSafeAreaInsets();

  // Janela cadastral temporária: dispensa PIN de tutor entre 28/09 e 02/10/2026
  const windowActive = useMemo(() => isEnrollmentWindowActive(), []);
  const windowInfo = useMemo(() => getEnrollmentWindowInfo(), []);

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
      notifyInteraction("enroll");
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
      notifyInteraction("error");
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
      {/* ── BADGE DE JANELA CADASTRAL ── */}
      {windowActive && (
        <View style={styles.enrollWindowBadge}>
          <Text style={styles.enrollWindowIcon}>📅</Text>
          <View style={styles.enrollWindowTextWrap}>
            <Text style={styles.enrollWindowTitle}>Janela de Atualização Cadastral Ativa</Text>
            <Text style={styles.enrollWindowSub}>
              Até {windowInfo.windowEnd} — autenticação de tutor dispensada. Atualize sua biometria
              de forma autônoma.
            </Text>
          </View>
        </View>
      )}

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

      <View style={styles.captureRow}>
        <TouchableOpacity
          style={[
            styles.captureBtn,
            (!selectedProfile || refreshing) && styles.disabled,
          ]}
          onPress={openCamera}
          disabled={!selectedProfile || refreshing}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Abrir câmera para novas fotos"
        >
          <Text style={styles.captureBtnIcon}>📸</Text>
          <Text style={styles.captureBtnText}>
            {shots.length === ENROLL_PHOTO_COUNT
              ? "Refazer Fotos"
              : `Tirar ${ENROLL_PHOTO_COUNT} Novas Fotos`}
          </Text>
        </TouchableOpacity>

        <View style={styles.photoCountBadge}>
          <Text style={styles.photoCountText}>
            {shots.length}/{ENROLL_PHOTO_COUNT} fotos
          </Text>
        </View>
      </View>

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
          activeOpacity={0.75}
          accessibilityRole="button"
        >
          <Text style={styles.termsBtnText}>📖 Ler Termos de Privacidade e LGPD</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tipCard}>
        <Text style={styles.tipTitle}>💡 Dica para quem usa óculos ou barba</Text>
        <Text style={styles.tipBody}>
          Se você começou a usar óculos, mudou a armação ou alterou a barba recentemente, capture algumas fotos com óculos e outras sem para atualizar o reconhecimento em todas as suas variações.
        </Text>
      </View>

      {/* ── SEÇÃO 4: BOTÃO DE ENVIO ── */}
      <View style={styles.submitContainer}>
        <TouchableOpacity
          style={[styles.submitBtn, (!canSubmit || refreshing) && styles.disabled]}
          onPress={submit}
          disabled={!canSubmit || refreshing}
          activeOpacity={0.85}
          accessibilityRole="button"
        >
          {refreshing ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Text style={styles.submitBtnIcon}>✓</Text>
              <Text style={styles.submitBtnText}>Atualizar Biometria</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

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
  root: { flex: 1, backgroundColor: "#FAF9F5", position: "relative" },
  container: { flex: 1, backgroundColor: "#FAF9F5" },
  content: { padding: 16, gap: 16, paddingBottom: 48 },
  sectionHeader: {
    color: "#171715",
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
    backgroundColor: "#F5F5F4",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#171715",
    fontSize: 14,
    fontWeight: "500",
  },
  centerLoading: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loadingText: { color: "#78716C", fontSize: 13, fontWeight: "500" },
  errorBox: {
    padding: 14,
    alignItems: "center",
    gap: 8,
  },
  errorBoxText: { color: "#B91C1C", fontSize: 13, textAlign: "center" },
  retryBtn: {
    backgroundColor: "rgba(185,28,28,0.08)",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
  },
  retryBtnText: { color: "#B91C1C", fontWeight: "600", fontSize: 12.5 },
  resultsList: {
    gap: 8,
  },
  emptyText: {
    color: "#78716C",
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
  rowName: { color: "#171715", fontWeight: "700", fontSize: 14.5 },
  rowMatricula: { color: "#78716C", fontSize: 12.5, marginTop: 1 },
  selectBadge: {
    backgroundColor: "#F5F5F4",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  selectBadgeText: { color: "#171715", fontWeight: "700", fontSize: 12 },

  selectedCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    borderColor: "#059669",
    gap: 12,
    shadowColor: "#059669",
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
  selectedName: { color: "#171715", fontWeight: "800", fontSize: 15.5 },
  selectedMatricula: { color: "#065F46", fontWeight: "600", fontSize: 12.5, marginTop: 2 },
  changeBtn: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  changeBtnText: { color: "#B91C1C", fontWeight: "700", fontSize: 12.5 },

  captureRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  captureBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#171715",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
    minHeight: 44,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  captureBtnIcon: { fontSize: 16 },
  captureBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 13.5 },
  photoCountBadge: {
    backgroundColor: "#F5F5F4",
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.08)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 40,
  },
  photoCountText: {
    color: "#171715",
    fontSize: 12.5,
    fontWeight: "700",
  },
  hintNotice: { color: "#78716C", fontSize: 12.5, fontStyle: "italic", marginTop: 2 },
  disabled: { opacity: 0.45 },
  thumbs: { flexDirection: "row", gap: 10, flexWrap: "wrap", marginTop: 4 },
  thumb: {
    width: 60,
    height: 60,
    borderRadius: 12,
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
  infoTitle: { color: "#171715", fontSize: 14, fontWeight: "700" },
  infoBody: { color: "#57534E", fontSize: 12.5, lineHeight: 19 },
  termsBtn: {
    alignSelf: "flex-start",
    backgroundColor: "#F5F5F4",
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.06)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginTop: 2,
  },
  termsBtnText: {
    color: "#C15F3D",
    fontSize: 12.5,
    fontWeight: "700",
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
    backgroundColor: "#065F46",
    width: "100%",
    maxWidth: 320,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 14,
    minHeight: 46,
    shadowColor: "#065F46",
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  submitBtnIcon: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  submitBtnText: { color: "#FFFFFF", fontWeight: "800", fontSize: 15 },

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
  feedbackTextOk: { color: "#065F46" },
  feedbackTextErr: { color: "#B91C1C" },
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

  // Janela Cadastral Temporária
  enrollWindowBadge: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#FFFBEB",
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#F59E0B",
    padding: 14,
    marginBottom: 8,
  },
  enrollWindowIcon: {
    fontSize: 20,
    lineHeight: 24,
  },
  enrollWindowTextWrap: {
    flex: 1,
    gap: 2,
  },
  enrollWindowTitle: {
    color: "#92400E",
    fontSize: 13.5,
    fontWeight: "800",
    letterSpacing: -0.1,
  },
  enrollWindowSub: {
    color: "#78350F",
    fontSize: 12,
    lineHeight: 17,
  },
});
