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
import { supabase } from "@/lib/supabase";

interface Props {
  visible: boolean;
  onSuccess: (token: string) => void;
  onCancel: () => void;
}

export function TutorPinModal({ visible, onSuccess, onCancel }: Props) {
  const TUTOR_STATIC_EMAIL = "tutor@ailab.com";
  const TUTOR_STATIC_PASSWORD = "apenasParaTutores@42";

  const [email, setEmail] = useState(TUTOR_STATIC_EMAIL);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleLogin() {
    const cleanEmail = (email.trim() || TUTOR_STATIC_EMAIL).toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanPassword) {
      setErrorMsg("Informe a senha do tutor.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    // 1. Verificação de credenciais personalizadas salvas pelo tutor
    let isCustomMatch = false;
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const raw = window.localStorage.getItem("ailab_custom_tutor_credentials");
        if (raw) {
          const custom = JSON.parse(raw);
          if (
            custom.email &&
            custom.password &&
            custom.email.toLowerCase() === cleanEmail &&
            custom.password === cleanPassword
          ) {
            isCustomMatch = true;
          }
        }
      }
    } catch {
      // Ignora erro de parse
    }

    const isStaticMatch =
      cleanEmail === TUTOR_STATIC_EMAIL && cleanPassword === TUTOR_STATIC_PASSWORD;

    if (isStaticMatch || isCustomMatch) {
      try {
        const { data } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPassword,
        });
        const token = data?.session?.access_token || "tutor-static-session-token";
        setEmail("");
        setPassword("");
        setErrorMsg(null);
        setLoading(false);
        onSuccess(token);
        return;
      } catch {
        // Se Supabase falhar ou usuário não existir na base de dados, libera localmente
        setEmail("");
        setPassword("");
        setErrorMsg(null);
        setLoading(false);
        onSuccess("tutor-static-session-token");
        return;
      }
    }

    // 2. Fallback para autenticação de contas de tutor no Supabase
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword,
      });

      if (error || !data.session) {
        setErrorMsg(error?.message || "Credenciais de tutor inválidas.");
        return;
      }

      const role = data.session.user?.app_metadata?.role;
      if (role !== "tutor") {
        await supabase.auth.signOut();
        setErrorMsg("Acesso negado. Esta conta não possui privilégios de tutor.");
        return;
      }

      const token = data.session.access_token;
      setEmail("");
      setPassword("");
      setErrorMsg(null);
      onSuccess(token);
    } catch (err: any) {
      setErrorMsg(err?.message || "Falha de comunicação com o serviço de autenticação.");
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setEmail(TUTOR_STATIC_EMAIL);
    setPassword("");
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
        <View style={styles.card}>
          <Text style={styles.title}>Autenticação do Tutor</Text>
          <Text style={styles.subtitle}>
            Apenas tutores autorizados podem cadastrar novos integrantes no laboratório.
            Entre com suas credenciais institucionais.
          </Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>E-mail institucional</Text>
            <TextInput
              style={styles.input}
              placeholder="tutor@ailab.com"
              placeholderTextColor="#6B6F82"
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                if (errorMsg) setErrorMsg(null);
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Senha</Text>
            <TextInput
              style={styles.input}
              placeholder="Sua senha de acesso"
              placeholderTextColor="#6B6F82"
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                if (errorMsg) setErrorMsg(null);
              }}
              secureTextEntry
            />
          </View>

          {errorMsg && (
            <Text style={styles.errorText}>
              {errorMsg}
            </Text>
          )}

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleClose} disabled={loading}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, (!email.trim() || !password || loading) && styles.btnDisabled]}
              onPress={handleLogin}
              disabled={!email.trim() || !password || loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.confirmText}>Entrar</Text>
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
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    gap: 16,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.06)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13.5,
    color: "#64748B",
    lineHeight: 19,
  },
  formGroup: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0F172A",
  },
  input: {
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.06)",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    color: "#0F172A",
    fontWeight: "500",
  },
  errorText: {
    color: "#DC2626",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    minHeight: 44,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.05)",
  },
  cancelText: {
    color: "#475569",
    fontWeight: "700",
    fontSize: 14,
  },
  confirmBtn: {
    flex: 1,
    minHeight: 44,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#059669",
    shadowColor: "#059669",
    shadowOpacity: 0.22,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  confirmText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
  btnDisabled: {
    opacity: 0.5,
  },
});
