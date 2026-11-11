import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { View, Text, TouchableOpacity } from "react-native";
import { useKioskTheme } from "@/lib/theme";

export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: "#0F172A" }}>
      <Text style={{ color: "#EF4444", fontSize: 18, fontWeight: "bold", marginBottom: 12 }}>
        Falha ao inicializar aplicativo
      </Text>
      <Text style={{ color: "#94A3B8", fontSize: 13, textAlign: "center", marginBottom: 20 }}>
        {error?.message || "Ocorreu um erro inesperado."}
      </Text>
      <TouchableOpacity
        onPress={retry}
        style={{ backgroundColor: "#EA580C", paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 }}
      >
        <Text style={{ color: "#FFFFFF", fontWeight: "bold" }}>Tentar Novamente</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function RootLayout() {
  const { isDark, palette } = useKioskTheme();

  return (
    <SafeAreaProvider>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: palette.surface1 },
          headerTintColor: palette.textPrimary,
          headerTitleStyle: { fontWeight: "800", fontSize: 17 },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: palette.canvas },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen
          name="enroll"
          options={{
            title: "Cadastro e Recadastro",
            presentation: "modal",
          }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}
