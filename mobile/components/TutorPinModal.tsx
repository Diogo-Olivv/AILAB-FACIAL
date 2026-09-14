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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const TUTOR_STATIC_EMAIL = "tutor@ailab.com";
  const TUTOR_STATIC_PASSWORD = "apenasParaTutores@42";

  async function handleLogin() {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      setErrorMsg("Preencha e-mail e senha.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    // 1. Verificação direta das credenciais de tutor solicitadas pelo usuário
    if (cleanEmail === TUTOR_STATIC_EMAIL && cleanPassword === TUTOR_STATIC_PASSWORD) {
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
    setEmail("");
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
    borderRadius: 20,
    padding: 24,
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#141A33",
  },
  subtitle: {
    fontSize: 14,
    color: "#6B6F82",
    lineHeight: 20,
  },
  formGroup: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#141A33",
  },
  input: {
    backgroundColor: "#F4EFE4",
    borderWidth: 1.5,
    borderColor: "rgba(30,45,95,.2)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#141A33",
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
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#F4EFE4",
  },
  cancelText: {
    color: "#141A33",
    fontWeight: "700",
    fontSize: 15,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#166534",
  },
  confirmText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 15,
  },
  btnDisabled: {
    opacity: 0.5,
  },
});
