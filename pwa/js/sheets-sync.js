// Sincronização com Google Sheets via Apps Script webhook.
// Config (URL + token) fica em localStorage, configurada pelo modal de
// Configurações no PWA. Setup do Apps Script em docs/SHEETS_SETUP.md.

import { Storage } from "./storage.js";

const RETRY_INTERVAL_MS = 30_000;

export const SHEETS_KEYS = {
  webhook: "ailab_sheets_webhook",
  token: "ailab_sheets_token",
};

export function getSheetsConfig() {
  return {
    webhook: localStorage.getItem(SHEETS_KEYS.webhook) || "",
    token: localStorage.getItem(SHEETS_KEYS.token) || "",
  };
}

export function setSheetsConfig({ webhook, token }) {
  if (webhook) localStorage.setItem(SHEETS_KEYS.webhook, webhook.trim());
  else localStorage.removeItem(SHEETS_KEYS.webhook);
  if (token) localStorage.setItem(SHEETS_KEYS.token, token.trim());
  else localStorage.removeItem(SHEETS_KEYS.token);
}

// Faz um POST de teste com a configuração informada (sem persistir nada).
// Retorna { ok, status, body, error? }. Não lança.
export async function testarSheetsConfig({ webhook, token }) {
  if (!webhook || !token) {
    return { ok: false, error: "URL e token são obrigatórios" };
  }
  const payload = {
    token,
    data: new Date().toISOString().slice(0, 10),
    nome: "__ping__",
    entrada: "00:00",
    saida: "00:00",
    horas: "0.00",
  };
  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return { ok: false, status: res.status, error: `HTTP ${res.status}` };
    const text = await res.text();
    let body;
    try { body = JSON.parse(text); } catch { return { ok: false, error: "resposta não-JSON (Apps Script provavelmente não publicado como 'Qualquer pessoa')" }; }
    if (!body.ok) return { ok: false, body, error: body.error || "resposta sem ok:true" };
    return { ok: true, body };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function enviar(sessao, cfg, matricula) {
  const ci = new Date(sessao.check_in);
  const co = new Date(sessao.check_out);
  const abandonada = !!sessao.abandonada;
  const payload = {
    token: cfg.token,
    data: ci.toISOString().slice(0, 10),
    nome: sessao.pessoa,
    matricula: matricula || "",
    entrada: ci.toTimeString().slice(0, 5),
    saida: abandonada ? "n/a" : co.toTimeString().slice(0, 5),
    horas: abandonada ? "n/a" : ((co - ci) / 3600000).toFixed(2),
  };
  const res = await fetch(cfg.webhook, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  if (!body.ok) throw new Error(body.error || "resposta sem ok:true");
}

export async function sincronizar() {
  const cfg = getSheetsConfig();
  if (!cfg.webhook || !cfg.token) return;
  if (!navigator.onLine) return;
  
  const pessoas = await Storage.obterPessoas();
  const mapaMatriculas = {};
  for (const p of pessoas) {
    mapaMatriculas[p.id] = p.matricula;
  }

  const pendentes = await Storage.sessoesNaoSincronizadas();
  for (const s of pendentes) {
    try {
      const matricula = mapaMatriculas[s.pessoa] || "";
      await enviar(s, cfg, matricula);
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
window.addEventListener("sessao_fechada", sincronizar);
sincronizar();
