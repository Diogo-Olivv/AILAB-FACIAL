// IndexedDB para PWA AILAB. Stores: pessoas, sessoes.
// pessoas: { nome (PK), embedding (number[128]), cadastrado_em (ISO 8601) }
// sessoes: { id (autoInc PK), pessoa, check_in (ISO), check_out (ISO|null), sincronizado (0|1) }

const DB_NAME = "ailab";
const DB_VERSION = 1;

function abrir() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("pessoas")) {
        db.createObjectStore("pessoas", { keyPath: "nome" });
      }
      if (!db.objectStoreNames.contains("sessoes")) {
        const s = db.createObjectStore("sessoes", { keyPath: "id", autoIncrement: true });
        s.createIndex("pessoa", "pessoa", { unique: false });
        s.createIndex("sincronizado", "sincronizado", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function store(name, mode = "readonly") {
  const db = await abrir();
  return db.transaction(name, mode).objectStore(name);
}

export const Storage = {
  async addPessoa(nome, embedding) {
    const s = await store("pessoas", "readwrite");
    s.put({ nome, embedding: Array.from(embedding), cadastrado_em: new Date().toISOString() });
  },

  async listarPessoas() {
    const s = await store("pessoas");
    return new Promise((resolve) => {
      const req = s.getAll();
      req.onsuccess = () => resolve(req.result);
    });
  },

  async removerPessoa(nome) {
    const s = await store("pessoas", "readwrite");
    s.delete(nome);
  },

  async sessaoAberta(pessoa) {
    const s = await store("sessoes");
    const idx = s.index("pessoa");
    return new Promise((resolve) => {
      const req = idx.getAll(pessoa);
      req.onsuccess = () => {
        const abertas = req.result.filter((x) => !x.check_out);
        resolve(abertas[abertas.length - 1] || null);
      };
    });
  },

  async ultimoEvento(pessoa) {
    const s = await store("sessoes");
    const idx = s.index("pessoa");
    return new Promise((resolve) => {
      const req = idx.getAll(pessoa);
      req.onsuccess = () => {
        let mx = null;
        for (const r of req.result) {
          const t = r.check_out || r.check_in;
          if (!mx || t > mx) mx = t;
        }
        resolve(mx);
      };
    });
  },

  async abrirSessao(pessoa) {
    const s = await store("sessoes", "readwrite");
    s.add({ pessoa, check_in: new Date().toISOString(), check_out: null, sincronizado: 0 });
  },

  async fecharSessao(id) {
    const s = await store("sessoes", "readwrite");
    return new Promise((resolve) => {
      const req = s.get(id);
      req.onsuccess = () => {
        const r = req.result;
        r.check_out = new Date().toISOString();
        r.sincronizado = 0;
        s.put(r);
        resolve(r);
      };
    });
  },

  async sessoesNaoSincronizadas() {
    const s = await store("sessoes");
    return new Promise((resolve) => {
      const req = s.getAll();
      req.onsuccess = () =>
        resolve(req.result.filter((x) => x.check_out && !x.sincronizado));
    });
  },

  async marcarSincronizada(id) {
    const s = await store("sessoes", "readwrite");
    const req = s.get(id);
    req.onsuccess = () => {
      const r = req.result;
      r.sincronizado = 1;
      s.put(r);
    };
  },
};
