import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { endTutorSession, tutorClient } from "@/lib/supabase";
import { triggerHaptic } from "@/lib/sound";

interface Props {
  visible: boolean;
  onSuccess: (token: string) => void;
  onCancel: () => void;
  isDark?: boolean;
}

export function TutorPinModal({ visible, onSuccess, onCancel, isDark = false }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const scaleAnim = useRef(new Animated.Value(0.94)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          stiffness: 350,
          damping: 26,
          mass: 0.8,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.94);
      opacityAnim.setValue(0);
    }
  }, [visible, scaleAnim, opacityAnim]);

  /**
   * Autenticação real no Supabase Auth, no cliente ISOLADO do tutor.
   * Não há fallback local, senha embutida nem token fixo: sem sessão válida
   * com `app_metadata.role === "tutor"`, o acesso não é liberado.
   */
  async function handleLogin() {
    const rawEmail = email.trim().toLowerCase();
    const cleanEmail = rawEmail ? (rawEmail.includes("@") ? rawEmail : `${rawEmail}@ailab.com`) : "tutor@ailab.com";
    const cleanPassword = password.trim();

    if (!cleanPassword) {
      setErrorMsg("Informe a senha ou PIN do tutor.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const { data, error } = await tutorClient.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword,
      });

      if (error || !data?.session) {
        const isNetwork = !error?.status;
        setErrorMsg(
          isNetwork
            ? "Sem conexão com o servidor de autenticação. Tente novamente."
            : "E-mail ou senha de tutor incorretos."
        );
        return;
      }

      const role = data.session.user?.app_metadata?.role;
      if (role !== "tutor") {
        await endTutorSession();
        setErrorMsg("Acesso negado. Esta conta não possui privilégios de tutor.");
        return;
      }

      const token = data.session.access_token;
      setEmail("");
      setPassword("");
      setShowPassword(false);
      onSuccess(token);
    } catch {
      setErrorMsg("Não foi possível autenticar agora. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    triggerHaptic("tap");
    setEmail("");
    setPassword("");
    setShowPassword(false);
    setErrorMsg(null);
    onCancel();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <Animated.View
          style={[
            styles.card,
            isDark && styles.cardDark,
            {
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Cabeçalho */}
          <View style={styles.headerRow}>
            <View style={styles.iconBadge}>
              <Feather name="key" size={18} color={isDark ? "#FB923C" : "#EA580C"} />
            </View>
            <View style={styles.headerTextWrap}>
              <Text style={[styles.eyebrow, isDark && styles.eyebrowDark]}>
                AUTORIZAÇÃO ADMINISTRATIVA
              </Text>
              <Text style={[styles.title, isDark && styles.titleDark]}>
                Autenticação do Tutor
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleClose}
              style={[styles.closeBtn, isDark && styles.closeBtnDark]}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Fechar autenticação"
            >
              <Feather name="x" size={16} color={isDark ? "#94A3B8" : "#64748B"} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.subtitle, isDark && styles.subtitleDark]}>
            Apenas tutores autorizados podem liberar cadastros biométricos fora da janela cadastral.
          </Text>

          {/* Campo E-mail */}
          <View style={styles.formGroup}>
            <Text style={[styles.label, isDark && styles.labelDark]}>
              E-mail institucional
            </Text>
            <View style={[styles.inputWrap, isDark && styles.inputWrapDark]}>
              <Feather
                name="mail"
                size={15}
                color={isDark ? "#64748B" : "#94A3B8"}
              />
              <TextInput
                style={[styles.input, isDark && styles.inputDark]}
                placeholder="seu.email@instituicao"
                placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  if (errorMsg) setErrorMsg(null);
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>
          </View>

          {/* Campo Senha com Toggle Mostrar/Ocultar */}
          <View style={styles.formGroup}>
            <Text style={[styles.label, isDark && styles.labelDark]}>
              Senha do tutor
            </Text>
            <View style={[styles.inputWrap, isDark && styles.inputWrapDark]}>
              <Feather
                name="lock"
                size={15}
                color={isDark ? "#64748B" : "#94A3B8"}
              />
              <TextInput
                style={[styles.input, isDark && styles.inputDark]}
                placeholder="Digite sua senha"
                placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                value={password}
                onChangeText={(t) => {
                  setPassword(t);
                  if (errorMsg) setErrorMsg(null);
                }}
                secureTextEntry={!showPassword}
                returnKeyType="go"
                blurOnSubmit={false}
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity
                onPress={() => setShowPassword((prev) => !prev)}
                style={styles.eyeBtn}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                <Feather
                  name={showPassword ? "eye-off" : "eye"}
                  size={16}
                  color={isDark ? "#94A3B8" : "#64748B"}
                />
              </TouchableOpacity>
            </View>
          </View>

          {errorMsg && (
            <View style={styles.errorBox}>
              <Feather name="alert-circle" size={14} color="#F43F5E" />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          )}

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.cancelBtn, isDark && styles.cancelBtnDark]}
              onPress={handleClose}
              disabled={loading}
            >
              <Text style={[styles.cancelText, isDark && styles.cancelTextDark]}>
                Cancelar
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.confirmBtn,
                (!email.trim() || !password || loading) && styles.btnDisabled,
              ]}
              onPress={handleLogin}
              disabled={!email.trim() || !password || loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Feather name="unlock" size={14} color="#FFFFFF" />
                  <Text style={styles.confirmText}>Liberar Acesso</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
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
  card: {
    width: "100%",
    maxWidth: 430,
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 22,
    gap: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 10,
  },
  cardDark: {
    backgroundColor: "#0F1623",
    borderColor: "rgba(255, 255, 255, 0.10)",
    shadowColor: "#000000",
    shadowOpacity: 0.5,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconBadge: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "rgba(234, 88, 12, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(234, 88, 12, 0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextWrap: {
    flex: 1,
    gap: 1,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
    color: "#EA580C",
  },
  eyebrowDark: {
    color: "#FB923C",
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.3,
  },
  titleDark: {
    color: "#F8FAFC",
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnDark: {
    backgroundColor: "#161F30",
  },
  subtitle: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 18,
  },
  subtitleDark: {
    color: "#94A3B8",
  },
  formGroup: {
    gap: 6,
  },
  label: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#0F172A",
  },
  labelDark: {
    color: "#F8FAFC",
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 13,
    minHeight: 46,
  },
  inputWrapDark: {
    backgroundColor: "#161F30",
    borderColor: "rgba(255, 255, 255, 0.10)",
  },
  input: {
    flex: 1,
    fontSize: 14.5,
    color: "#0F172A",
    fontWeight: "600",
    paddingVertical: 10,
  },
  inputDark: {
    color: "#F8FAFC",
  },
  domainPill: {
    backgroundColor: "rgba(234, 88, 12, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(234, 88, 12, 0.25)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  domainPillText: {
    color: "#EA580C",
    fontSize: 11,
    fontWeight: "700",
  },
  eyeBtn: {
    padding: 6,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(244, 63, 94, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(244, 63, 94, 0.25)",
    borderRadius: 10,
    padding: 10,
  },
  errorText: {
    color: "#F43F5E",
    fontSize: 12.5,
    fontWeight: "700",
    flexShrink: 1,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    minHeight: 46,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  cancelBtnDark: {
    backgroundColor: "#161F30",
    borderColor: "rgba(255, 255, 255, 0.10)",
  },
  cancelText: {
    color: "#334155",
    fontWeight: "700",
    fontSize: 14,
  },
  cancelTextDark: {
    color: "#CBD5E1",
  },
  confirmBtn: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
    minHeight: 46,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EA580C",
    shadowColor: "#EA580C",
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  confirmText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 14,
  },
  btnDisabled: {
    opacity: 0.45,
  },
});
