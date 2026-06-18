// Controlador unificado: reconhecimento + cadastro em página única.
// State machine: 'recognizing' (default) ↔ 'enrolling' (pausa reconhecimento).

import { Storage, MAX_SESSAO_MS } from "./storage.js";
import { getSheetsConfig, setSheetsConfig, testarSheetsConfig, sincronizar } from "./sheets-sync.js";

const THRESHOLD = 0.55;          // docs/THRESHOLD.md
const DEBOUNCE_MS = 60_000;      // 60s entre eventos do mesmo nome
const FRAME_INTERVAL_MS = 500;
const N_FOTOS = 8;
const DELAY_ENTRE_FOTOS_MS = 700;
const DETECTOR_INPUT_SIZE_RECONHECER = 320;
const DETECTOR_INPUT_SIZE_ENROLL = 224;
const MAX_TENTATIVAS_SEM_ROSTO = 20;
const TOAST_MS = 3000;

// --- elementos ---
const video = document.getElementById("video");
const overlay = document.getElementById("overlay");
const statusEl = document.getElementById("status");
const toastEl = document.getElementById("toast");
const enrollPanel = document.getElementById("enroll-panel");
const enrollStatus = document.getElementById("enroll-status");
const nomeInput = document.getElementById("nome");
const btnAbrirEnroll = document.getElementById("btn-abrir-enroll");
const btnCancelarEnroll = document.getElementById("btn-cancelar-enroll");
const btnCapturar = document.getElementById("btn-capturar");
const btnGerenciar = document.getElementById("btn-gerenciar");
const gerenciarPanel = document.getElementById("gerenciar-panel");
const listaEl = document.getElementById("lista");
const btnExportar = document.getElementById("btn-exportar");
const btnImportar = document.getElementById("btn-importar");
const fileImport = document.getElementById("file-import");
const btnConfigSheets = document.getElementById("btn-config-sheets");
const configPanel = document.getElementById("config-panel");
const cfgWebhook = document.getElementById("cfg-webhook");
const cfgToken = document.getElementById("cfg-token");
const cfgStatus = document.getElementById("cfg-status");
const btnTestarConfig = document.getElementById("btn-testar-config");
const btnSalvarConfig = document.getElementById("btn-salvar-config");
const btnCancelarConfig = document.getElementById("btn-cancelar-config");

const lgpdConsent = document.getElementById("lgpd-consent");
const pinPanel = document.getElementById("pin-panel");
const pinInput = document.getElementById("pin-input");
const pinStatus = document.getElementById("pin-status");
const btnCancelarPin = document.getElementById("btn-cancelar-pin");
const btnConfirmarPin = document.getElementById("btn-confirmar-pin");

const EXPORT_FORMAT_VERSION = 1;
const ADMIN_PIN = "1234";

// --- state ---
let modo = "recognizing"; // 'recognizing' | 'enrolling'

// --- utils ---

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

function setEnrollStatus(msg, classe = "") {
  enrollStatus.textContent = msg;
  enrollStatus.style.color = classe === "warn" ? "var(--warn)" : "var(--muted)";
}

let toastTimer = null;
function mostrarToast(msg, sub = "", classe = "") {
  toastEl.innerHTML = sub
    ? `${msg}<span class="toast-sub">${sub}</span>`
    : msg;
  toastEl.className = classe === "warn" ? "show warn" : "show";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.remove("show");
  }, TOAST_MS);
}
toastEl.addEventListener("click", () => {
  toastEl.classList.remove("show");
  clearTimeout(toastTimer);
});

// --- modelos / câmera (compartilhada) ---

async function carregarModelos() {
  setStatus("Carregando modelos...");
  try {
    await faceapi.nets.tinyFaceDetector.loadFromUri("./models");
    await faceapi.nets.faceLandmark68Net.loadFromUri("./models");
    await faceapi.nets.faceRecognitionNet.loadFromUri("./models");
  } catch (e) {
    console.error("Falha ao carregar modelos:", e);
    setStatus(
      `Erro ao carregar modelos: ${e.message}. Veja pwa/models/ e o console.`,
      "warn",
    );
    throw e;
  }
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

// --- reconhecimento ---

async function identificar(pessoas) {
  const det = await faceapi
    .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: DETECTOR_INPUT_SIZE_RECONHECER }))
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

// registrarPresenca aplica o limite de 10h: se já tem sessão aberta
// há mais que MAX_SESSAO_MS, fecha como abandonada e abre nova entrada.
async function registrarPresenca(nome) {
  const ultimo = await Storage.ultimoEvento(nome);
  if (ultimo && Date.now() - new Date(ultimo).getTime() < DEBOUNCE_MS) return null;

  const aberta = await Storage.sessaoAberta(nome);
  if (aberta) {
    const inicio = new Date(aberta.check_in).getTime();
    if (Date.now() - inicio > MAX_SESSAO_MS) {
      // > 10h: encerra como abandonada e abre entrada nova
      await Storage.fecharSessaoAbandonada(aberta.id);
      await Storage.abrirSessao(nome);
      return { acao: "entrada_pos_abandono" };
    }
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

function formatarMinutos(min) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

async function loop() {
  if (modo !== "recognizing") {
    setTimeout(loop, FRAME_INTERVAL_MS);
    return;
  }

  const pessoas = await Storage.listarPessoas();
  if (pessoas.length === 0) {
    setStatus("Nenhuma pessoa cadastrada. Clique em + Cadastrar.", "warn");
    desenhar(null, null);
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
          setStatus(`Entrada de ${melhor.nome} registrada.`, "ok");
          mostrarToast(`Olá, ${melhor.nome}!`, "Entrada registrada");
        } else if (reg?.acao === "saida") {
          setStatus(`Saída de ${melhor.nome} registrada.`, "ok");
          mostrarToast(`Até mais, ${melhor.nome}!`, `Saída registrada · ${formatarMinutos(reg.minutos)}`);
        } else if (reg?.acao === "entrada_pos_abandono") {
          setStatus(`Sessão anterior expirou. Nova entrada de ${melhor.nome}.`, "warn");
          mostrarToast(
            `Olá, ${melhor.nome}!`,
            "Sessão anterior > 10h foi encerrada como abandonada",
            "warn",
          );
        } else {
          setStatus(`${melhor.nome} já registrado há pouco…`);
        }
      } else {
        desenhar(det, null);
        setStatus(`Rosto não reconhecido (dist ${melhor.dist.toFixed(2)})`, "warn");
      }
    }
  } catch (e) {
    console.error(e);
    setStatus("Erro: " + e.message, "warn");
  }

  const dt = Date.now() - t0;
  setTimeout(loop, Math.max(0, FRAME_INTERVAL_MS - dt));
}

// --- enroll ---

async function capturarDescritor() {
  const det = await faceapi
    .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: DETECTOR_INPUT_SIZE_ENROLL }))
    .withFaceLandmarks()
    .withFaceDescriptor();
  return det?.descriptor || null;
}

function abrirEnroll() {
  modo = "enrolling";
  nomeInput.value = "";
  lgpdConsent.checked = false;
  setEnrollStatus("Digite o nome e clique Capturar.");
  btnCapturar.disabled = false;
  enrollPanel.classList.add("active");
  setTimeout(() => nomeInput.focus(), 50);
}

function fecharEnroll() {
  enrollPanel.classList.remove("active");
  modo = "recognizing";
  desenhar(null, null);
}

async function fluxoCadastro() {
  if (!lgpdConsent.checked) {
    setEnrollStatus("Você deve aceitar o Termo de Consentimento LGPD.", "warn");
    return;
  }
  const nome = nomeInput.value.trim().toLowerCase().replace(/\s+/g, "_");
  if (!/^[a-z0-9_]+$/.test(nome)) {
    setEnrollStatus("Nome inválido. Use letras/dígitos/underscore.", "warn");
    return;
  }
  btnCapturar.disabled = true;
  btnCancelarEnroll.disabled = true;

  const descritores = [];
  let tentativasSemRosto = 0;

  try {
    for (let i = 1; i <= N_FOTOS; i++) {
      setEnrollStatus(`Foto ${i}/${N_FOTOS} — olhe para a câmera`);
      await new Promise((r) => setTimeout(r, DELAY_ENTRE_FOTOS_MS));
      const desc = await capturarDescritor();
      if (!desc) {
        tentativasSemRosto++;
        if (tentativasSemRosto >= MAX_TENTATIVAS_SEM_ROSTO) {
          setEnrollStatus(
            `Cancelado: ${MAX_TENTATIVAS_SEM_ROSTO} tentativas sem detectar rosto.`,
            "warn",
          );
          return;
        }
        setEnrollStatus(
          `Foto ${i}: sem rosto (${tentativasSemRosto}/${MAX_TENTATIVAS_SEM_ROSTO}). Tentando…`,
          "warn",
        );
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
    await atualizarLista();
    mostrarToast(`${nome} cadastrado`, `${N_FOTOS} fotos capturadas`);
    fecharEnroll();
  } finally {
    btnCapturar.disabled = false;
    btnCancelarEnroll.disabled = false;
  }
}

// --- gerenciar (lista) ---

async function atualizarLista() {
  const pessoas = await Storage.listarPessoas();
  listaEl.innerHTML = "";
  if (pessoas.length === 0) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "Nenhum cadastro.";
    listaEl.appendChild(li);
    return;
  }
  for (const p of pessoas) {
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.textContent = `${p.nome} · ${p.cadastrado_em.slice(0, 10)}`;
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

// --- export / import ---

async function exportarCadastros() {
  const pessoas = await Storage.listarPessoas();
  if (pessoas.length === 0) {
    mostrarToast("Nada para exportar", "Nenhum cadastro encontrado", "warn");
    return;
  }
  const blob = new Blob(
    [JSON.stringify(
      { version: EXPORT_FORMAT_VERSION, exportado_em: new Date().toISOString(), pessoas },
      null, 2,
    )],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `ailab-cadastros-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  mostrarToast(
    `${pessoas.length} cadastro(s) exportado(s)`,
    "Guarde o arquivo em local seguro (dado biométrico)",
  );
}

async function importarCadastros(file) {
  let payload;
  try {
    const texto = await file.text();
    payload = JSON.parse(texto);
  } catch {
    mostrarToast("Arquivo inválido", "JSON malformado", "warn");
    return;
  }
  if (!payload || !Array.isArray(payload.pessoas)) {
    mostrarToast("Formato não reconhecido", "Esperado: { pessoas: [...] }", "warn");
    return;
  }
  const existentes = new Set(
    (await Storage.listarPessoas()).map((p) => p.nome),
  );
  const conflitos = payload.pessoas
    .filter((p) => p && existentes.has(p.nome))
    .map((p) => p.nome);

  let sobrescrever = false;
  if (conflitos.length > 0) {
    const lista = conflitos.slice(0, 5).join(", ") + (conflitos.length > 5 ? "…" : "");
    sobrescrever = confirm(
      `${conflitos.length} cadastro(s) já existem (${lista}).\n\n` +
      `OK = sobrescrever com os do arquivo\n` +
      `Cancelar = manter os atuais e pular os duplicados`,
    );
  }

  const stats = await Storage.importarPessoas(payload.pessoas, { sobrescrever });
  await atualizarLista();
  const partes = [];
  if (stats.adicionadas) partes.push(`${stats.adicionadas} novo(s)`);
  if (stats.sobrescritas) partes.push(`${stats.sobrescritas} sobrescrito(s)`);
  if (stats.ignoradas) partes.push(`${stats.ignoradas} ignorado(s)`);
  if (stats.invalidas) partes.push(`${stats.invalidas} inválido(s)`);
  mostrarToast("Importação concluída", partes.join(" · ") || "sem mudanças");
}

// --- config sheets ---

function abrirConfigSheets() {
  const atual = getSheetsConfig();
  cfgWebhook.value = atual.webhook;
  cfgToken.value = atual.token;
  cfgStatus.textContent = atual.webhook && atual.token
    ? "Configurado neste dispositivo."
    : "Não configurado — sincronização desabilitada.";
  cfgStatus.style.color = "var(--muted)";
  configPanel.classList.add("active");
  setTimeout(() => cfgWebhook.focus(), 50);
}

function fecharConfigSheets() {
  configPanel.classList.remove("active");
}

function _setCfgStatus(msg, classe = "") {
  cfgStatus.textContent = msg;
  cfgStatus.style.color = classe === "ok" ? "var(--accent)" :
                          classe === "warn" ? "var(--warn)" : "var(--muted)";
}

async function testarConfigSheets() {
  const webhook = cfgWebhook.value.trim();
  const token = cfgToken.value.trim();
  if (!webhook || !token) {
    _setCfgStatus("Preencha URL e token.", "warn");
    return;
  }
  btnTestarConfig.disabled = true;
  _setCfgStatus("Testando…");
  const r = await testarSheetsConfig({ webhook, token });
  btnTestarConfig.disabled = false;
  if (r.ok) {
    _setCfgStatus("✓ Conectado. Apps Script respondeu ok:true.", "ok");
  } else {
    _setCfgStatus("✗ " + (r.error || "falha desconhecida"), "warn");
  }
}

function salvarConfigSheets() {
  const webhook = cfgWebhook.value.trim();
  const token = cfgToken.value.trim();
  setSheetsConfig({ webhook, token });
  mostrarToast("Configuração salva", webhook && token ? "Sincronização ativa" : "Sincronização desabilitada (campos vazios)");
  fecharConfigSheets();
  if (webhook && token) sincronizar();
}

// --- bootstrap ---

async function main() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus("Câmera não suportada neste navegador", "warn");
    return;
  }
  await carregarModelos();
  await abrirCamera();
  setStatus("Pronto. Aguardando rosto…");

  // Pede ao browser para não despejar a IndexedDB sob pressão de armazenamento.
  if (navigator.storage?.persist) {
    navigator.storage.persist().catch(() => {});
  }

  // Sweep de sessões > 10h sem saída registrada.
  try {
    const fechadas = await Storage.varrerSessoesExpiradas();
    if (fechadas.length) {
      mostrarToast(
        `${fechadas.length} sessão(ões) expiradas fechadas`,
        "Saídas marcadas como n/a no Sheets",
        "warn",
      );
    }
  } catch (e) {
    console.warn("varrerSessoesExpiradas falhou:", e);
  }

  btnAbrirEnroll.addEventListener("click", abrirEnroll);
  btnCancelarEnroll.addEventListener("click", fecharEnroll);
  btnCapturar.addEventListener("click", fluxoCadastro);

  btnCancelarPin.addEventListener("click", () => {
    pinPanel.classList.remove("active");
  });
  btnConfirmarPin.addEventListener("click", async () => {
    if (pinInput.value === ADMIN_PIN) {
      pinPanel.classList.remove("active");
      gerenciarPanel.classList.add("active");
      await atualizarLista();
    } else {
      pinStatus.textContent = "PIN incorreto.";
    }
  });

  btnGerenciar.addEventListener("click", () => {
    if (gerenciarPanel.classList.contains("active")) {
      gerenciarPanel.classList.remove("active");
    } else {
      pinInput.value = "";
      pinStatus.textContent = "";
      pinPanel.classList.add("active");
      setTimeout(() => pinInput.focus(), 50);
    }
  });
  btnExportar.addEventListener("click", exportarCadastros);
  btnImportar.addEventListener("click", () => fileImport.click());
  fileImport.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (file) await importarCadastros(file);
    fileImport.value = "";
  });
  btnConfigSheets.addEventListener("click", abrirConfigSheets);
  btnCancelarConfig.addEventListener("click", fecharConfigSheets);
  btnTestarConfig.addEventListener("click", testarConfigSheets);
  btnSalvarConfig.addEventListener("click", salvarConfigSheets);

  await atualizarLista();
  loop();
}

window.addEventListener("DOMContentLoaded", main);
