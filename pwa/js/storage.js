// IndexedDB para PWA AILAB. Stores: pessoas, sessoes.
// pessoas: { nome (PK), embedding (number[128]), cadastrado_em (ISO 8601) }
// sessoes: { id (autoInc PK), pessoa, check_in (ISO), check_out (ISO|null),
//            abandonada (0|1), sincronizado (0|1) }
//
// abandonada = sessão fechada automaticamente por exceder MAX_SESSAO_MS sem saída.
// Quando abandonada=1, a sincronização envia saida/horas como "n/a".

const DB_NAME = "ailab";
const DB_VERSION = 2;

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
        // Migração v1 → v2: default abandonada=0 nas sessões antigas.
        const s = tx.objectStore("sessoes");
        s.openCursor().onsuccess = (ev) => {
          const cur = ev.target.result;
          if (!cur) return;
          if (cur.value.abandonada === undefined) {
            const v = cur.value;
            v.abandonada = 0;
            cur.update(v);
          }
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
  async addPessoa(nome, embedding) {
    return runTx("pessoas", "readwrite", (s) => {
      s.put({
        nome,
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

  async abrirSessao(pessoa) {
    return runTx("sessoes", "readwrite", (s) => {
      s.add({
        pessoa,
        check_in: new Date().toISOString(),
        check_out: null,
        abandonada: 0,
        sincronizado: 0,
      });
    });
  },

  async fecharSessao(id) {
    return runTx("sessoes", "readwrite", async (s) => {
      const r = await reqAsPromise(s.get(id));
      if (!r) throw new Error(`sessão ${id} não encontrada`);
      r.check_out = new Date().toISOString();
      r.abandonada = 0;
      r.sincronizado = 0;
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
};
