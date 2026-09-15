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
  container: { flex: 1, backgroundColor: "#F6F8FD" },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(0, 0, 0, 0.06)",
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 8,
    borderRadius: 14,
    padding: 3,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
  },
  tabActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 2,
  },
  tabText: {
    color: "#64748B",
    fontSize: 14,
    fontWeight: "600",
  },
  tabTextActive: {
    color: "#0F172A",
    fontWeight: "700",
  },
});
