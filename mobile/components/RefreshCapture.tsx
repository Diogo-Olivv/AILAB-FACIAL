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
import { KioskAvatar } from "@/components/KioskAvatar";
import { ENROLL_PHOTO_COUNT } from "@/lib/config";
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
        {windowActive && (
          <View style={[styles.enrollWindowBadge, isDark && styles.enrollWindowBadgeDark]}>
            <Feather name="calendar" size={16} color={isDark ? "#FBBF24" : "#D97706"} />
            <View style={styles.enrollWindowTextWrap}>
              <Text style={[styles.enrollWindowTitle, isDark && styles.enrollWindowTitleDark]}>
                Janela de Atualização Cadastral Ativa
              </Text>
              <Text style={[styles.enrollWindowSub, isDark && styles.enrollWindowSubDark]}>
                Até {windowInfo.windowEnd} — autenticação de tutor dispensada.
              </Text>
            </View>
          </View>
        )}

        {/* Seção 1: Seleção do Integrante */}
        <View style={[styles.card, isDark && styles.cardDark]}>
          <Text style={[styles.stepEyebrow, isDark && styles.stepEyebrowDark]}>
            ETAPA 1 · SELECIONE O INTEGRANTE CADASTRADO
          </Text>

          {selectedProfile ? (
            <View style={[styles.selectedCard, isDark && styles.selectedCardDark]}>
              <View style={styles.selectedInfo}>
                <KioskAvatar
                  name={selectedProfile.name}
                  uri={selectedProfile.avatar_url}
                  size={44}
                  isTutor={Boolean(selectedProfile.is_tutor)}
                  isDark={isDark}
                />
                <View style={styles.selectedMeta}>
                  <View style={styles.selectedNameRow}>
                    <Text style={[styles.selectedName, isDark && styles.selectedNameDark]} numberOfLines={1}>
                      {selectedProfile.name}
                    </Text>
                    {selectedProfile.is_tutor && (
                      <View style={styles.tutorPill}>
                        <Text style={styles.tutorPillText}>TUTOR</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.selectedMatricula, isDark && styles.selectedMatriculaDark]}>
                    {selectedProfile.matricula
                      ? `Matrícula: #${selectedProfile.matricula}`
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
            <View style={styles.searchBlock}>
              <View style={[styles.searchInputWrap, isDark && styles.searchInputWrapDark]}>
                <Feather
                  name="search"
                  size={15}
                  color={isDark ? "#64748B" : "#94A3B8"}
                />
                <TextInput
                  style={[styles.searchInput, isDark && styles.searchInputDark]}
                  placeholder="Buscar por nome ou matrícula..."
                  placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCorrect={false}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery("")}>
                    <Feather name="x" size={15} color={isDark ? "#94A3B8" : "#64748B"} />
                  </TouchableOpacity>
                )}
              </View>

              {loadingProfiles ? (
                <View style={styles.centerLoading}>
                  <ActivityIndicator color="#EA580C" size="small" />
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
                    filteredProfiles.map((p) => (
                      <TouchableOpacity
                        key={p.id}
                        style={[styles.profileRow, isDark && styles.profileRowDark]}
                        onPress={() => handleSelect(p)}
                        activeOpacity={0.7}
                      >
                        <KioskAvatar
                          name={p.name}
                          uri={p.avatar_url}
                          size={38}
                          isTutor={Boolean(p.is_tutor)}
                          isDark={isDark}
                        />
                        <View style={styles.rowInfo}>
                          <View style={styles.selectedNameRow}>
                            <Text style={[styles.rowName, isDark && styles.rowNameDark]} numberOfLines={1}>
                              {p.name}
                            </Text>
                            {p.is_tutor && (
                              <View style={styles.tutorPill}>
                                <Text style={styles.tutorPillText}>TUTOR</Text>
                              </View>
                            )}
                          </View>
                          <Text style={[styles.rowMatricula, isDark && styles.rowMatriculaDark]}>
                            {p.matricula ? `#${p.matricula}` : "Sem matrícula"}
                          </Text>
                        </View>
                        <View style={[styles.selectBadge, isDark && styles.selectBadgeDark]}>
                          <Text style={[styles.selectBadgeText, isDark && styles.selectBadgeTextDark]}>
                            Selecionar
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              )}
            </View>
          )}
        </View>

        {/* Seção 2: Captura Biométrica */}
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
            <Feather name="camera" size={16} color="#FFFFFF" />
            <Text style={styles.captureBtnText}>
              {shots.length === ENROLL_PHOTO_COUNT
                ? "Refazer Captura de Fotos"
                : `Capturar ${ENROLL_PHOTO_COUNT} Novas Fotos`}
            </Text>
          </TouchableOpacity>

          {!selectedProfile && (
            <Text style={[styles.hintNotice, isDark && styles.hintNoticeDark]}>
              Selecione um integrante na Etapa 1 antes de iniciar a câmera.
            </Text>
          )}

          {shots.length > 0 && (
            <View style={styles.thumbs}>
              {shots.map((uri, i) => (
                <View key={i} style={styles.thumbWrap}>
                  <Image source={{ uri }} style={[styles.thumb, isDark && styles.thumbDark]} />
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
                Preservação Integral do Histórico
              </Text>
            </View>
            <Text style={[styles.tipBody, isDark && styles.tipBodyDark]}>
              O recadastro apenas recalibra seu vetor facial de 512 dimensões. Todas as suas horas e sessões anteriores permanecem intactas.
            </Text>
          </View>

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
                Ler Termos de Privacidade e LGPD
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Botão de Envio */}
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
                <Feather name="check-circle" size={17} color="#FFFFFF" />
                <Text style={styles.submitBtnText}>Atualizar Biometria Facial</Text>
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
  searchBlock: {
    gap: 10,
  },
  searchInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  searchInputWrapDark: {
    backgroundColor: "#161F30",
    borderColor: "rgba(255, 255, 255, 0.10)",
  },
  searchInput: {
    flex: 1,
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "600",
    paddingVertical: 8,
  },
  searchInputDark: {
    color: "#F8FAFC",
  },
  centerLoading: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loadingText: { color: "#64748B", fontSize: 13, fontWeight: "600" },
  loadingTextDark: { color: "#94A3B8" },
  errorBox: {
    padding: 14,
    alignItems: "center",
    gap: 8,
  },
  errorBoxText: { color: "#E11D48", fontSize: 13, textAlign: "center" },
  retryBtn: {
    backgroundColor: "rgba(244, 63, 94, 0.12)",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
  },
  retryBtnText: { color: "#E11D48", fontWeight: "700", fontSize: 12.5 },
  resultsList: {
    gap: 8,
  },
  emptyText: {
    color: "#64748B",
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
    padding: 10,
    borderRadius: 13,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 11,
  },
  profileRowDark: {
    backgroundColor: "#161F30",
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  rowInfo: { flex: 1, gap: 1 },
  rowName: { color: "#0F172A", fontWeight: "700", fontSize: 14, flexShrink: 1 },
  rowNameDark: { color: "#F8FAFC" },
  rowMatricula: {
    color: "#64748B",
    fontSize: 12,
    fontVariant: ["tabular-nums"],
  },
  rowMatriculaDark: { color: "#94A3B8" },
  selectBadge: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 9,
  },
  selectBadgeDark: {
    backgroundColor: "#0F1623",
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  selectBadgeText: { color: "#0F172A", fontWeight: "700", fontSize: 12 },
  selectBadgeTextDark: { color: "#F8FAFC" },
  selectedCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(16, 185, 129, 0.08)",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: "#10B981",
    gap: 12,
  },
  selectedCardDark: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderColor: "#10B981",
  },
  selectedInfo: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  selectedMeta: { flex: 1, gap: 2 },
  selectedNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  selectedName: {
    color: "#0F172A",
    fontWeight: "800",
    fontSize: 15,
    flexShrink: 1,
  },
  selectedNameDark: { color: "#F8FAFC" },
  selectedMatricula: {
    color: "#059669",
    fontWeight: "700",
    fontSize: 12,
    fontVariant: ["tabular-nums"],
  },
  selectedMatriculaDark: { color: "#34D399" },
  tutorPill: {
    backgroundColor: "rgba(234, 88, 12, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(234, 88, 12, 0.35)",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 5,
  },
  tutorPillText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#EA580C",
  },
  changeBtn: {
    backgroundColor: "rgba(244, 63, 94, 0.14)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  changeBtnText: { color: "#E11D48", fontWeight: "800", fontSize: 12 },
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
  hintNotice: { color: "#64748B", fontSize: 12, fontStyle: "italic" },
  hintNoticeDark: { color: "#94A3B8" },
  disabled: { opacity: 0.45 },
  thumbs: { flexDirection: "row", gap: 10, flexWrap: "wrap", marginTop: 2 },
  thumbWrap: { position: "relative" },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#10B981",
  },
  thumbDark: { borderColor: "#34D399" },
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
  feedbackCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
  },
  feedbackCardOk: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderColor: "rgba(16, 185, 129, 0.35)",
  },
  feedbackCardErr: {
    backgroundColor: "rgba(244, 63, 94, 0.12)",
    borderColor: "rgba(244, 63, 94, 0.35)",
  },
  feedbackText: { fontSize: 13.5, fontWeight: "700", textAlign: "center" },
  feedbackTextOk: { color: "#10B981" },
  feedbackTextErr: { color: "#F43F5E" },
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
  enrollWindowBadge: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#F59E0B",
    padding: 13,
  },
  enrollWindowBadgeDark: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderColor: "#FBBF24",
  },
  enrollWindowTextWrap: {
    flex: 1,
    gap: 2,
  },
  enrollWindowTitle: {
    color: "#92400E",
    fontSize: 13,
    fontWeight: "800",
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
