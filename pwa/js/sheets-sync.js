// Sincronização com Google Sheets via Apps Script webhook.
// Setup completo em docs/SHEETS_SETUP.md

import { Storage } from "./storage.js";

const SHEETS_WEBHOOK = "https://script.google.com/macros/s/AKfycbyy4MXP-v2f_4MUpWPGGn4HoOqG3yBlIxDs68ESyKv_kAwsXKR5SrMzV8kJQDxH8TuQow/exec";
const RETRY_INTERVAL_MS = 30_000;

async function enviar(sessao) {
  if (!SHEETS_WEBHOOK) throw new Error("SHEETS_WEBHOOK não configurado");
  const ci = new Date(sessao.check_in);
  const co = new Date(sessao.check_out);
  const horas = ((co - ci) / 3600000).toFixed(2);
  const payload = {
    data: ci.toISOString().slice(0, 10),
    nome: sessao.pessoa,
    entrada: ci.toTimeString().slice(0, 5),
    saida: co.toTimeString().slice(0, 5),
    horas,
  };
  await fetch(SHEETS_WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    mode: "no-cors",
  });
}

async function sincronizar() {
  if (!SHEETS_WEBHOOK) return;
  if (!navigator.onLine) return;
  const pendentes = await Storage.sessoesNaoSincronizadas();
  for (const s of pendentes) {
    try {
      await enviar(s);
      await Storage.marcarSincronizada(s.id);
      console.log("✓ sincronizado", s.id);
    } catch (e) {
      console.warn("falha ao sincronizar", s.id, e);
      break;
    }
  }
}

setInterval(sincronizar, RETRY_INTERVAL_MS);
window.addEventListener("online", sincronizar);
sincronizar();
