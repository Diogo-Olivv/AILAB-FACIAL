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
import { Feather, Ionicons } from "@expo/vector-icons";
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
  isDark?: boolean;
}

export function RefreshCapture({ tutorToken, onSuccess, isDark = false }: Props) {
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
    setBadgeData(null);
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
        message: `Biometria facial de ${refreshedName} atualizada com ${photos_used} fotos processadas.`,
      });
      setFeedback({
        ok: true,
        text: `Biometria de ${refreshedName} atualizada com sucesso (${photos_used} fotos).`,
      });
      setShots([]);
      onSuccess?.();
    } else {
      notifyInteraction("error");
      setBadgeData({
        type: "error",
        title: "Falha no Recadastro",
        message: outcome.message,
      });
      setFeedback({ ok: false, text: outcome.message });
    }
  }, [refresh, selectedProfile, shots, tutorToken, onSuccess]);

  return (
    <View style={[styles.root, isDark && styles.rootDark]}>
      <FeedbackBadge
        data={badgeData}
        onDismiss={() => setBadgeData(null)}
        autoCloseMs={5000}
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
        {/* ── BADGE DE JANELA CADASTRAL ── */}
        {windowActive && (
          <View style={[styles.enrollWindowBadge, isDark && styles.enrollWindowBadgeDark]}>
            <Feather name="calendar" size={16} color={isDark ? "#FDE68A" : "#92400E"} />
            <View style={styles.enrollWindowTextWrap}>
              <Text style={[styles.enrollWindowTitle, isDark && styles.enrollWindowTitleDark]}>
                Janela de Atualização Cadastral Ativa
              </Text>
              <Text style={[styles.enrollWindowSub, isDark && styles.enrollWindowSubDark]}>
                Até {windowInfo.windowEnd} — autenticação de tutor dispensada. Atualize sua biometria
                de forma autônoma.
              </Text>
            </View>
          </View>
        )}

        {/* ── SEÇÃO 1: SELEÇÃO DO INTEGRANTE ── */}
        <Text style={[styles.sectionHeader, isDark && styles.sectionHeaderDark]}>
          1. Selecione o integrante cadastrado
        </Text>

        {selectedProfile ? (
          <View style={[styles.selectedCard, isDark && styles.selectedCardDark]}>
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
                <Text style={[styles.selectedName, isDark && styles.selectedNameDark]}>
                  {selectedProfile.name}
                </Text>
                <Text style={[styles.selectedMatricula, isDark && styles.selectedMatriculaDark]}>
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
          <View style={[styles.searchSection, isDark && styles.searchSectionDark]}>
            <TextInput
              style={[styles.searchInput, isDark && styles.searchInputDark]}
              placeholder="Digite o nome ou matrícula..."
              placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
            />

            {loadingProfiles ? (
              <View style={styles.centerLoading}>
                <ActivityIndicator color="#2563EB" size="small" />
                <Text style={[styles.loadingText, isDark && styles.loadingTextDark]}>
                  Carregando integrantes...
                </Text>
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
                  <Text style={[styles.emptyText, isDark && styles.emptyTextDark]}>
                    Nenhum integrante encontrado.
                  </Text>
                ) : (
                  filteredProfiles.map((p) => {
                    const avatar = getAvatarColor(p.name);
                    return (
                      <TouchableOpacity
                        key={p.id}
                        style={[styles.profileRow, isDark && styles.profileRowDark]}
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
                          <Text style={[styles.rowName, isDark && styles.rowNameDark]} numberOfLines={1}>
                            {p.name}
                          </Text>
                          <Text style={[styles.rowMatricula, isDark && styles.rowMatriculaDark]}>
                            {p.matricula ? `Matrícula: ${p.matricula}` : "Sem matrícula"}
                          </Text>
                        </View>
                        <View style={[styles.selectBadge, isDark && styles.selectBadgeDark]}>
                          <Text style={[styles.selectBadgeText, isDark && styles.selectBadgeTextDark]}>
                            Selecionar
                          </Text>
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
        <Text style={[styles.sectionHeader, isDark && styles.sectionHeaderDark]}>
          2. Captura biométrica facial
        </Text>

        <View style={styles.captureRow}>
          <TouchableOpacity
            style={[
              styles.captureBtn,
              isDark && styles.captureBtnDark,
              (!selectedProfile || refreshing) && styles.disabled,
            ]}
            onPress={openCamera}
            disabled={!selectedProfile || refreshing}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Abrir câmera para novas fotos"
          >
            <Feather name="camera" size={16} color="#FFFFFF" />
            <Text style={styles.captureBtnText}>
              {shots.length === ENROLL_PHOTO_COUNT
                ? "Refazer Fotos"
                : `Tirar ${ENROLL_PHOTO_COUNT} Novas Fotos`}
            </Text>
          </TouchableOpacity>

          <View style={[styles.photoCountBadge, isDark && styles.photoCountBadgeDark]}>
            <Text style={[styles.photoCountText, isDark && styles.photoCountTextDark]}>
              {shots.length}/{ENROLL_PHOTO_COUNT} fotos
            </Text>
          </View>
        </View>

        {!selectedProfile && (
          <Text style={[styles.hintNotice, isDark && styles.hintNoticeDark]}>
            * Selecione um integrante acima antes de iniciar a captura facial.
          </Text>
        )}

        {shots.length > 0 && (
          <View style={styles.thumbs}>
            {shots.map((uri, i) => (
              <Image key={i} source={{ uri }} style={[styles.thumb, isDark && styles.thumbDark]} />
            ))}
          </View>
        )}

        {/* ── SEÇÃO 3: TERMO DE RENOVAÇÃO / LGPD ── */}
        <View style={[styles.infoCard, isDark && styles.infoCardDark]}>
          <Text style={[styles.infoTitle, isDark && styles.infoTitleDark]}>
            Atualização do Vetor Biométrico
          </Text>
          <Text style={[styles.infoBody, isDark && styles.infoBodyDark]}>
            O recadastro recalcula as representações biométricas faciais do integrante e
            atualiza os vetores na base. Todas as sessões anteriores, horas
            acumuladas e histórico de presença continuam vinculados ao perfil sem qualquer perda.
          </Text>
          <TouchableOpacity
            onPress={() => setTermsOpen(true)}
            style={[styles.termsBtn, isDark && styles.termsBtnDark]}
            activeOpacity={0.75}
            accessibilityRole="button"
          >
            <View style={styles.termsBtnRow}>
              <Feather name="book-open" size={13} color={isDark ? "#FB923C" : "#C15F3D"} />
              <Text style={[styles.termsBtnText, isDark && styles.termsBtnTextDark]}>
                Ler Termos de Privacidade e LGPD
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={[styles.tipCard, isDark && styles.tipCardDark]}>
          <View style={styles.tipHeader}>
            <Ionicons name="bulb-outline" size={16} color={isDark ? "#FDE68A" : "#92400E"} />
            <Text style={[styles.tipTitle, isDark && styles.tipTitleDark]}>
              Dica para quem usa óculos ou barba
            </Text>
          </View>
          <Text style={[styles.tipBody, isDark && styles.tipBodyDark]}>
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
                <Feather name="check" size={17} color="#FFFFFF" />
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
          isDark={isDark}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FAF9F5", position: "relative" },
  rootDark: { backgroundColor: "#0B0F19" },
  container: { flex: 1, backgroundColor: "#FAF9F5" },
  containerDark: { backgroundColor: "#0B0F19" },
  content: { padding: 16, gap: 16, paddingBottom: 48 },
  sectionHeader: {
    color: "#171715",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
    marginTop: 6,
  },
  sectionHeaderDark: {
    color: "#F8FAFC",
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
  searchSectionDark: {
    backgroundColor: "#0F172A",
    borderColor: "#1E293B",
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
  searchInputDark: {
    backgroundColor: "#1E293B",
    borderColor: "#334155",
    color: "#F8FAFC",
  },
  centerLoading: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loadingText: { color: "#78716C", fontSize: 13, fontWeight: "500" },
  loadingTextDark: { color: "#94A3B8" },
  errorBox: {
    padding: 14,
    alignItems: "center",
    gap: 8,
  },
  errorBoxText: { color: "#EF4444", fontSize: 13, textAlign: "center" },
  retryBtn: {
    backgroundColor: "rgba(185,28,28,0.08)",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
  },
  retryBtnText: { color: "#EF4444", fontWeight: "600", fontSize: 12.5 },
  resultsList: {
    gap: 8,
  },
  emptyText: {
    color: "#78716C",
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 14,
  },
  emptyTextDark: {
    color: "#94A3B8",
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
  profileRowDark: {
    backgroundColor: "#1E293B",
    borderColor: "#334155",
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
  rowNameDark: { color: "#F8FAFC" },
  rowMatricula: { color: "#78716C", fontSize: 12.5, marginTop: 1 },
  rowMatriculaDark: { color: "#94A3B8" },
  selectBadge: {
    backgroundColor: "#F5F5F4",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  selectBadgeDark: {
    backgroundColor: "#0F172A",
    borderColor: "#334155",
  },
  selectBadgeText: { color: "#171715", fontWeight: "700", fontSize: 12 },
  selectBadgeTextDark: { color: "#F8FAFC" },

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
  selectedCardDark: {
    backgroundColor: "#0F172A",
    borderColor: "#059669",
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
  selectedNameDark: { color: "#F8FAFC" },
  selectedMatricula: { color: "#065F46", fontWeight: "600", fontSize: 12.5, marginTop: 2 },
  selectedMatriculaDark: { color: "#34D399" },
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
  captureBtnDark: {
    backgroundColor: "#1E293B",
    borderWidth: 1,
    borderColor: "#334155",
  },
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
  photoCountBadgeDark: {
    backgroundColor: "#1E293B",
    borderColor: "#334155",
  },
  photoCountText: {
    color: "#171715",
    fontSize: 12.5,
    fontWeight: "700",
  },
  photoCountTextDark: {
    color: "#F8FAFC",
  },
  hintNotice: { color: "#78716C", fontSize: 12.5, fontStyle: "italic", marginTop: 2 },
  hintNoticeDark: { color: "#94A3B8" },
  disabled: { opacity: 0.45 },
  thumbs: { flexDirection: "row", gap: 10, flexWrap: "wrap", marginTop: 4 },
  thumb: {
    width: 60,
    height: 60,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },
  thumbDark: {
    borderColor: "#334155",
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
  infoCardDark: {
    backgroundColor: "#0F172A",
    borderColor: "#1E293B",
  },
  infoTitle: { color: "#171715", fontSize: 14, fontWeight: "700" },
  infoTitleDark: { color: "#F8FAFC" },
  infoBody: { color: "#57534E", fontSize: 12.5, lineHeight: 19 },
  infoBodyDark: { color: "#94A3B8" },
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
  termsBtnDark: {
    backgroundColor: "#1E293B",
    borderColor: "#334155",
  },
  termsBtnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  termsBtnText: {
    color: "#C15F3D",
    fontSize: 12.5,
    fontWeight: "700",
  },
  termsBtnTextDark: {
    color: "#FB923C",
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
  feedbackTextErr: { color: "#EF4444" },
  tipCard: {
    backgroundColor: "#FFFBEB",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#FDE68A",
    gap: 4,
  },
  tipCardDark: {
    backgroundColor: "#1E293B",
    borderColor: "#451A03",
  },
  tipHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  tipTitle: {
    color: "#92400E",
    fontSize: 13.5,
    fontWeight: "700",
  },
  tipTitleDark: {
    color: "#FDE68A",
  },
  tipBody: {
    color: "#78350F",
    fontSize: 12.5,
    lineHeight: 18,
  },
  tipBodyDark: {
    color: "#FCD34D",
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
  enrollWindowBadgeDark: {
    backgroundColor: "#1E293B",
    borderColor: "#F59E0B",
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
  enrollWindowTitleDark: {
    color: "#FDE68A",
  },
  enrollWindowSub: {
    color: "#78350F",
    fontSize: 12,
    lineHeight: 17,
  },
  enrollWindowSubDark: {
    color: "#FCD34D",
  },
});
