// Painel "Quem está no lab" — mostra sessões com check_out == null.
// Atualiza a cada REFRESH_MS e também a cada evento "presence:changed"
// (disparado por presence.js após cada registro). Sem PIN: é informação
// operacional pública dentro do lab (só nome + duração).

import { Storage } from "./storage.js";

const REFRESH_MS = 30_000;
const LIMITE_AMARELO_MS = 4 * 60 * 60 * 1000;  // 4h
const LIMITE_VERMELHO_MS = 8 * 60 * 60 * 1000; // 8h (alerta antes do limite de 10h)

const lista = document.getElementById("ativos-lista");
const badge = document.getElementById("ativos-badge");

let _timer = null;

async function renderizar() {
  let ativas;
  try {
    ativas = await Storage.sessoesAtivas();
  } catch (e) {
    console.warn("ativos: falha ao ler sessões", e);
    return;
  }

  badge.textContent = String(ativas.length);

  lista.innerHTML = "";
  if (ativas.length === 0) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "Ninguém no lab no momento.";
    lista.appendChild(li);
    return;
  }

  for (const s of ativas) {
    const li = document.createElement("li");
    if (s.duracaoMs >= LIMITE_VERMELHO_MS) li.classList.add("warn-high");
    else if (s.duracaoMs >= LIMITE_AMARELO_MS) li.classList.add("warn-mid");

    const nome = document.createElement("div");
    nome.className = "nome";
    nome.textContent = s.nome;
    if (s.confirmacao === "manual") {
      const tag = document.createElement("span");
      tag.className = "manual-tag";
      tag.textContent = "manual";
      tag.title = "Entrada confirmada manualmente, não pelo reconhecimento facial";
      nome.appendChild(tag);
    }

    const dur = document.createElement("div");
    dur.className = "duracao";
    const horaEntrada = new Date(s.check_in).toTimeString().slice(0, 5);
    dur.textContent = `há ${_formatarDuracao(s.duracaoMs)} · entrou às ${horaEntrada}`;

    li.appendChild(nome);
    li.appendChild(dur);
    lista.appendChild(li);
  }
}

function _formatarDuracao(ms) {
  const totalMin = Math.floor(ms / 60000);
  if (totalMin < 1) return "menos de 1 min";
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

export const ActiveSessions = {
  iniciar() {
    renderizar();
    if (_timer) clearInterval(_timer);
    _timer = setInterval(renderizar, REFRESH_MS);
    window.addEventListener("presence:changed", renderizar);
  },
  atualizar: renderizar,
};
