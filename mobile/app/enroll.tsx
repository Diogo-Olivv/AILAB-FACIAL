import React, { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { EnrollCapture } from "@/components/EnrollCapture";
import { RefreshCapture } from "@/components/RefreshCapture";

type TabMode = "enroll" | "refresh";

export default function Enroll() {
  const router = useRouter();
  const { tutorToken, initialMode, mode } = useLocalSearchParams<{
    tutorToken?: string;
    initialMode?: TabMode;
    mode?: TabMode;
  }>();

  const [activeTab, setActiveTab] = useState<TabMode>(
    (initialMode || mode) === "refresh" ? "refresh" : "enroll"
  );

  useEffect(() => {
    if (!tutorToken) {
      router.replace("/");
    }
  }, [tutorToken, router]);

  if (!tutorToken) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: activeTab === "refresh" ? "Recadastro Biométrico" : "Cadastro de Integrante",
        }}
      />

      <View style={styles.responsiveWrapper}>
        {/* Segmented control para alternar entre Novo Cadastro e Recadastro */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === "enroll" && styles.tabActive]}
            onPress={() => setActiveTab("enroll")}
            activeOpacity={0.8}
            accessibilityRole="tab"
            aria-selected={activeTab === "enroll"}
          >
            <Text style={[styles.tabText, activeTab === "enroll" && styles.tabTextActive]}>
              Novo Cadastro
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === "refresh" && styles.tabActive]}
            onPress={() => setActiveTab("refresh")}
            activeOpacity={0.8}
            accessibilityRole="tab"
            aria-selected={activeTab === "refresh"}
          >
            <Text style={[styles.tabText, activeTab === "refresh" && styles.tabTextActive]}>
              Recadastro
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.contentContainer}>
          {activeTab === "enroll" ? (
            <EnrollCapture tutorToken={tutorToken} />
          ) : (
            <RefreshCapture tutorToken={tutorToken} />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAF9F5", alignItems: "center" },
  responsiveWrapper: {
    flex: 1,
    width: "100%",
    maxWidth: 640,
  },
  contentContainer: {
    flex: 1,
    width: "100%",
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(0, 0, 0, 0.04)",
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 8,
    borderRadius: 14,
    padding: 3,
    gap: 4,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.04)",
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
  },
  tabActive: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.05)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  tabText: {
    color: "#78716C",
    fontSize: 13.5,
    fontWeight: "600",
  },
  tabTextActive: {
    color: "#171715",
    fontWeight: "700",
  },
});
