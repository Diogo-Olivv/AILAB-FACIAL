import { Tabs } from "expo-router";
import React from "react";
import { Platform } from "react-native";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#6C47FF",
        tabBarInactiveTintColor: "#6B7280",
        tabBarStyle: {
          backgroundColor: "#1A1A2E",
          borderTopColor: "#2A2A4A",
          borderTopWidth: 1,
          height: Platform.OS === "ios" ? 88 : 64,
          paddingBottom: Platform.OS === "ios" ? 24 : 8,
        },
        headerStyle: { backgroundColor: "#0F0F1A" },
        headerTintColor: "#fff",
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Presença",
          tabBarLabel: "Presença",
          tabBarIcon: ({ color }) => (
            <TabIcon emoji="🧪" color={color} />
          ),
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "Histórico",
          tabBarLabel: "Histórico",
          tabBarIcon: ({ color }) => (
            <TabIcon emoji="📋" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="camera"
        options={{
          title: "Câmera",
          tabBarLabel: "Câmera",
          tabBarIcon: ({ color }) => (
            <TabIcon emoji="📷" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="enroll"
        options={{
          title: "Cadastro",
          tabBarLabel: "Cadastro",
          tabBarIcon: ({ color }) => (
            <TabIcon emoji="🆕" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

function TabIcon({ emoji, color }: { emoji: string; color: string }) {
  const { Text } = require("react-native");
  return <Text style={{ fontSize: 20, opacity: color === "#6C47FF" ? 1 : 0.5 }}>{emoji}</Text>;
}
