import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#FFFFFF" },
          headerTintColor: "#0F172A",
          headerTitleStyle: { fontWeight: "800", fontSize: 17 },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: "#F6F8FD" },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="enroll" options={{ title: "Cadastro e Recadastro", presentation: "modal" }} />
      </Stack>
    </SafeAreaProvider>
  );
}
