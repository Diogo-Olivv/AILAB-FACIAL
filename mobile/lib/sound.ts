/**
 * Utilitário de áudio sintetizado nativo para Web e Mobile (Web Audio API)
 * Reproduz chimes suaves e elegantes estilo Apple Face ID / Apple Pay sem dependências pesadas.
 */

export function playAudioFeedback(type: "check_in" | "check_out" | "warning" | "error" | "enroll") {
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

    if (type === "check_in" || type === "enroll") {
      // Trinado harmônico ascendente suave (Apple Pay / Face ID chime)
      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.16); // G5
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
      osc.start(now);
      osc.stop(now + 0.38);
    } else if (type === "check_out") {
      // Tom harmônico suave descendente de despedida
      osc.type = "sine";
      osc.frequency.setValueAtTime(783.99, now); // G5
      osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
      osc.frequency.setValueAtTime(523.25, now + 0.2); // C5
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.42);
    } else if (type === "warning") {
      // Duplo pulso suave de atenção
      osc.type = "triangle";
      osc.frequency.setValueAtTime(440, now); // A4
      osc.frequency.setValueAtTime(392, now + 0.1); // G4
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
      osc.start(now);
      osc.stop(now + 0.28);
    } else {
      // Tom grave discreto de erro
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220, now); // A3
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      osc.start(now);
      osc.stop(now + 0.25);
    }
  } catch {
    // Ignora se áudio estiver silenciado pelo SO ou em execução headless
  }
}
