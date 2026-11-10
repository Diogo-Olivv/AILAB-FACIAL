import React, { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { getAvatarColor } from "@/lib/config";

interface KioskAvatarProps {
  name: string;
  uri?: string | null;
  size?: number;
  isTutor?: boolean;
  online?: boolean;
  isDark?: boolean;
}

function extractInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "IN";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function KioskAvatar({
  name,
  uri,
  size = 40,
  isTutor = false,
  online = false,
  isDark = false,
}: KioskAvatarProps) {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [uri]);

  const color = getAvatarColor(name || "Integrante");
  const initials = extractInitials(name || "Integrante");
  const radius = Math.round(size / 2);
  const showImage = Boolean(uri) && !imgError;
  const dotSize = Math.max(10, Math.round(size * 0.28));

  const ringStyle = isTutor
    ? {
        borderWidth: 2,
        borderColor: isDark ? "#FB923C" : "#EA580C",
      }
    : {
        borderWidth: 1.5,
        borderColor: isDark ? "rgba(255, 255, 255, 0.14)" : "#E2E8F0",
      };

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      {showImage ? (
        <Image
          source={{ uri: uri as string }}
          onError={() => setImgError(true)}
          style={[
            styles.circle,
            {
              width: size,
              height: size,
              borderRadius: radius,
              backgroundColor: isDark ? "#161F30" : "#E2E8F0",
            },
            ringStyle,
          ]}
        />
      ) : (
        <View
          style={[
            styles.circle,
            {
              width: size,
              height: size,
              borderRadius: radius,
              backgroundColor: color.bg,
            },
            ringStyle,
          ]}
        >
          <Text
            style={[
              styles.initials,
              {
                color: color.text,
                fontSize: Math.max(11, Math.round(size * 0.34)),
              },
            ]}
          >
            {initials}
          </Text>
        </View>
      )}

      {online && (
        <View
          style={[
            styles.onlineDot,
            {
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              borderColor: isDark ? "#0F1623" : "#FFFFFF",
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "relative",
    flexShrink: 0,
  },
  circle: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  initials: {
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  onlineDot: {
    position: "absolute",
    bottom: -1,
    right: -1,
    backgroundColor: "#10B981",
    borderWidth: 2,
  },
});
