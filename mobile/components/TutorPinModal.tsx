import React, { useState } from "react";
import {
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

interface Props {
  visible: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}

const DEFAULT_PIN = process.env.EXPO_PUBLIC_TUTOR_PIN || "1234";

export function TutorPinModal({ visible, onSuccess, onCancel }: Props) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  function handleVerify() {
    if (pin.trim() === DEFAULT_PIN) {
      setPin("");
      setError(false);
      onSuccess();
    } else {
      setError(true);
      setPin("");
    }
  }

  function handleClose() {
    setPin("");
    setError(false);
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
          <Text style={styles.title}>Acesso Restrito ao Tutor</Text>
          <Text style={styles.subtitle}>
            Digite o PIN de autorização para cadastrar um novo integrante no laboratório.
          </Text>

          <TextInput
            style={[styles.input, error && styles.inputError]}
            placeholder="PIN de 4 dígitos"
            placeholderTextColor="#6B6F82"
            value={pin}
            onChangeText={(t) => {
              setPin(t.replace(/\D/g, "").slice(0, 4));
              if (error) setError(false);
            }}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
            autoFocus
          />

          {error && (
            <Text style={styles.errorText}>
              PIN incorreto. Apenas tutores autorizados podem cadastrar biometria.
            </Text>
          )}

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleClose}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, pin.length < 4 && styles.btnDisabled]}
              onPress={handleVerify}
              disabled={pin.length < 4}
            >
              <Text style={styles.confirmText}>Autorizar</Text>
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
    maxWidth: 400,
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
  input: {
    backgroundColor: "#F4EFE4",
    borderWidth: 1.5,
    borderColor: "rgba(30,45,95,.2)",
    borderRadius: 14,
    padding: 16,
    fontSize: 22,
    letterSpacing: 8,
    textAlign: "center",
    color: "#141A33",
    fontWeight: "700",
  },
  inputError: {
    borderColor: "#DC2626",
    backgroundColor: "#FEF2F2",
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
