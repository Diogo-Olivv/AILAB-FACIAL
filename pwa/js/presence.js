// Lógica de registro de presença com intenção declarada pelo usuário
// (ENTRADA ou SAÍDA). A coerência é checada aqui: tentar entrar com sessão
// aberta ou sair sem sessão devolve erro tipado, não um "no-op silencioso".
//
// Não toca em DOM. Único side effect além do IndexedDB é o evento
// "presence:changed" disparado no window, consumido pelo painel de ativos
// pra atualizar na hora.

import { Storage, MAX_SESSAO_MS } from "./storage.js";

const DEBOUNCE_MS = 3_000; // anti-duplo-clique acidental

export class PresenceError extends Error {
  constructor(code, msg) {
    super(msg);
    this.code = code;
  }
}

// Registra presença declarada. `acaoIntent` é "entrada" ou "saida".
// `confirmacao` é "auto" (reconhecimento confirmado pelo usuário) ou
// "manual" (usuário escolheu o nome na fallback).
//
// Retorna { acao, minutos?, abandonadaAnterior? } ou lança PresenceError.
export async function registrarPresenca(nome, { acaoIntent, confirmacao = "auto" }) {
  if (acaoIntent !== "entrada" && acaoIntent !== "saida") {
    throw new PresenceError("intent_invalida", `ação inválida: ${acaoIntent}`);
  }

  const ultimo = await Storage.ultimoEvento(nome);
  if (ultimo && Date.now() - new Date(ultimo).getTime() < DEBOUNCE_MS) {
    throw new PresenceError("debounce", "registro muito recente, aguarde alguns segundos");
  }

  const aberta = await Storage.sessaoAberta(nome);

  if (acaoIntent === "entrada") {
    if (aberta) {
      const inicio = new Date(aberta.check_in).getTime();
      if (Date.now() - inicio > MAX_SESSAO_MS) {
        // Sessão anterior estourou 10h: fecha como abandonada e abre nova.
        await Storage.fecharSessaoAbandonada(aberta.id);
        await Storage.abrirSessao(nome, { confirmacao });
        _emitir();
        return { acao: "entrada_pos_abandono", abandonadaAnterior: true };
      }
      throw new PresenceError("ja_dentro", `${nome} já está com entrada aberta`);
    }
    await Storage.abrirSessao(nome, { confirmacao });
    _emitir();
    return { acao: "entrada" };
  }

  // saida
  if (!aberta) {
    throw new PresenceError("nao_esta_dentro", `${nome} não tem entrada registrada`);
  }
  const r = await Storage.fecharSessao(aberta.id, { confirmacao });
  const minutos = Math.round((new Date(r.check_out) - new Date(r.check_in)) / 60000);
  _emitir();
  return { acao: "saida", minutos };
}

function _emitir() {
  window.dispatchEvent(new CustomEvent("presence:changed"));
}
