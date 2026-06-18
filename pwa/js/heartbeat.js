import { getSheetsConfig } from "./sheets-sync.js";

const HEARTBEAT_INTERVAL_MS = 60 * 60 * 1000; // 1 hora

async function ping() {
  const cfg = getSheetsConfig();
  if (!cfg.webhook || !cfg.token) return;
  if (!navigator.onLine) return;

  const payload = {
    token: cfg.token,
    data: new Date().toISOString().slice(0, 10),
    nome: "__heartbeat__",
    entrada: "00:00",
    saida: "00:00",
    horas: "0.00",
  };

  try {
    const res = await fetch(cfg.webhook, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      console.log("Heartbeat enviado com sucesso.");
    }
  } catch (e) {
    console.warn("Falha ao enviar heartbeat", e);
  }
}

// Inicia o heartbeat logo após o boot, com delay, e depois em intervalos
setTimeout(() => {
  ping();
  setInterval(ping, HEARTBEAT_INTERVAL_MS);
}, 10000); // 10 segundos de delay inicial
