// UI de cadastro: captura N descritores e salva embedding médio no IndexedDB.

import { Storage } from "./storage.js";

const N_FOTOS = 8;

const video = document.getElementById("video");
const statusEl = document.getElementById("status");
const nomeInput = document.getElementById("nome");
const btnCapturar = document.getElementById("btn-capturar");
const listaEl = document.getElementById("lista");

function setStatus(msg, classe = "") {
  statusEl.textContent = msg;
  statusEl.className = classe;
}

async function carregarModelos() {
  setStatus("Carregando modelos...");
  await faceapi.nets.tinyFaceDetector.loadFromUri("./models");
  await faceapi.nets.faceLandmark68Net.loadFromUri("./models");
  await faceapi.nets.faceRecognitionNet.loadFromUri("./models");
  setStatus("Pronto. Digite o nome e clique Capturar.");
}

async function abrirCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user", width: { ideal: 640 } },
    audio: false,
  });
  video.srcObject = stream;
  await new Promise((r) => (video.onloadedmetadata = r));
  await video.play();
}

async function capturarUma() {
  const det = await faceapi
    .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 416 }))
    .withFaceLandmarks()
    .withFaceDescriptor();
  return det?.descriptor || null;
}

async function fluxoCadastro() {
  const nome = nomeInput.value.trim().toLowerCase().replace(/\s+/g, "_");
  if (!/^[a-z0-9_]+$/.test(nome)) {
    setStatus("Nome inválido. Use letras/dígitos/underscore.", "warn");
    return;
  }
  btnCapturar.disabled = true;
  const descritores = [];

  for (let i = 1; i <= N_FOTOS; i++) {
    setStatus(`Foto ${i}/${N_FOTOS} — olhe para a câmera`);
    await new Promise((r) => setTimeout(r, 1500));
    const desc = await capturarUma();
    if (!desc) {
      setStatus(`Foto ${i}: sem rosto. Tentando de novo…`, "warn");
      i--;
      continue;
    }
    descritores.push(desc);
  }

  const dim = descritores[0].length;
  const media = new Float32Array(dim);
  for (const d of descritores) for (let i = 0; i < dim; i++) media[i] += d[i];
  for (let i = 0; i < dim; i++) media[i] /= descritores.length;

  await Storage.addPessoa(nome, media);
  setStatus(`✓ ${nome} cadastrado com ${N_FOTOS} fotos.`, "ok");
  nomeInput.value = "";
  btnCapturar.disabled = false;
  await atualizarLista();
}

async function atualizarLista() {
  const pessoas = await Storage.listarPessoas();
  listaEl.innerHTML = "";
  for (const p of pessoas) {
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.textContent = `${p.nome} — ${p.cadastrado_em.slice(0, 10)}`;
    li.appendChild(span);
    const btn = document.createElement("button");
    btn.textContent = "Remover";
    btn.onclick = async () => {
      if (confirm(`Remover ${p.nome}?`)) {
        await Storage.removerPessoa(p.nome);
        atualizarLista();
      }
    };
    li.appendChild(btn);
    listaEl.appendChild(li);
  }
}

async function main() {
  await carregarModelos();
  await abrirCamera();
  btnCapturar.addEventListener("click", fluxoCadastro);
  await atualizarLista();
}

window.addEventListener("DOMContentLoaded", main);
