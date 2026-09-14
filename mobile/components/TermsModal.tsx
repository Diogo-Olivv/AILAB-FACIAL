import React from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function TermsModal({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.card,
            {
              paddingTop: Math.max(insets.top, 20),
              paddingBottom: Math.max(insets.bottom, 20),
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconCircle}>
                <Text style={styles.iconText}>⚖️</Text>
              </View>
              <View>
                <Text style={styles.title}>Termos de Uso e Privacidade</Text>
                <Text style={styles.subtitle}>
                  Tratamento Biométrico · LGPD (Lei 13.709/18 - Art. 11)
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityLabel="Fechar termos de privacidade"
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Scrollable Terms Body */}
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
          >
            {/* Box 1 */}
            <View style={styles.sectionBox}>
              <Text style={styles.sectionTitle}>
                1. IDENTIFICAÇÃO DO CONTROLADOR E FINALIDADE
              </Text>
              <Text style={styles.paragraph}>
                O tratamento de biometria facial é gerido exclusivamente pelo{" "}
                <Text style={styles.bold}>AILAB Makers (Maker Foundation)</Text>{" "}
                com o propósito estrito de controle acadêmico de presença e apuração
                do tempo de permanência no laboratório. Os dados jamais são
                comercializados, cedidos ou utilizados para fins publicitários ou
                vigilância externa.
              </Text>
            </View>

            {/* Box 2 */}
            <View style={styles.section}>
              <Text style={styles.sectionHeading}>
                2. BASE LEGAL PARA DADOS BIOMÉTRICOS SENSÍVEIS
              </Text>
              <Text style={styles.paragraph}>
                O tratamento enquadra-se no{" "}
                <Text style={styles.bold}>Artigo 11, inciso II, alínea "g" da LGPD</Text>,
                sendo utilizado estritamente para a garantia da prevenção à fraude
                e à segurança do titular nos processos de identificação e autenticação
                de presença presencial em ambiente acadêmico protegido.
              </Text>
            </View>

            {/* Box 3 */}
            <View style={styles.section}>
              <Text style={styles.sectionHeading}>
                3. DESCARTE IMEDIATO DE FOTOS E USO EXCLUSIVO DE VETORES
              </Text>
              <Text style={styles.paragraph}>
                O sistema adota o princípio de privacidade desde a concepção{" "}
                (<Text style={styles.bold}>Privacy by Design</Text>):
              </Text>
              <View style={styles.bulletList}>
                <Text style={styles.bulletItem}>
                  • As fotos capturadas na câmera permanecem apenas em memória volátil
                  temporária (RAM) durante o processamento da rede neural.
                </Text>
                <Text style={styles.bulletItem}>
                  • A rede extrai uma representação matemática unidirecional
                  (vetor numérico de embeddings normalizado).
                </Text>
                <Text style={styles.bulletItem}>
                  • <Text style={styles.bold}>As imagens brutas são imediatamente destruídas e descartadas.</Text>{" "}
                  Nenhuma foto fica salva no tablet ou no banco de dados. É matematicamente
                  impossível reconstruir a face original a partir do vetor numérico.
                </Text>
              </View>
            </View>

            {/* Box 4 */}
            <View style={styles.section}>
              <Text style={styles.sectionHeading}>
                4. SEGURANÇA TÉCNICA E ISOLAMENTO (RLS)
              </Text>
              <Text style={styles.paragraph}>
                A base de dados opera com políticas ativas de{" "}
                <Text style={styles.bold}>Row Level Security (RLS)</Text> no PostgreSQL,
                garantindo que os vetores biométricos sejam acessíveis apenas pelo
                mecanismo de inferência do servidor. A comunicação é criptografada via
                TLS 1.3 com tokens de desafio temporal anti-injeção e redes neurais de
                detecção de vivacidade presencial (anti-spoofing).
              </Text>
            </View>

            {/* Box 5 */}
            <View style={styles.section}>
              <Text style={styles.sectionHeading}>
                5. DIREITOS DO TITULAR (ART. 18 E ART. 8º § 5º DA LGPD)
              </Text>
              <Text style={styles.paragraph}>
                O integrante tem o direito garantido por lei a qualquer momento de:
              </Text>
              <View style={styles.bulletList}>
                <Text style={styles.bulletItem}>
                  • <Text style={styles.bold}>Revogação do Consentimento:</Text> Solicitar a
                  revogação do uso da biometria facial.
                </Text>
                <Text style={styles.bulletItem}>
                  • <Text style={styles.bold}>Expurgo Definitivo:</Text> Ao revogar, todos
                  os vetores biométricos são permanentemente excluídos do banco de dados e
                  o perfil inativado.
                </Text>
                <Text style={styles.bulletItem}>
                  • <Text style={styles.bold}>Transparência:</Text> Acompanhar seu histórico de
                  sessões diretamente no painel do laboratório.
                </Text>
              </View>
            </View>

            {/* Box 6 */}
            <View style={styles.footerNote}>
              <Text style={styles.footerNoteText}>
                Para exercer seus direitos de exclusão ou esclarecer dúvidas sobre seus
                dados, procure um dos tutores ou coordenadores do AILAB Makers.
              </Text>
            </View>
          </ScrollView>

          {/* Action Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.confirmBtn}
              onPress={onClose}
              activeOpacity={0.88}
            >
              <Text style={styles.confirmBtnText}>Entendido e Ciente</Text>
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
    backgroundColor: "rgba(20, 26, 51, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  card: {
    width: "100%",
    maxWidth: 620,
    maxHeight: "90%",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: "rgba(30, 45, 95, 0.16)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 10,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(30, 45, 95, 0.10)",
    backgroundColor: "#F4EFE4",
    paddingTop: 8,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#1E2D5F",
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    fontSize: 20,
  },
  title: {
    color: "#141A33",
    fontSize: 16,
    fontWeight: "800",
  },
  subtitle: {
    color: "#166534",
    fontSize: 11.5,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "rgba(30, 45, 95, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: {
    color: "#1E2D5F",
    fontSize: 15,
    fontWeight: "700",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    gap: 16,
  },
  sectionBox: {
    backgroundColor: "rgba(30, 45, 95, 0.05)",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(30, 45, 95, 0.10)",
  },
  sectionTitle: {
    color: "#1E2D5F",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  section: {
    gap: 6,
  },
  sectionHeading: {
    color: "#141A33",
    fontSize: 13,
    fontWeight: "700",
  },
  paragraph: {
    color: "#4B5563",
    fontSize: 13,
    lineHeight: 19,
  },
  bold: {
    fontWeight: "700",
    color: "#141A33",
  },
  bulletList: {
    gap: 6,
    paddingLeft: 4,
    marginTop: 2,
  },
  bulletItem: {
    color: "#4B5563",
    fontSize: 12.5,
    lineHeight: 18,
  },
  footerNote: {
    backgroundColor: "#F4EFE4",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(30, 45, 95, 0.08)",
  },
  footerNoteText: {
    color: "#6B6F82",
    fontSize: 12,
    lineHeight: 17,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(30, 45, 95, 0.10)",
    backgroundColor: "#FFFFFF",
  },
  confirmBtn: {
    backgroundColor: "#1E2D5F",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  confirmBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
});
