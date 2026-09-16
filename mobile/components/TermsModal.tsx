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
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View
        style={[
          styles.backdrop,
          {
            paddingTop: Math.max(insets.top, 16),
            paddingBottom: Math.max(insets.bottom, 16),
            paddingLeft: Math.max(insets.left, 16),
            paddingRight: Math.max(insets.right, 16),
          },
        ]}
      >
        <View style={styles.card}>
          {/* Header estilo Apple Glass & Claude Editorial */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconCircle}>
                <Text style={styles.iconText}>⚖️</Text>
              </View>
              <View style={styles.headerTitleGroup}>
                <Text style={styles.title}>Termos & Privacidade</Text>
                <Text style={styles.subtitle}>
                  Tratamento Biométrico · LGPD (Lei nº 13.709/18 - Art. 11)
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Fechar termos de privacidade"
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Scrollable Terms Body perfeitamente adaptado para tablets e landscape */}
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
            bounces={true}
            nestedScrollEnabled={true}
          >
            {/* Seção 1 - Identificação com Destaque Editorial Terracota */}
            <View style={styles.sectionBox}>
              <Text style={styles.sectionTitle}>
                1. IDENTIFICAÇÃO DO CONTROLADOR E FINALIDADE
              </Text>
              <Text style={styles.paragraphHighlight}>
                O tratamento de biometria facial é gerido exclusivamente pelo{" "}
                <Text style={styles.bold}>AILAB Makers (Maker Foundation)</Text>{" "}
                com o propósito estrito de controle acadêmico de presença e apuração
                do tempo de permanência no laboratório. Os dados jamais são
                comercializados, cedidos ou utilizados para fins publicitários ou
                vigilância externa.
              </Text>
            </View>

            {/* Seção 2 */}
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

            {/* Seção 3 */}
            <View style={styles.section}>
              <Text style={styles.sectionHeading}>
                3. DESCARTE IMEDIATO DE FOTOS E EMBEDDINGS 512-D
              </Text>
              <Text style={styles.paragraph}>
                O sistema adota o princípio de privacidade desde a concepção{" "}
                (<Text style={styles.bold}>Privacy by Design</Text>):
              </Text>
              <View style={styles.bulletList}>
                <Text style={styles.bulletItem}>
                  • As fotos capturadas na câmera permanecem apenas em memória volátil
                  temporária (RAM) durante a inferência neural.
                </Text>
                <Text style={styles.bulletItem}>
                  • A rede neural extrai uma representação matemática unidirecional
                  (vetor numérico de embeddings normalizado de 512 dimensões).
                </Text>
                <Text style={styles.bulletItem}>
                  • <Text style={styles.bold}>As imagens brutas são imediatamente destruídas e descartadas.</Text>{" "}
                  Nenhuma foto é salva no tablet ou no banco de dados. É matematicamente
                  impossível reconstruir a face original a partir do vetor numérico.
                </Text>
              </View>
            </View>

            {/* Seção 4 */}
            <View style={styles.section}>
              <Text style={styles.sectionHeading}>
                4. SEGURANÇA TÉCNICA E ISOLAMENTO (RLS)
              </Text>
              <Text style={styles.paragraph}>
                A base de dados opera com políticas ativas de{" "}
                <Text style={styles.bold}>Row Level Security (RLS)</Text> no PostgreSQL,
                garantindo que os vetores biométricos sejam acessíveis apenas pelo
                mecanismo de inferência do servidor. A comunicação é criptografada via
                TLS 1.3 com verificação anti-spoofing ativa no totem.
              </Text>
            </View>

            {/* Seção 5 */}
            <View style={styles.section}>
              <Text style={styles.sectionHeading}>
                5. DIREITOS DO TITULAR (ART. 18 DA LGPD)
              </Text>
              <Text style={styles.paragraph}>
                O integrante tem o direito garantido por lei a qualquer momento de:
              </Text>
              <View style={styles.bulletList}>
                <Text style={styles.bulletItem}>
                  • <Text style={styles.bold}>Revogação do Consentimento:</Text> Solicitar a
                  revogação do uso da biometria facial junto ao tutor.
                </Text>
                <Text style={styles.bulletItem}>
                  • <Text style={styles.bold}>Expurgo Definitivo:</Text> Ao revogar ou ser
                  descadastrado, todos os vetores biométricos são permanentemente excluídos
                  do banco de dados.
                </Text>
                <Text style={styles.bulletItem}>
                  • <Text style={styles.bold}>Transparência:</Text> Acompanhar o histórico de
                  sessões diretamente no painel do laboratório.
                </Text>
              </View>
            </View>

            {/* Nota de rodapé explicativa */}
            <View style={styles.footerNote}>
              <Text style={styles.footerNoteText}>
                Dúvidas ou solicitações de revogação: procure um dos tutores ou a
                coordenação do AILAB Makers no laboratório.
              </Text>
            </View>
          </ScrollView>

          {/* Action Footer estilo Apple Tactile Pill */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.confirmBtn}
              onPress={onClose}
              activeOpacity={0.88}
              accessibilityRole="button"
              accessibilityLabel="Confirmar ciência dos termos de uso"
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
    backgroundColor: "rgba(23, 23, 21, 0.65)",
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    width: "100%",
    maxWidth: 640,
    height: "92%",
    maxHeight: "92%",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E5E2DC",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
    elevation: 12,
    overflow: "hidden",
    flexDirection: "column",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E2DC",
    backgroundColor: "#FAF9F5",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  headerTitleGroup: {
    flex: 1,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#FAF5F0",
    borderWidth: 1,
    borderColor: "#F0DCD3",
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    fontSize: 18,
  },
  title: {
    color: "#171715",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  subtitle: {
    color: "#059669",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.2,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: {
    color: "#706E6A",
    fontSize: 14,
    fontWeight: "600",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 24,
    gap: 16,
  },
  sectionBox: {
    backgroundColor: "#FAF5F0",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#F0DCD3",
  },
  sectionTitle: {
    color: "#C15F3D",
    fontSize: 11.5,
    fontWeight: "700",
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  paragraphHighlight: {
    color: "#171715",
    fontSize: 13,
    lineHeight: 19,
  },
  section: {
    gap: 5,
  },
  sectionHeading: {
    color: "#171715",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  paragraph: {
    color: "#706E6A",
    fontSize: 12.5,
    lineHeight: 18,
  },
  bold: {
    fontWeight: "700",
    color: "#171715",
  },
  bulletList: {
    gap: 6,
    paddingLeft: 4,
    marginTop: 2,
  },
  bulletItem: {
    color: "#706E6A",
    fontSize: 12,
    lineHeight: 17,
  },
  footerNote: {
    backgroundColor: "#FAF9F5",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E2DC",
  },
  footerNoteText: {
    color: "#706E6A",
    fontSize: 11.5,
    lineHeight: 16,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "#E5E2DC",
    backgroundColor: "#FAF9F5",
    alignItems: "center",
  },
  confirmBtn: {
    width: "100%",
    maxWidth: 300,
    minHeight: 44,
    paddingVertical: 11,
    paddingHorizontal: 24,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#171715",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  confirmBtnText: {
    color: "#FAF9F5",
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
});
