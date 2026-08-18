import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#1E2D5F" },
          headerTintColor: "#fff",
          contentStyle: { backgroundColor: "#F4EFE4" },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="enroll" options={{ title: "Cadastro", presentation: "modal" }} />
      </Stack>
    </SafeAreaProvider>
  );
}
