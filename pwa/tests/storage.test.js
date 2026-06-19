import { Storage, MAX_SESSAO_MS } from '../js/storage.js';

if (!globalThis.structuredClone) {
  globalThis.structuredClone = val => JSON.parse(JSON.stringify(val));
}

describe('Storage - State Machine de Presenças', () => {
  test('abrirSessao e sessaoAberta devem funcionar', async () => {
    await Storage.addPessoa('joao', '123', new Float32Array(128));
    await Storage.abrirSessao('joao');
    
    const aberta = await Storage.sessaoAberta('joao');
    expect(aberta).not.toBeNull();
    expect(aberta.pessoa).toBe('joao');
    expect(aberta.check_out).toBeNull();
    expect(aberta.abandonada).toBe(0);
  });

  test('fecharSessao deve registrar o check_out', async () => {
    await Storage.abrirSessao('maria');
    let aberta = await Storage.sessaoAberta('maria');
    
    const fechada = await Storage.fecharSessao(aberta.id);
    expect(fechada.check_out).not.toBeNull();
    
    aberta = await Storage.sessaoAberta('maria');
    expect(aberta).toBeNull(); // Nenhuma sessão aberta agora
  });

  test('fecharSessaoAbandonada deve definir abandonada = 1 e check_out futuro', async () => {
    await Storage.abrirSessao('pedro');
    const aberta = await Storage.sessaoAberta('pedro');
    
    const abandonada = await Storage.fecharSessaoAbandonada(aberta.id);
    expect(abandonada.abandonada).toBe(1);
    
    const ci = new Date(abandonada.check_in).getTime();
    const co = new Date(abandonada.check_out).getTime();
    expect(co - ci).toBe(MAX_SESSAO_MS);
  });

  test('varrerSessoesExpiradas deve fechar sessoes abertas ha mais de MAX_SESSAO_MS', async () => {
    await Storage.abrirSessao('lucas');
    
    // Forçar check_in no passado (> 10h)
    const db = await indexedDB.databases(); // Just to make sure it's open, but we need raw access
    // Como hack, vamos alterar a sessão via Storage adicionando um helper ou diretamente na db?
    // Storage module doesn't expose raw update. Let's do it via indexedDB API.
    const dbPromise = new Promise((resolve) => {
      const req = indexedDB.open("ailab", 2);
      req.onsuccess = () => resolve(req.result);
    });
    const rawDb = await dbPromise;
    
    const aberta = await Storage.sessaoAberta('lucas');
    
    await new Promise((resolve) => {
      const tx = rawDb.transaction('sessoes', 'readwrite');
      const store = tx.objectStore('sessoes');
      const pastDate = new Date(Date.now() - (MAX_SESSAO_MS + 1000)).toISOString();
      aberta.check_in = pastDate;
      store.put(aberta);
      tx.oncomplete = resolve;
    });

    const fechadas = await Storage.varrerSessoesExpiradas();
    expect(fechadas.length).toBe(1);
    expect(fechadas[0].pessoa).toBe('lucas');
    expect(fechadas[0].abandonada).toBe(1);
  });
});
