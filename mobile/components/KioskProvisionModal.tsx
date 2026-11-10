import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { activateKiosk } from "@/lib/kioskIdentity";
import { extractErrorMessage } from "@/lib/errors";
import { getPalette } from "@/lib/theme";

interface Props {
  visible: boolean;
  /** Sessão temporária do tutor que está ativando o dispositivo. */
  tutorToken: string | null;
  isDark?: boolean;
  onDone: () => void;
  onCancel: () => void;
}

const MAX_LABEL = 60;

/**
 * Ativação do totem por um tutor: dá um nome ao dispositivo e cria a sua
 * identidade própria. A credencial nunca é exibida nem guardada em texto.
 */
export function KioskProvisionModal({ visible, tutorToken, isDark = false, onDone, onCancel }: Props) {
  const palette = getPalette(isDark);
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const cleanLabel = label.trim();
  const canSubmit = cleanLabel.length > 0 && !loading && Boolean(tutorToken);

  async function handleActivate() {
    if (!canSubmit || !tutorToken) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      await activateKiosk(cleanLabel, tutorToken);
      setLabel("");
      onDone();
    } catch (err) {
      setErrorMsg(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View
          style={[styles.card, { backgroundColor: palette.surface1, borderColor: palette.borderSubtle }]}
          accessibilityViewIsModal
        >
          <View style={styles.headerRow}>
            <View style={[styles.iconBadge, { backgroundColor: palette.accentSoft, borderColor: palette.accentBorder }]}>
              <Feather name="tablet" size={18} color={palette.accent} />
            </View>
            <View style={styles.headerText}>
              <Text style={[styles.eyebrow, { color: palette.textMuted }]}>ATIVAÇÃO DO DISPOSITIVO</Text>
              <Text style={[styles.title, { color: palette.textPrimary }]}>Ativar este totem</Text>
            </View>
          </View>

          <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
            Dê um nome para identificar este dispositivo. Ele receberá uma identidade própria,
            que pode ser revogada a qualquer momento por um tutor.
          </Text>

          <Text style={[styles.label, { color: palette.textSecondary }]} nativeID="kiosk-label">
            Nome do dispositivo
          </Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: palette.surface2, borderColor: palette.borderStrong, color: palette.textPrimary },
            ]}
            placeholder="Ex.: Totem da entrada"
            placeholderTextColor={palette.textMuted}
            value={label}
            onChangeText={(text) => {
              setLabel(text.slice(0, MAX_LABEL));
              if (errorMsg) setErrorMsg(null);
            }}
            maxLength={MAX_LABEL}
            autoCapitalize="sentences"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={handleActivate}
            accessibilityLabelledBy="kiosk-label"
            accessibilityLabel="Nome do dispositivo"
          />
          <Text style={[styles.counter, { color: palette.textMuted }]}>
            {cleanLabel.length}/{MAX_LABEL}
          </Text>

          {errorMsg && (
            <View
              style={[styles.errorBox, { backgroundColor: palette.roseSoft, borderColor: palette.roseBorder }]}
              accessibilityLiveRegion="assertive"
              accessibilityRole="alert"
            >
              <Feather name="alert-circle" size={14} color={palette.rose} />
              <Text style={[styles.errorText, { color: palette.rose }]}>{errorMsg}</Text>
            </View>
          )}

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.cancelBtn, { borderColor: palette.borderStrong }]}
              onPress={onCancel}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Cancelar ativação"
            >
              <Text style={[styles.cancelText, { color: palette.textSecondary }]}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: palette.accent }, !canSubmit && styles.disabled]}
              onPress={handleActivate}
              disabled={!canSubmit}
              accessibilityRole="button"
              accessibilityLabel="Ativar totem"
              accessibilityState={{ disabled: !canSubmit, busy: loading }}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Feather name="check" size={15} color="#FFFFFF" />
                  <Text style={styles.confirmText}>Ativar</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(9, 13, 22, 0.72)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  card: { width: "100%", maxWidth: 440, borderRadius: 20, borderWidth: 1, padding: 22 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  headerText: { flex: 1 },
  eyebrow: { fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  title: { fontSize: 19, fontWeight: "800", marginTop: 2 },
  subtitle: { fontSize: 13, lineHeight: 19, marginBottom: 16 },
  label: { fontSize: 12, fontWeight: "700", marginBottom: 6 },
  input: { minHeight: 52, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, fontSize: 16 },
  counter: { fontSize: 11, textAlign: "right", marginTop: 4, fontVariant: ["tabular-nums"] },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    marginTop: 10,
  },
  errorText: { flex: 1, fontSize: 13, fontWeight: "600" },
  actions: { flexDirection: "row", gap: 10, marginTop: 18 },
  cancelBtn: {
    flex: 1,
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: { fontSize: 15, fontWeight: "700" },
  confirmBtn: {
    flex: 1.4,
    minHeight: 52,
    borderRadius: 12,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  disabled: { opacity: 0.5 },
});
