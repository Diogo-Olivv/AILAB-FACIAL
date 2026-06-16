// Loop de reconhecimento ao vivo para PWA AILAB.

import { Storage } from "./storage.js";

const THRESHOLD = 0.55; // docs/THRESHOLD.md
const DEBOUNCE_MS = 60_000;
const FRAME_INTERVAL_MS = 500;

const video = document.getElementById("video");
const overlay = document.getElementById("overlay");
const statusEl = document.getElementById("status");

function dist(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return Math.sqrt(s);
}

function setStatus(msg, classe = "") {
  statusEl.textContent = msg;
  statusEl.className = classe;
}

async function carregarModelos() {
  setStatus("Carregando modelos...");
  await faceapi.nets.tinyFaceDetector.loadFromUri("./models");
  await faceapi.nets.faceLandmark68Net.loadFromUri("./models");
  await faceapi.nets.faceRecognitionNet.loadFromUri("./models");
  setStatus("Modelos carregados");
}

async function abrirCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
    audio: false,
  });
  video.srcObject = stream;
  await new Promise((r) => (video.onloadedmetadata = r));
  await video.play();
  overlay.width = video.videoWidth;
  overlay.height = video.videoHeight;
}

async function identificar(pessoas) {
  const det = await faceapi
    .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320 }))
    .withFaceLandmarks()
    .withFaceDescriptor();
  if (!det) return null;
  let melhor = { nome: null, dist: Infinity };
  for (const p of pessoas) {
    const d = dist(p.embedding, det.descriptor);
    if (d < melhor.dist) melhor = { nome: p.nome, dist: d };
  }
  return { det, melhor };
}

async function registrarPresenca(nome) {
  const ultimo = await Storage.ultimoEvento(nome);
  if (ultimo && Date.now() - new Date(ultimo).getTime() < DEBOUNCE_MS) return null;
  const aberta = await Storage.sessaoAberta(nome);
  if (aberta) {
    const r = await Storage.fecharSessao(aberta.id);
    const minutos = Math.round((new Date(r.check_out) - new Date(r.check_in)) / 60000);
    return { acao: "saida", minutos };
  }
  await Storage.abrirSessao(nome);
  return { acao: "entrada" };
}

function desenhar(det, nome) {
  const ctx = overlay.getContext("2d");
  ctx.clearRect(0, 0, overlay.width, overlay.height);
  if (!det) return;
  const { x, y, width, height } = det.detection.box;
  ctx.lineWidth = 3;
  ctx.strokeStyle = nome ? "#4ad295" : "#ff6b6b";
  ctx.strokeRect(x, y, width, height);
  ctx.fillStyle = ctx.strokeStyle;
  ctx.font = "bold 22px sans-serif";
  ctx.fillText(nome || "?", x, y - 8);
}

async function loop() {
  const pessoas = await Storage.listarPessoas();
  if (pessoas.length === 0) {
    setStatus("Nenhuma pessoa cadastrada. Vá em Cadastro.", "warn");
    setTimeout(loop, 2000);
    return;
  }
  const t0 = Date.now();
  try {
    const r = await identificar(pessoas);
    if (!r) {
      setStatus("Aguardando rosto…");
      desenhar(null, null);
    } else {
      const { det, melhor } = r;
      if (melhor.dist < THRESHOLD) {
        desenhar(det, melhor.nome);
        const reg = await registrarPresenca(melhor.nome);
        if (reg?.acao === "entrada") {
          setStatus(`Olá, ${melhor.nome}! Entrada registrada.`, "ok");
        } else if (reg?.acao === "saida") {
          setStatus(`Tchau, ${melhor.nome}! Saída (${reg.minutos} min)`, "ok");
        } else {
          setStatus(`${melhor.nome} já registrado há pouco…`);
        }
      } else {
        desenhar(det, null);
        setStatus(`Desconhecido (dist ${melhor.dist.toFixed(2)})`, "warn");
      }
    }
  } catch (e) {
    console.error(e);
    setStatus("Erro: " + e.message, "warn");
  }
  const dt = Date.now() - t0;
  setTimeout(loop, Math.max(0, FRAME_INTERVAL_MS - dt));
}

async function main() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus("Câmera não suportada neste navegador", "warn");
    return;
  }
  await carregarModelos();
  await abrirCamera();
  loop();
}

window.addEventListener("DOMContentLoaded", main);
