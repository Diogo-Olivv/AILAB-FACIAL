export const State = {
  // 'idle' | 'recognizing' | 'enrolling'
  // idle = preview ligado, nenhuma inferência rodando.
  // recognizing = capturando 1 frame e fazendo match (curtíssima duração).
  // enrolling = modal de cadastro aberto, capturando N fotos.
  modo: "idle",
  setModo(m) {
    this.modo = m;
  }
};
