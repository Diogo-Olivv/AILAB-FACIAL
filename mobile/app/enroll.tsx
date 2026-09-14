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

      {/* Segmented control para alternar entre Novo Cadastro e Recadastro */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "enroll" && styles.tabActive]}
          onPress={() => setActiveTab("enroll")}
        >
          <Text style={[styles.tabText, activeTab === "enroll" && styles.tabTextActive]}>
            Novo Cadastro
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === "refresh" && styles.tabActive]}
          onPress={() => setActiveTab("refresh")}
        >
          <Text style={[styles.tabText, activeTab === "refresh" && styles.tabTextActive]}>
            Recadastro
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === "enroll" ? (
        <EnrollCapture tutorToken={tutorToken} />
      ) : (
        <RefreshCapture tutorToken={tutorToken} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4EFE4" },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(30,45,95,.08)",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
  },
  tabActive: {
    backgroundColor: "#1E2D5F",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    color: "#6B6F82",
    fontSize: 14,
    fontWeight: "600",
  },
  tabTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
});
