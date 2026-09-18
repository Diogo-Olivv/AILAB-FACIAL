/**
 * Utilitário de áudio e vibração tátil de alta fidelidade
 * - No Android/iOS: reproduz WAVs de estúdio via `expo-audio` e feedback háptico via `expo-haptics`/`Vibration`.
 * - Na Web: fallback com síntese harmônica dupla via Web Audio API (dois osciladores + compressor).
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
  | "tap"
  | "success_big"
  | "denied"
  | "queue_next"
  | "countdown";

const soundSources: Record<string, any> = {
  check_in: require("../assets/sounds/check_in.wav"),
  check_out: require("../assets/sounds/check_out.wav"),
  enroll: require("../assets/sounds/check_in.wav"),
  success_big: require("../assets/sounds/check_in.wav"),
  warning: require("../assets/sounds/warning.wav"),
  error: require("../assets/sounds/error.wav"),
  denied: require("../assets/sounds/error.wav"),
  tap: require("../assets/sounds/tap.wav"),
  queue_next: require("../assets/sounds/tap.wav"),
  countdown: require("../assets/sounds/tap.wav"),
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
 * Dispara vibração tátil de precisão de acordo com o contexto da interação.
 * Cada evento tem um padrão rítmico único e inconfundível.
 */
export function triggerHaptic(type: InteractionFeedbackType) {
  if (Platform.OS === "web") return;
  try {
    switch (type) {
      case "tap":
      case "queue_next":
        // Toque leve e rápido — ação de UI
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
          try { Vibration.vibrate(12); } catch {}
        });
        break;

      case "check_in":
        // Duplo suave crescente — boas-vindas
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {
          try { Vibration.vibrate([0, 20, 40, 50]); } catch {}
        });
        break;

      case "check_out":
        // Duplo médio decrescente — até logo
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {
          try { Vibration.vibrate([0, 50, 40, 25]); } catch {}
        });
        break;

      case "enroll":
      case "success_big":
        // Triplo celebratório — cadastro ou conquista importante
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(async () => {
          try {
            Vibration.vibrate([0, 20, 35, 20, 35, 70]);
          } catch {}
        });
        // Segundo impacto com delay para efeito de fanfarra
        setTimeout(() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
        }, 180);
        break;

      case "warning":
        // Dois pulsos médios — atenção necessária
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {
          try { Vibration.vibrate([0, 40, 60, 40]); } catch {}
        });
        break;

      case "error":
      case "denied":
        // Brusco e forte — falha inequívoca
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {
          try { Vibration.vibrate([0, 80, 30, 90]); } catch {}
        });
        break;

      case "countdown":
        // Pulso único leve — beep de contagem
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
          try { Vibration.vibrate(30); } catch {}
        });
        break;
    }
  } catch {
    // Ignora silenciosamente se o dispositivo não tiver atuador háptico
  }
}

/**
 * Cria contexto de áudio com dois osciladores para som harmônico mais rico.
 * Retorna função de cleanup (stop + close).
 */
function createHarmonicTone(
  ctx: AudioContext,
  freq1: number,
  freq2: number,
  type1: OscillatorType,
  type2: OscillatorType,
  gain1: number,
  gain2: number,
  startTime: number,
  duration: number
): void {
  // Oscilador 1 — fundamental
  const osc1 = ctx.createOscillator();
  const gainNode1 = ctx.createGain();
  osc1.type = type1;
  osc1.frequency.setValueAtTime(freq1, startTime);
  gainNode1.gain.setValueAtTime(gain1, startTime);
  gainNode1.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc1.connect(gainNode1);

  // Oscilador 2 — harmônico
  const osc2 = ctx.createOscillator();
  const gainNode2 = ctx.createGain();
  osc2.type = type2;
  osc2.frequency.setValueAtTime(freq2, startTime);
  gainNode2.gain.setValueAtTime(gain2, startTime);
  gainNode2.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc2.connect(gainNode2);

  // Compressor dinâmico — evita clipping
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.setValueAtTime(-18, startTime);
  compressor.knee.setValueAtTime(6, startTime);
  compressor.ratio.setValueAtTime(4, startTime);
  compressor.attack.setValueAtTime(0.003, startTime);
  compressor.release.setValueAtTime(0.18, startTime);

  gainNode1.connect(compressor);
  gainNode2.connect(compressor);
  compressor.connect(ctx.destination);

  osc1.start(startTime);
  osc1.stop(startTime + duration + 0.02);
  osc2.start(startTime);
  osc2.stop(startTime + duration + 0.02);
}

/**
 * Reproduz som harmônico dedicado para o tipo de evento (fallback Web Audio API)
 */
function playWebAudioFeedback(type: InteractionFeedbackType): void {
  try {
    if (typeof window === "undefined") return;
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    switch (type) {
      case "tap":
      case "queue_next": {
        // Clique suave — sinewave limpa
        createHarmonicTone(ctx, 1200, 1800, "sine", "sine", 0.04, 0.015, now, 0.04);
        break;
      }

      case "check_in": {
        // Acorde maior ascendente C5→E5→G5 (Dó maior)
        createHarmonicTone(ctx, 523.25, 1046.5, "sine", "sine", 0.08, 0.025, now, 0.18);
        createHarmonicTone(ctx, 659.25, 1318.5, "sine", "triangle", 0.07, 0.02, now + 0.1, 0.18);
        createHarmonicTone(ctx, 783.99, 1567.98, "sine", "sine", 0.09, 0.03, now + 0.2, 0.22);
        break;
      }

      case "check_out": {
        // Acorde maior descendente G5→E5→C5
        createHarmonicTone(ctx, 783.99, 392.0, "sine", "sine", 0.08, 0.025, now, 0.18);
        createHarmonicTone(ctx, 659.25, 329.63, "sine", "triangle", 0.07, 0.02, now + 0.1, 0.18);
        createHarmonicTone(ctx, 523.25, 261.63, "sine", "sine", 0.06, 0.02, now + 0.2, 0.22);
        break;
      }

      case "enroll":
      case "success_big": {
        // Fanfarra ascendente C5→G5→C6 com sustain — celebração
        createHarmonicTone(ctx, 523.25, 261.63, "sine", "triangle", 0.08, 0.025, now, 0.15);
        createHarmonicTone(ctx, 783.99, 392.0, "sine", "sine", 0.09, 0.03, now + 0.12, 0.15);
        createHarmonicTone(ctx, 1046.5, 523.25, "sine", "triangle", 0.1, 0.035, now + 0.26, 0.35);
        // Acorde final com tônica + quinta
        createHarmonicTone(ctx, 1046.5, 783.99, "sine", "sine", 0.06, 0.02, now + 0.42, 0.28);
        break;
      }

      case "warning": {
        // Ré menor — intervalo de quinta diminuída A4→D4 com tremolo
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        const tremoloOsc = ctx.createOscillator();
        const tremoloGain = ctx.createGain();
        tremoloOsc.frequency.setValueAtTime(8, now); // 8 Hz tremolo
        tremoloGain.gain.setValueAtTime(0.04, now);
        tremoloOsc.connect(tremoloGain);
        tremoloGain.connect(g.gain);
        osc.type = "triangle";
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(349.23, now + 0.15);
        g.gain.setValueAtTime(0.07, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
        osc.connect(g);
        g.connect(ctx.destination);
        tremoloOsc.start(now);
        tremoloOsc.stop(now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
        createHarmonicTone(ctx, 440, 880, "triangle", "sine", 0.03, 0.01, now, 0.38);
        break;
      }

      case "error":
      case "denied": {
        // Tritono dissonante Bb4→E4 — inequívoco
        createHarmonicTone(ctx, 466.16, 233.08, "sawtooth", "square", 0.06, 0.02, now, 0.16);
        createHarmonicTone(ctx, 329.63, 164.81, "sawtooth", "sawtooth", 0.05, 0.015, now + 0.08, 0.22);
        createHarmonicTone(ctx, 233.08, 466.16, "square", "sawtooth", 0.04, 0.01, now + 0.22, 0.18);
        break;
      }

      case "countdown": {
        // Beep limpo e curto — contagem regressiva
        createHarmonicTone(ctx, 880, 1760, "sine", "sine", 0.06, 0.02, now, 0.07);
        break;
      }
    }
  } catch {
    // Silenciado
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
          try { player.play(); } catch {}
        });
        return;
      }
    } catch {
      // Fallback silencioso
    }
    return;
  }

  // 2. Caminho Web / Navegador via Web Audio API
  playWebAudioFeedback(type);
}

/**
 * Dispara feedback sonoro E háptico coordenados simultaneamente
 */
export function notifyInteraction(type: InteractionFeedbackType) {
  triggerHaptic(type);
  playAudioFeedback(type);
}
