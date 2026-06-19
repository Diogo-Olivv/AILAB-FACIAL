import { Storage, MAX_SESSAO_MS } from "./storage.js";
import { getSheetsConfig, setSheetsConfig, testarSheetsConfig, sincronizar } from "./sheets-sync.js";
import { UI } from "./ui.js";
import { Camera } from "./camera.js";
import { State } from "./state.js";
import "./heartbeat.js";

const THRESHOLD = 0.55;
const DEBOUNCE_MS = 60_000;
const FRAME_INTERVAL_MS = 500;
const N_FOTOS = 8;
const DELAY_ENTRE_FOTOS_MS = 700;
const DETECTOR_INPUT_SIZE_RECONHECER = 320;
const DETECTOR_INPUT_SIZE_ENROLL = 320;
const MAX_TENTATIVAS_SEM_ROSTO = 20;
const ADMIN_PIN = "1234";

const nomeInput = document.getElementById("nome");
const matriculaInput = document.getElementById("matricula");
const lgpdConsent = document.getElementById("lgpd-consent");
const btnCapturar = document.getElementById("btn-capturar");
const enrollPanel = document.getElementById("enroll-panel");
const gerenciarPanel = document.getElementById("gerenciar-panel");
const pinPanel = document.getElementById("pin-panel");
const pinInput = document.getElementById("pin-input");
const pinStatus = document.getElementById("pin-status");
const listaEl = document.getElementById("lista");
const fileImport = document.getElementById("file-import");

const configPanel = document.getElementById("config-panel");
const cfgWebhook = document.getElementById("cfg-webhook");
const cfgToken = document.getElementById("cfg-token");
const cfgStatus = document.getElementById("cfg-status");
const btnTestarConfig = document.getElementById("btn-testar-config");

let modelsLoaded = true;

async function hashSHA256(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function registrarPresenca(nome) {
  const ultimo = await Storage.ultimoEvento(nome);
  if (ultimo && Date.now() - new Date(ultimo).getTime() < DEBOUNCE_MS) return null;

  const aberta = await Storage.sessaoAberta(nome);
  if (aberta) {
    const inicio = new Date(aberta.check_in).getTime();
    if (Date.now() - inicio > MAX_SESSAO_MS) {
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

async function loop() {
  if (State.modo !== "recognizing") {
    setTimeout(loop, FRAME_INTERVAL_MS);
    return;
  }

  const pessoas = await Storage.listarPessoas();
  if (pessoas.length === 0) {
    UI.setStatus("Nenhuma pessoa cadastrada. Clique em + Cadastrar.", "warn");
    Camera.limpar();
    setTimeout(loop, 2000);
    return;
  }

  if (!modelsLoaded) {
    setTimeout(loop, FRAME_INTERVAL_MS);
    return;
  }

  const t0 = Date.now();
  try {
    const tensor = faceapi.tf.browser.fromPixels(Camera.video);
    const det = await faceapi
      .detectSingleFace(tensor, new faceapi.TinyFaceDetectorOptions({ inputSize: DETECTOR_INPUT_SIZE_RECONHECER }))
      .withFaceLandmarks()
      .withFaceDescriptor();
    tensor.dispose();

    if (!det) {
      UI.setStatus("Aguardando rosto…");
      Camera.limpar();
    } else {
      let melhor = { nome: null, dist: Infinity };
      for (const p of pessoas) {
        const dist = faceapi.euclideanDistance(det.descriptor, p.embedding);
        if (dist < melhor.dist) melhor = { nome: p.nome, dist: dist };
      }

      if (melhor.dist < THRESHOLD) {
        Camera.desenharBox(det.detection.box, melhor.nome, true);
        const reg = await registrarPresenca(melhor.nome);
        if (reg?.acao === "entrada") {
          UI.setStatus(`Entrada de ${melhor.nome} registrada.`, "ok");
          UI.mostrarToast(`Olá, ${melhor.nome}!`, "Entrada registrada");
        } else if (reg?.acao === "saida") {
          UI.setStatus(`Saída de ${melhor.nome} registrada.`, "ok");
          UI.mostrarToast(`Até mais, ${melhor.nome}!`, `Saída registrada · ${UI.formatarMinutos(reg.minutos)}`);
        } else if (reg?.acao === "entrada_pos_abandono") {
          UI.setStatus(`Sessão anterior expirou. Nova entrada de ${melhor.nome}.`, "warn");
          UI.mostrarToast(`Olá, ${melhor.nome}!`, "Sessão anterior > 10h foi encerrada", "warn");
        } else {
          UI.setStatus(`${melhor.nome} já registrado há pouco…`);
        }
      } else {
        Camera.desenharBox(det.detection.box, null, false);
        UI.setStatus(`Rosto não reconhecido (dist ${melhor.dist.toFixed(2)})`, "warn");
      }
    }
  } catch (e) {
    console.error(e);
    UI.setStatus("Erro: " + e.message, "warn");
  }

  const dt = Date.now() - t0;
  setTimeout(loop, Math.max(0, FRAME_INTERVAL_MS - dt));
}

// Enroll
function abrirEnroll() {
  State.setModo("enrolling");
  nomeInput.value = "";
  if (matriculaInput) matriculaInput.value = "";
  lgpdConsent.checked = false;
  UI.setEnrollStatus("Digite o nome e clique Capturar.");
  btnCapturar.disabled = false;
  enrollPanel.classList.add("active");
  setTimeout(() => nomeInput.focus(), 50);
}

function fecharEnroll() {
  enrollPanel.classList.remove("active");
  State.setModo("recognizing");
  Camera.limpar();
}

async function fluxoCadastro() {
  if (!lgpdConsent.checked) {
    UI.setEnrollStatus("Você deve aceitar o Termo de Consentimento LGPD.", "warn");
    return;
  }
  const nome = nomeInput.value.trim().toLowerCase().replace(/\s+/g, "_");
  if (!/^[a-z0-9_]+$/.test(nome)) {
    UI.setEnrollStatus("Nome inválido. Use letras/dígitos/underscore.", "warn");
    return;
  }
  const matricula = matriculaInput ? matriculaInput.value.trim() : "";
  if (!matricula) {
    UI.setEnrollStatus("Matrícula é obrigatória.", "warn");
    return;
  }
  btnCapturar.disabled = true;

  const descritores = [];
  let tentativasSemRosto = 0;

  try {
    for (let i = 1; i <= N_FOTOS; i++) {
      UI.setEnrollStatus(`Foto ${i}/${N_FOTOS} — olhe para a câmera`);
      await new Promise((r) => setTimeout(r, DELAY_ENTRE_FOTOS_MS));
      
      try {
        const tensor = faceapi.tf.browser.fromPixels(Camera.video);
        const det = await faceapi
          .detectSingleFace(tensor, new faceapi.TinyFaceDetectorOptions({ inputSize: DETECTOR_INPUT_SIZE_ENROLL }))
          .withFaceLandmarks()
          .withFaceDescriptor();
        tensor.dispose();
        
        const desc = det ? Array.from(det.descriptor) : null;

        if (!desc) {
          tentativasSemRosto++;
          if (tentativasSemRosto >= MAX_TENTATIVAS_SEM_ROSTO) {
            UI.setEnrollStatus(`Cancelado: falha prolongada ao detectar rosto.`, "warn");
            return;
          }
          UI.setEnrollStatus(`Tentando… (Aproxime ou ilumine melhor o rosto)`, "warn");
          await new Promise((r) => setTimeout(r, 1000));
          i--;
          continue;
        }
        descritores.push(desc);
      } catch (err) {
        UI.setEnrollStatus(`Erro do faceapi: ${err.message}`, "warn");
        return;
      }
    }

    const dim = descritores[0].length;
    const media = new Float32Array(dim);
    for (const d of descritores) for (let i = 0; i < dim; i++) media[i] += d[i];
    for (let i = 0; i < dim; i++) media[i] /= descritores.length;

    await Storage.addPessoa(nome, matricula, media);
    await atualizarLista();
    UI.mostrarToast(`${nome} cadastrado`, `${N_FOTOS} fotos capturadas`);
    fecharEnroll();
  } finally {
    btnCapturar.disabled = false;
  }
}

// Lista
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
    const mat = p.matricula ? ` (${p.matricula})` : "";
    span.textContent = `${p.nome}${mat} · ${p.cadastrado_em.slice(0, 10)}`;
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
const EXPORT_FORMAT_VERSION = 1;

async function exportarCadastros() {
  const pessoas = await Storage.listarPessoas();
  if (pessoas.length === 0) {
    UI.mostrarToast("Nada para exportar", "Nenhum cadastro encontrado", "warn");
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
  UI.mostrarToast(
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
    UI.mostrarToast("Arquivo inválido", "JSON malformado", "warn");
    return;
  }
  if (!payload || !Array.isArray(payload.pessoas)) {
    UI.mostrarToast("Formato não reconhecido", "Esperado: { pessoas: [...] }", "warn");
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
  UI.mostrarToast("Importação concluída", partes.join(" · ") || "sem mudanças");
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
  UI.mostrarToast("Configuração salva", webhook && token ? "Sincronização ativa" : "Sincronização desabilitada (campos vazios)");
  fecharConfigSheets();
  if (webhook && token) sincronizar();
}

// Config e Setup
async function carregarModelos() {
  await faceapi.nets.tinyFaceDetector.loadFromUri("models");
  await faceapi.nets.faceLandmark68Net.loadFromUri("models");
  await faceapi.nets.faceRecognitionNet.loadFromUri("models");
}

async function main() {
  if (!navigator.mediaDevices?.getUserMedia) {
    UI.setStatus("Câmera não suportada neste navegador", "warn");
    return;
  }
  
  UI.setStatus("Carregando modelos de IA...");
  await carregarModelos();
  await Camera.abrir();
  UI.setStatus("Pronto. Aguardando rosto…");

  if (navigator.storage?.persist) {
    navigator.storage.persist().catch(() => {});
  }

  try {
    const fechadas = await Storage.varrerSessoesExpiradas();
    if (fechadas.length) {
      UI.mostrarToast(`${fechadas.length} sessão(ões) expiradas fechadas`, "Saídas n/a", "warn");
    }
  } catch (e) {
    console.warn(e);
  }

  document.getElementById("btn-abrir-enroll").addEventListener("click", abrirEnroll);
  document.getElementById("btn-cancelar-enroll").addEventListener("click", fecharEnroll);
  btnCapturar.addEventListener("click", fluxoCadastro);

  document.getElementById("btn-cancelar-pin").addEventListener("click", () => {
    pinPanel.classList.remove("active");
  });
  
  document.getElementById("btn-confirmar-pin").addEventListener("click", async () => {
    const pin = pinInput.value.trim();
    if (!pin) {
      pinStatus.textContent = "Digite um PIN.";
      return;
    }
    const hash = await hashSHA256(pin);
    const savedHash = localStorage.getItem("admin_pin_hash");

    if (!savedHash) {
      // Setup no primeiro acesso
      localStorage.setItem("admin_pin_hash", hash);
      pinPanel.classList.remove("active");
      gerenciarPanel.classList.add("active");
      await atualizarLista();
      UI.mostrarToast("Novo PIN configurado", "Este dispositivo está protegido");
    } else {
      // Validação
      if (hash === savedHash) {
        pinPanel.classList.remove("active");
        gerenciarPanel.classList.add("active");
        await atualizarLista();
      } else {
        pinStatus.textContent = "PIN incorreto.";
      }
    }
  });

  document.getElementById("btn-gerenciar").addEventListener("click", () => {
    if (gerenciarPanel.classList.contains("active")) {
      gerenciarPanel.classList.remove("active");
    } else {
      pinInput.value = "";
      pinStatus.textContent = "";
      
      const savedHash = localStorage.getItem("admin_pin_hash");
      const titleEl = document.getElementById("pin-titulo");
      if (titleEl) {
        titleEl.textContent = savedHash ? "Acesso Administrativo" : "Criar PIN de Admin";
      }
      pinInput.placeholder = savedHash ? "Digite o PIN" : "Crie um novo PIN numérico";
      
      pinPanel.classList.add("active");
      setTimeout(() => pinInput.focus(), 50);
    }
  });

  // Exportar / Importar
  document.getElementById("btn-exportar").addEventListener("click", exportarCadastros);
  document.getElementById("btn-importar").addEventListener("click", () => fileImport.click());
  fileImport.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (file) await importarCadastros(file);
    fileImport.value = "";
  });

  // Config Sheets
  document.getElementById("btn-config-sheets").addEventListener("click", abrirConfigSheets);
  document.getElementById("btn-cancelar-config").addEventListener("click", fecharConfigSheets);
  btnTestarConfig.addEventListener("click", testarConfigSheets);
  document.getElementById("btn-salvar-config").addEventListener("click", salvarConfigSheets);

  await atualizarLista();
  loop();
}

window.addEventListener("DOMContentLoaded", main);
