import { Storage } from "./storage.js";
import { getSheetsConfig, setSheetsConfig, testarSheetsConfig, sincronizar } from "./sheets-sync.js";
import { UI } from "./ui.js";
import { Camera } from "./camera.js";
import { State } from "./state.js";
import { Flow } from "./flow.js";
import { ActiveSessions } from "./active-sessions.js";
import "./heartbeat.js";

const N_FOTOS = 8;
const DELAY_ENTRE_FOTOS_MS = 700;
const DETECTOR_INPUT_SIZE_ENROLL = 320;
const MAX_TENTATIVAS_SEM_ROSTO = 20;

const nomeInput = document.getElementById("nome");
const matriculaInput = document.getElementById("matricula");
const lgpdConsent = document.getElementById("lgpd-consent");
const btnCapturar = document.getElementById("btn-capturar");
const enrollInline = document.getElementById("enroll-inline");
const acaoBar = document.getElementById("acao-bar");
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

const btnEntrada = document.getElementById("btn-entrada");
const btnSaida = document.getElementById("btn-saida");

async function hashSHA256(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Enroll inline: troca acao-bar pelo formulário, mantendo a câmera visível
// pra o usuário centralizar o rosto enquanto digita e durante a captura.
function abrirEnroll() {
  State.setModo("enrolling");
  nomeInput.value = "";
  if (matriculaInput) matriculaInput.value = "";
  lgpdConsent.checked = false;
  UI.setEnrollStatus("Centralize o rosto na câmera, preencha os campos e clique Capturar.");
  btnCapturar.disabled = false;
  acaoBar.hidden = true;
  enrollInline.hidden = false;
  setTimeout(() => nomeInput.focus(), 50);
}

function fecharEnroll() {
  enrollInline.hidden = true;
  acaoBar.hidden = false;
  State.setModo("idle");
  Camera.limpar();
  UI.setStatus("Pronto. Escolha uma ação.");
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
  UI.setStatus("Pronto. Escolha uma ação.");

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

  // Habilita botões de ação só depois dos modelos carregados.
  btnEntrada.disabled = false;
  btnSaida.disabled = false;
  btnEntrada.addEventListener("click", () => Flow.iniciarFluxo("entrada"));
  btnSaida.addEventListener("click", () => Flow.iniciarFluxo("saida"));

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
      localStorage.setItem("admin_pin_hash", hash);
      pinPanel.classList.remove("active");
      gerenciarPanel.classList.add("active");
      await atualizarLista();
      UI.mostrarToast("Novo PIN configurado", "Este dispositivo está protegido");
    } else {
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

  // Painel de ativos: monta e mantém em sincronia.
  ActiveSessions.iniciar();
}

window.addEventListener("DOMContentLoaded", main);
