import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useKioskTheme } from "@/lib/theme";

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
