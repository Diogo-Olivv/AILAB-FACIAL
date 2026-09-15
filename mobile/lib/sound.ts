/**
 * Utilitário de áudio e vibração tátil de alta fidelidade
 * - No Android/iOS: reproduz WAVs de estúdio via `expo-audio` e feedback háptico via `expo-haptics`/`Vibration`.
 * - Na Web: fallback suave com síntese harmônica via Web Audio API.
 */

import { Platform, Vibration } from "react-native";
import * as Haptics from "expo-haptics";
import { createAudioPlayer } from "expo-audio";

export type InteractionFeedbackType =
  | "check_in"
  | "check_out"
  | "warning"
  | "error"
  | "enroll"
  | "tap";

const soundSources: Record<string, any> = {
  check_in: require("../assets/sounds/check_in.wav"),
  check_out: require("../assets/sounds/check_out.wav"),
  enroll: require("../assets/sounds/check_in.wav"),
  warning: require("../assets/sounds/warning.wav"),
  error: require("../assets/sounds/error.wav"),
  tap: require("../assets/sounds/tap.wav"),
};

// Cache de players nativos em memória para disparo com latência zero
const nativePlayers: Record<string, any> = {};

function getNativePlayer(key: string) {
  if (Platform.OS === "web") return null;
  try {
    if (!nativePlayers[key] && soundSources[key]) {
      nativePlayers[key] = createAudioPlayer(soundSources[key]);
    }
    return nativePlayers[key];
  } catch {
    return null;
  }
}

/**
 * Dispara vibração tátil de precisão de acordo com o contexto da interação
 */
export function triggerHaptic(type: InteractionFeedbackType) {
  if (Platform.OS === "web") return;
  try {
    if (type === "tap") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
        try {
          Vibration.vibrate(15);
        } catch {}
      });
    } else if (type === "check_in" || type === "enroll") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {
        try {
          Vibration.vibrate([0, 30, 40, 50]);
        } catch {}
      });
    } else if (type === "check_out") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {
        try {
          Vibration.vibrate(40);
        } catch {}
      });
    } else if (type === "warning") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {
        try {
          Vibration.vibrate([0, 40, 50, 40]);
        } catch {}
      });
    } else if (type === "error") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {
        try {
          Vibration.vibrate([0, 60, 40, 80]);
        } catch {}
      });
    }
  } catch {
    // Ignora silenciosamente se o dispositivo não tiver atuador háptico
  }
}

/**
 * Reproduz som harmônico dedicado para o tipo de evento
 */
export function playAudioFeedback(type: InteractionFeedbackType) {
  // 1. Caminho nativo via expo-audio
  if (Platform.OS !== "web") {
    try {
      const player = getNativePlayer(type);
      if (player) {
        player.seekTo(0).catch(() => {}).finally(() => {
          try {
            player.play();
          } catch {}
        });
        return;
      }
    } catch {
      // Fallback silencioso
    }
    return;
  }

  // 2. Caminho Web / Navegador via Web Audio API
  try {
    if (typeof window === "undefined") return;
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    if (type === "tap") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(1100, now);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
      osc.start(now);
      osc.stop(now + 0.035);
    } else if (type === "check_in" || type === "enroll") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.08);
      osc.frequency.setValueAtTime(783.99, now + 0.16);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
      osc.start(now);
      osc.stop(now + 0.38);
    } else if (type === "check_out") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(783.99, now);
      osc.frequency.setValueAtTime(659.25, now + 0.1);
      osc.frequency.setValueAtTime(523.25, now + 0.2);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.42);
    } else if (type === "warning") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(392, now + 0.1);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
      osc.start(now);
      osc.stop(now + 0.28);
    } else {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220, now);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      osc.start(now);
      osc.stop(now + 0.25);
    }
  } catch {
    // Silenciado
  }
}

/**
 * Dispara feedback sonoro E háptico coordenados simultaneamente
 */
export function notifyInteraction(type: InteractionFeedbackType) {
  triggerHaptic(type);
  playAudioFeedback(type);
}
