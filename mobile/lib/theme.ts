import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const THEME_STORAGE_KEY = "@ailab_kiosk_theme";

export interface KioskPalette {
  isDark: boolean;
  canvas: string;
  surface1: string;
  surface2: string;
  surface3: string;
  borderSubtle: string;
  borderStrong: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentSoft: string;
  accentBorder: string;
  emerald: string;
  emeraldSoft: string;
  emeraldBorder: string;
  amber: string;
  amberSoft: string;
  amberBorder: string;
  rose: string;
  roseSoft: string;
  roseBorder: string;
}

export const LIGHT_PALETTE: KioskPalette = {
  isDark: false,
  canvas: "#F8FAFC",
  surface1: "#FFFFFF",
  surface2: "#F1F5F9",
  surface3: "rgba(255, 255, 255, 0.92)",
  borderSubtle: "#E2E8F0",
  borderStrong: "#CBD5E1",
  textPrimary: "#0F172A",
  textSecondary: "#334155",
  textMuted: "#64748B",
  accent: "#EA580C",
  accentSoft: "rgba(234, 88, 12, 0.10)",
  accentBorder: "rgba(234, 88, 12, 0.25)",
  emerald: "#059669",
  emeraldSoft: "rgba(16, 185, 129, 0.10)",
  emeraldBorder: "rgba(16, 185, 129, 0.25)",
  amber: "#D97706",
  amberSoft: "rgba(245, 158, 11, 0.12)",
  amberBorder: "rgba(245, 158, 11, 0.28)",
  rose: "#E11D48",
  roseSoft: "rgba(244, 63, 94, 0.10)",
  roseBorder: "rgba(244, 63, 94, 0.25)",
};

export const DARK_PALETTE: KioskPalette = {
  isDark: true,
  canvas: "#090D16",
  surface1: "#0F1623",
  surface2: "#161F30",
  surface3: "rgba(15, 22, 35, 0.92)",
  borderSubtle: "rgba(255, 255, 255, 0.08)",
  borderStrong: "rgba(255, 255, 255, 0.14)",
  textPrimary: "#F8FAFC",
  textSecondary: "#CBD5E1",
  textMuted: "#94A3B8",
  accent: "#FB923C",
  accentSoft: "rgba(249, 115, 22, 0.14)",
  accentBorder: "rgba(249, 115, 22, 0.32)",
  emerald: "#34D399",
  emeraldSoft: "rgba(16, 185, 129, 0.14)",
  emeraldBorder: "rgba(16, 185, 129, 0.30)",
  amber: "#FBBF24",
  amberSoft: "rgba(245, 158, 11, 0.15)",
  amberBorder: "rgba(245, 158, 11, 0.32)",
  rose: "#FB7185",
  roseSoft: "rgba(244, 63, 94, 0.15)",
  roseBorder: "rgba(244, 63, 94, 0.32)",
};

export function getPalette(isDark: boolean): KioskPalette {
  return isDark ? DARK_PALETTE : LIGHT_PALETTE;
}

// Estado global compartilhado em memória para sincronizar todas as telas instantaneamente
let currentIsDark = false;
let hydrated = false;
const themeListeners = new Set<(next: boolean) => void>();

function notifyThemeListeners(next: boolean) {
  currentIsDark = next;
  themeListeners.forEach((fn) => {
    try {
      fn(next);
    } catch {
      // Ignora erro de listener isolado
    }
  });
}

export async function setGlobalKioskTheme(nextIsDark: boolean): Promise<void> {
  notifyThemeListeners(nextIsDark);
  try {
    await AsyncStorage.setItem(THEME_STORAGE_KEY, nextIsDark ? "dark" : "light");
  } catch {
    // Ignora falha de escrita no storage
  }
}

export function useKioskTheme(initialOverride?: boolean) {
  const [isDark, setIsDark] = useState<boolean>(() =>
    typeof initialOverride === "boolean" ? initialOverride : currentIsDark
  );

  useEffect(() => {
    if (!hydrated) {
      hydrated = true;
      AsyncStorage.getItem(THEME_STORAGE_KEY)
        .then((saved: string | null) => {
          if (saved === "dark" || saved === "light") {
            notifyThemeListeners(saved === "dark");
          }
        })
        .catch(() => {
          // Mantém valor padrão
        });
    }

    const listener = (next: boolean) => setIsDark(next);
    themeListeners.add(listener);
    return () => {
      themeListeners.delete(listener);
    };
  }, []);

  const toggleTheme = useCallback(() => {
    void setGlobalKioskTheme(!currentIsDark);
  }, []);

  const setTheme = useCallback((next: boolean) => {
    void setGlobalKioskTheme(next);
  }, []);

  return {
    isDark,
    palette: getPalette(isDark),
    toggleTheme,
    setTheme,
  };
}
