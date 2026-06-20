// Orquestrador da UX de entrada/saída: usuário declara intenção (botão),
// reconhecemos um frame, confirmamos a identidade com ele, registramos.
//
// Estados implícitos (gerenciados aqui mesmo, sem máquina formal — o fluxo
// é linear: capture → confirm → registrar OU select → registrar):
//   idle → capturing → confirming → (registrando | manual_select → registrando) → idle
//
// Acessa o DOM dos modais por id; a chamada externa é só `iniciarFluxo(acao)`.

import { Storage } from "./storage.js";
import { reconhecerUmaVez } from "./recognize.js";
import { registrarPresenca, PresenceError } from "./presence.js";
import { Camera } from "./camera.js";
import { UI } from "./ui.js";
import { State } from "./state.js";

const CONFIRM_TIMEOUT_MS = 30_000;
const COOLDOWN_MS = 3_000;

// Sincronização leve (anti-reentrada).
let _ocupado = false;
let _cooldownAte = 0;

const confirmPanel = document.getElementById("confirm-panel");
const confirmAcao = document.getElementById("confirm-acao");
const confirmNome = document.getElementById("confirm-nome");
const confirmMatricula = document.getElementById("confirm-matricula");
const confirmInfo = document.getElementById("confirm-info");
const btnConfirmSim = document.getElementById("btn-confirm-sim");
const btnConfirmNao = document.getElementById("btn-confirm-nao");

const selectPanel = document.getElementById("select-panel");
const selectAcao = document.getElementById("select-acao");
const selectBusca = document.getElementById("select-busca");
const selectLista = document.getElementById("select-lista");
const btnSelectCancelar = document.getElementById("btn-select-cancelar");

const btnEntrada = document.getElementById("btn-entrada");
const btnSaida = document.getElementById("btn-saida");

export function podeAcionar() {
  return !_ocupado && Date.now() >= _cooldownAte;
}

export async function iniciarFluxo(acaoIntent) {
  if (!podeAcionar()) return;
  _ocupado = true;
  _setBotoes(true);
  try {
    await _fluxo(acaoIntent);
  } finally {
    _ocupado = false;
    _cooldownAte = Date.now() + COOLDOWN_MS;
    // Botões permanecem desabilitados durante o cooldown.
    setTimeout(() => _setBotoes(false), COOLDOWN_MS);
  }
}

async function _fluxo(acaoIntent) {
  const pessoas = await Storage.listarPessoas();
  if (pessoas.length === 0) {
    UI.mostrarToast("Nenhuma pessoa cadastrada", "Clique em + Cadastrar", "warn");
    return;
  }

  UI.setStatus("Olhe para a câmera…");
  State.setModo("recognizing");

  const r = await reconhecerUmaVez(pessoas);

  if (!r.box) {
    Camera.limpar();
    UI.setStatus("Nenhum rosto detectado. Tente de novo.", "warn");
    State.setModo("idle");
    return;
  }

  Camera.desenharBox(r.box, r.melhor.nome, true);

  // Mostra confirmação com o melhor candidato — mesmo se a distância passou
  // do limiar baixo, o usuário decide. Reduz dependência do threshold ríspido.
  const pessoaMelhor = pessoas.find((p) => p.nome === r.melhor.nome);
  const confirmado = await _confirmarComUsuario({
    acaoIntent,
    nome: r.melhor.nome,
    matricula: pessoaMelhor?.matricula || "",
    distancia: r.melhor.dist,
  });

  if (confirmado === "sim") {
    await _registrar(r.melhor.nome, { acaoIntent, confirmacao: "auto" });
  } else if (confirmado === "nao") {
    const escolhido = await _escolherManualmente({ acaoIntent, top3: r.top3, pessoas });
    if (escolhido) {
      await _registrar(escolhido, { acaoIntent, confirmacao: "manual" });
    } else {
      UI.setStatus("Registro cancelado.", "warn");
    }
  } else {
    UI.setStatus("Confirmação expirou. Tente de novo.", "warn");
  }

  Camera.limpar();
  State.setModo("idle");
}

async function _registrar(nome, opts) {
  try {
    const reg = await registrarPresenca(nome, opts);
    _toastResultado(nome, reg);
    UI.setStatus(`${opts.acaoIntent === "entrada" ? "Entrada" : "Saída"} de ${nome} registrada.`, "ok");
  } catch (e) {
    if (e instanceof PresenceError) {
      const msg = _msgErroPresenca(e, nome);
      UI.mostrarToast("Não foi possível registrar", msg, "warn");
      UI.setStatus(msg, "warn");
    } else {
      console.error(e);
      UI.mostrarToast("Erro inesperado", e.message, "warn");
    }
  }
}

function _msgErroPresenca(e, nome) {
  switch (e.code) {
    case "ja_dentro": return `${nome} já tem entrada aberta. Use SAÍDA.`;
    case "nao_esta_dentro": return `${nome} não tem entrada registrada. Use ENTRADA.`;
    case "debounce": return "Registro recente demais, aguarde alguns segundos.";
    default: return e.message;
  }
}

function _toastResultado(nome, reg) {
  if (reg.acao === "entrada") {
    UI.mostrarToast(`Olá, ${nome}!`, "Entrada registrada");
  } else if (reg.acao === "saida") {
    UI.mostrarToast(`Até mais, ${nome}!`, `Saída registrada · ${UI.formatarMinutos(reg.minutos)}`);
  } else if (reg.acao === "entrada_pos_abandono") {
    UI.mostrarToast(`Olá, ${nome}!`, "Sessão anterior > 10h foi encerrada", "warn");
  }
}

// === Modal de confirmação ===

function _confirmarComUsuario({ acaoIntent, nome, matricula, distancia }) {
  return new Promise((resolve) => {
    confirmNome.textContent = nome;
    confirmMatricula.textContent = matricula ? `Matrícula: ${matricula}` : "";
    confirmAcao.textContent = `— ${acaoIntent.toUpperCase()} —`;
    confirmAcao.className = `confirm-acao ${acaoIntent}`;
    confirmInfo.textContent = distancia != null
      ? `Confiança: ${_rotuloConfianca(distancia)} (dist ${distancia.toFixed(2)})`
      : "";
    confirmPanel.classList.add("active");

    let timer;
    const limpar = (resultado) => {
      clearTimeout(timer);
      confirmPanel.classList.remove("active");
      btnConfirmSim.onclick = null;
      btnConfirmNao.onclick = null;
      resolve(resultado);
    };
    btnConfirmSim.onclick = () => limpar("sim");
    btnConfirmNao.onclick = () => limpar("nao");
    timer = setTimeout(() => limpar("timeout"), CONFIRM_TIMEOUT_MS);
  });
}

function _rotuloConfianca(d) {
  if (d < 0.45) return "alta";
  if (d < 0.55) return "média";
  return "baixa";
}

// === Modal de seleção manual ===

function _escolherManualmente({ acaoIntent, top3, pessoas }) {
  return new Promise((resolve) => {
    selectAcao.textContent = `— ${acaoIntent.toUpperCase()} —`;
    selectAcao.className = `confirm-acao ${acaoIntent}`;
    selectBusca.value = "";
    const topNames = new Set(top3.map((c) => c.nome));
    const dadosOrdenados = [
      ...top3.map((c) => pessoas.find((p) => p.nome === c.nome)).filter(Boolean),
      ...pessoas
        .filter((p) => !topNames.has(p.nome))
        .sort((a, b) => a.nome.localeCompare(b.nome)),
    ];

    const render = (filtro) => {
      selectLista.innerHTML = "";
      const f = filtro.trim().toLowerCase();
      const visiveis = dadosOrdenados.filter((p) =>
        !f || p.nome.includes(f) || (p.matricula || "").toLowerCase().includes(f),
      );
      if (visiveis.length === 0) {
        const li = document.createElement("li");
        li.className = "empty";
        li.textContent = "Nenhum cadastrado encontrado.";
        selectLista.appendChild(li);
        return;
      }
      for (const p of visiveis) {
        const li = document.createElement("li");
        if (topNames.has(p.nome) && !f) li.classList.add("sugestao");
        const span = document.createElement("span");
        span.innerHTML = `${p.nome}${p.matricula ? `<span class="matricula-tag">${p.matricula}</span>` : ""}`;
        li.appendChild(span);
        li.onclick = () => limpar(p.nome);
        selectLista.appendChild(li);
      }
    };

    render("");
    selectBusca.oninput = (e) => render(e.target.value);
    selectPanel.classList.add("active");
    setTimeout(() => selectBusca.focus(), 50);

    const limpar = (resultado) => {
      selectPanel.classList.remove("active");
      selectBusca.oninput = null;
      btnSelectCancelar.onclick = null;
      resolve(resultado);
    };
    btnSelectCancelar.onclick = () => limpar(null);
  });
}

function _setBotoes(desabilitado) {
  if (btnEntrada) btnEntrada.disabled = desabilitado;
  if (btnSaida) btnSaida.disabled = desabilitado;
}

export const Flow = { iniciarFluxo, podeAcionar, _setBotoes };
