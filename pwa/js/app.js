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

const worker = new Worker("js/worker.js?v=" + Date.now());
let modelsLoaded = false;

worker.onmessage = (e) => {
  if (e.data.type === 'models_loaded') {
    modelsLoaded = true;
    UI.setStatus("Pronto. Aguardando rosto…");
  } else if (e.data.type === 'models_error') {
    UI.setStatus(`Erro ao carregar modelos no Worker: ${e.data.error}`, "warn");
  }
};

function dispatchToWorker(type, data) {
  return new Promise((resolve, reject) => {
    const handler = (e) => {
      if (e.data.type === `${type}_result`) {
        worker.removeEventListener('message', handler);
        resolve(e.data);
      } else if (e.data.type === `${type}_error`) {
        worker.removeEventListener('message', handler);
        reject(new Error(e.data.error));
      }
    };
    worker.addEventListener('message', handler);
    worker.postMessage({ type, ...data });
  });
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
    const frameData = Camera.getFrameData();
    const resultMsg = await dispatchToWorker('recognize', {
      imageData: frameData,
      pessoas,
      threshold: THRESHOLD,
      inputSize: DETECTOR_INPUT_SIZE_RECONHECER
    });

    if (!resultMsg.result) {
      UI.setStatus("Aguardando rosto…");
      Camera.limpar();
    } else {
      const { box, melhor } = resultMsg.result;
      if (melhor.dist < THRESHOLD) {
        Camera.desenharBox(box, melhor.nome, true);
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
        Camera.desenharBox(box, null, false);
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
        const res = await dispatchToWorker('enroll', {
          imageData: Camera.getFrameData(),
          inputSize: DETECTOR_INPUT_SIZE_ENROLL
        });
        const desc = res.descriptor;

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
        UI.setEnrollStatus(`Erro do worker: ${err.message}`, "warn");
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

// Config e Setup
async function main() {
  if (!navigator.mediaDevices?.getUserMedia) {
    UI.setStatus("Câmera não suportada neste navegador", "warn");
    return;
  }
  UI.setStatus("Carregando modelos no WebWorker...");
  await Camera.abrir();

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
    if (pinInput.value === ADMIN_PIN) {
      pinPanel.classList.remove("active");
      gerenciarPanel.classList.add("active");
      await atualizarLista();
    } else {
      pinStatus.textContent = "PIN incorreto.";
    }
  });

  document.getElementById("btn-gerenciar").addEventListener("click", () => {
    if (gerenciarPanel.classList.contains("active")) {
      gerenciarPanel.classList.remove("active");
    } else {
      pinInput.value = "";
      pinStatus.textContent = "";
      pinPanel.classList.add("active");
      setTimeout(() => pinInput.focus(), 50);
    }
  });

  await atualizarLista();
  loop();
}

window.addEventListener("DOMContentLoaded", main);
