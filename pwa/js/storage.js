// IndexedDB para PWA AILAB. Stores: pessoas, sessoes.
// pessoas: { nome (PK), matricula, embedding (number[128]), cadastrado_em (ISO 8601) }
// sessoes: { id (autoInc PK), pessoa, check_in (ISO), check_out (ISO|null),
//            abandonada (0|1), sincronizado (0|1),
//            confirmacao ("auto" | "manual") }
//
// abandonada = sessão fechada automaticamente por exceder MAX_SESSAO_MS sem saída.
// Quando abandonada=1, a sincronização envia saida/horas como "n/a".
// confirmacao = "auto" quando o reconhecimento facial bateu e o usuário confirmou
//   ("Sim, sou eu"); "manual" quando o usuário escolheu o nome correto na fallback.

const DB_NAME = "ailab";
const DB_VERSION = 3;

export const MAX_SESSAO_MS = 10 * 60 * 60 * 1000; // 10h

let _dbPromise = null;

function getDb() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      const tx = e.target.transaction;
      if (!db.objectStoreNames.contains("pessoas")) {
        db.createObjectStore("pessoas", { keyPath: "nome" });
      }
      if (!db.objectStoreNames.contains("sessoes")) {
        const s = db.createObjectStore("sessoes", { keyPath: "id", autoIncrement: true });
        s.createIndex("pessoa", "pessoa", { unique: false });
        s.createIndex("sincronizado", "sincronizado", { unique: false });
      } else {
        // Migrações: garante campos novos em sessões antigas (default seguro).
        const s = tx.objectStore("sessoes");
        s.openCursor().onsuccess = (ev) => {
          const cur = ev.target.result;
          if (!cur) return;
          const v = cur.value;
          let mudou = false;
          if (v.abandonada === undefined) { v.abandonada = 0; mudou = true; }
          if (v.confirmacao === undefined) { v.confirmacao = "auto"; mudou = true; }
          if (mudou) cur.update(v);
          cur.continue();
        };
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      _dbPromise = null;
      reject(req.error);
    };
  });
  return _dbPromise;
}

function reqAsPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function runTx(storeName, mode, fn) {
  const db = await getDb();
  const tx = db.transaction(storeName, mode);
  const store = tx.objectStore(storeName);
  const fnResult = Promise.resolve().then(() => fn(store));
  const txDone = new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("transação abortada"));
  });
  const [value] = await Promise.all([fnResult, txDone]);
  return value;
}

export const Storage = {
  async addPessoa(nome, matricula, embedding) {
    return runTx("pessoas", "readwrite", (s) => {
      s.put({
        nome,
        matricula,
        embedding: Array.from(embedding),
        cadastrado_em: new Date().toISOString(),
      });
    });
  },

  async listarPessoas() {
    return runTx("pessoas", "readonly", (s) => reqAsPromise(s.getAll()));
  },

  async removerPessoa(nome) {
    return runTx("pessoas", "readwrite", (s) => {
      s.delete(nome);
    });
  },

  // Importa um array de {nome, embedding, cadastrado_em}.
  // Retorna { adicionadas, sobrescritas, ignoradas, invalidas }.
  async importarPessoas(arr, { sobrescrever = false } = {}) {
    const existentes = new Set(
      (await this.listarPessoas()).map((p) => p.nome),
    );
    return runTx("pessoas", "readwrite", (s) => {
      const stats = { adicionadas: 0, sobrescritas: 0, ignoradas: 0, invalidas: 0 };
      for (const p of arr) {
        const ok =
          p &&
          typeof p.nome === "string" &&
          /^[a-z0-9_]+$/.test(p.nome) &&
          Array.isArray(p.embedding) &&
          p.embedding.length === 128 &&
          p.embedding.every((x) => typeof x === "number" && Number.isFinite(x));
        if (!ok) {
          stats.invalidas++;
          continue;
        }
        const jaExiste = existentes.has(p.nome);
        if (jaExiste && !sobrescrever) {
          stats.ignoradas++;
          continue;
        }
        s.put({
          nome: p.nome,
          embedding: p.embedding,
          cadastrado_em: p.cadastrado_em || new Date().toISOString(),
        });
        if (jaExiste) stats.sobrescritas++;
        else stats.adicionadas++;
      }
      return stats;
    });
  },

  async sessaoAberta(pessoa) {
    return runTx("sessoes", "readonly", async (s) => {
      const todas = await reqAsPromise(s.index("pessoa").getAll(pessoa));
      const abertas = todas.filter((x) => !x.check_out);
      return abertas[abertas.length - 1] || null;
    });
  },

  async ultimoEvento(pessoa) {
    return runTx("sessoes", "readonly", async (s) => {
      const todas = await reqAsPromise(s.index("pessoa").getAll(pessoa));
      let mx = null;
      for (const r of todas) {
        const t = r.check_out || r.check_in;
        if (!mx || t > mx) mx = t;
      }
      return mx;
    });
  },

  async abrirSessao(pessoa, { confirmacao = "auto" } = {}) {
    return runTx("sessoes", "readwrite", (s) => {
      s.add({
        pessoa,
        check_in: new Date().toISOString(),
        check_out: null,
        abandonada: 0,
        sincronizado: 0,
        confirmacao,
      });
    });
  },

  async fecharSessao(id, { confirmacao = "auto" } = {}) {
    return runTx("sessoes", "readwrite", async (s) => {
      const r = await reqAsPromise(s.get(id));
      if (!r) throw new Error(`sessão ${id} não encontrada`);
      r.check_out = new Date().toISOString();
      r.abandonada = 0;
      r.sincronizado = 0;
      // Sobrescreve com a confirmação do fechamento (entrada pode ter sido auto e saída manual ou vice-versa).
      r.confirmacao = confirmacao;
      s.put(r);
      return r;
    });
  },

  // Fecha uma sessão como abandonada: check_out fictício = check_in + MAX_SESSAO_MS.
  // Usado quando ultrapassou o limite de 10h sem registro de saída.
  async fecharSessaoAbandonada(id) {
    return runTx("sessoes", "readwrite", async (s) => {
      const r = await reqAsPromise(s.get(id));
      if (!r) throw new Error(`sessão ${id} não encontrada`);
      const ci = new Date(r.check_in).getTime();
      r.check_out = new Date(ci + MAX_SESSAO_MS).toISOString();
      r.abandonada = 1;
      r.sincronizado = 0;
      s.put(r);
      return r;
    });
  },

  // Sweep no boot: fecha todas as sessões abertas há mais que MAX_SESSAO_MS.
  // Retorna a lista de sessões fechadas (para feedback / log).
  async varrerSessoesExpiradas() {
    return runTx("sessoes", "readwrite", async (s) => {
      const todas = await reqAsPromise(s.getAll());
      const agora = Date.now();
      const fechadas = [];
      for (const r of todas) {
        if (r.check_out) continue;
        const ci = new Date(r.check_in).getTime();
        if (agora - ci < MAX_SESSAO_MS) continue;
        r.check_out = new Date(ci + MAX_SESSAO_MS).toISOString();
        r.abandonada = 1;
        r.sincronizado = 0;
        s.put(r);
        fechadas.push(r);
      }
      return fechadas;
    });
  },

  async sessoesNaoSincronizadas() {
    return runTx("sessoes", "readonly", async (s) => {
      const todas = await reqAsPromise(s.getAll());
      return todas.filter((x) => x.check_out && !x.sincronizado);
    });
  },

  async marcarSincronizada(id) {
    return runTx("sessoes", "readwrite", async (s) => {
      const r = await reqAsPromise(s.get(id));
      if (!r) return;
      r.sincronizado = 1;
      s.put(r);
    });
  },

  // Sessões com check_out == null. Enriquece com matrícula e duração até agora.
  // Ordenado por check_in crescente (quem chegou primeiro aparece primeiro).
  async sessoesAtivas() {
    const pessoas = await this.listarPessoas();
    const mapa = new Map(pessoas.map((p) => [p.nome, p]));
    return runTx("sessoes", "readonly", async (s) => {
      const todas = await reqAsPromise(s.getAll());
      const agora = Date.now();
      const abertas = todas
        .filter((r) => !r.check_out)
        .map((r) => {
          const pessoa = mapa.get(r.pessoa);
          return {
            id: r.id,
            nome: r.pessoa,
            matricula: pessoa ? pessoa.matricula || "" : "",
            check_in: r.check_in,
            duracaoMs: agora - new Date(r.check_in).getTime(),
            confirmacao: r.confirmacao || "auto",
          };
        });
      abertas.sort((a, b) => a.check_in.localeCompare(b.check_in));
      return abertas;
    });
  },
};
