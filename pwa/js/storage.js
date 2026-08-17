// Camada de dados do kiosk, agora sobre Supabase (antes IndexedDB).
// Mantem a mesma interface que recognize/flow/presence/active-sessions consomem,
// keyed por `nome` (slug snake_case guardado em profiles.name). O mapeamento
// nome -> profile_id (uuid) fica encapsulado aqui.
//
// pessoas  -> profiles + face_embeddings (embedding 128-D, jsonb)
// sessoes  -> sessions (check_in/check_out, confirmacao, abandoned)

import { supabase } from "./db.js";

export const MAX_SESSAO_MS = 10 * 60 * 60 * 1000; // 10h

let _mapaId = new Map(); // nome -> profile_id

function extrairEmbedding(fe) {
  if (!fe) return null;
  const alvo = Array.isArray(fe) ? fe[0] : fe;
  return alvo ? alvo.embedding : null;
}

function agoraISO() {
  return new Date().toISOString();
}

async function profileId(nome) {
  if (_mapaId.has(nome)) return _mapaId.get(nome);
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("name", nome)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  _mapaId.set(nome, data.id);
  return data.id;
}

export const Storage = {
  async addPessoa(nome, matricula, embedding) {
    const { data: perfil, error: e1 } = await supabase
      .from("profiles")
      .upsert(
        {
          name: nome,
          matricula,
          active: true,
          consent_given: true,
          consent_at: agoraISO(),
        },
        { onConflict: "matricula" },
      )
      .select("id")
      .single();
    if (e1) throw e1;

    const { error: e2 } = await supabase.from("face_embeddings").upsert(
      {
        profile_id: perfil.id,
        embedding: Array.from(embedding),
        updated_at: agoraISO(),
      },
      { onConflict: "profile_id" },
    );
    if (e2) throw e2;

    _mapaId.set(nome, perfil.id);
  },

  async listarPessoas() {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, name, matricula, created_at, face_embeddings(embedding)")
      .eq("active", true)
      .order("created_at", { ascending: true });
    if (error) throw error;

    _mapaId = new Map();
    const pessoas = [];
    for (const p of data) {
      _mapaId.set(p.name, p.id);
      const embedding = extrairEmbedding(p.face_embeddings);
      if (!embedding) continue;
      pessoas.push({
        id: p.id,
        nome: p.name,
        matricula: p.matricula || "",
        embedding,
        cadastrado_em: p.created_at,
      });
    }
    return pessoas;
  },

  async removerPessoa(nome) {
    const { error } = await supabase.from("profiles").delete().eq("name", nome);
    if (error) throw error;
    _mapaId.delete(nome);
  },

  async importarPessoas(arr, { sobrescrever = false } = {}) {
    const { data: existentes, error } = await supabase
      .from("profiles")
      .select("id, name");
    if (error) throw error;
    const idPorNome = new Map(existentes.map((p) => [p.name, p.id]));

    const stats = { adicionadas: 0, sobrescritas: 0, ignoradas: 0, invalidas: 0 };
    for (const p of arr) {
      const valido =
        p &&
        typeof p.nome === "string" &&
        /^[a-z0-9_]+$/.test(p.nome) &&
        Array.isArray(p.embedding) &&
        p.embedding.length === 128 &&
        p.embedding.every((x) => typeof x === "number" && Number.isFinite(x));
      if (!valido) {
        stats.invalidas++;
        continue;
      }

      const idExistente = idPorNome.get(p.nome);
      if (idExistente && !sobrescrever) {
        stats.ignoradas++;
        continue;
      }

      try {
        if (idExistente) {
          await this._salvarEmbedding(idExistente, p.embedding);
          stats.sobrescritas++;
        } else {
          const { data: novo, error: eIns } = await supabase
            .from("profiles")
            .insert({
              name: p.nome,
              matricula: p.matricula || null,
              active: true,
              consent_given: true,
              consent_at: p.cadastrado_em || agoraISO(),
            })
            .select("id")
            .single();
          if (eIns) throw eIns;
          await this._salvarEmbedding(novo.id, p.embedding);
          stats.adicionadas++;
        }
      } catch {
        stats.invalidas++;
      }
    }
    return stats;
  },

  async _salvarEmbedding(profile_id, embedding) {
    const { error } = await supabase
      .from("face_embeddings")
      .upsert({ profile_id, embedding: Array.from(embedding), updated_at: agoraISO() }, { onConflict: "profile_id" });
    if (error) throw error;
  },

  async sessaoAberta(nome) {
    const id = await profileId(nome);
    if (!id) return null;
    const { data, error } = await supabase
      .from("sessions")
      .select("id, check_in, check_out, confirmacao, abandoned")
      .eq("profile_id", id)
      .is("check_out", null)
      .order("check_in", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  },

  async ultimoEvento(nome) {
    const id = await profileId(nome);
    if (!id) return null;
    const { data, error } = await supabase.rpc("last_event_time", { p_profile_id: id });
    if (error) throw error;
    return data || null;
  },

  async abrirSessao(nome, { confirmacao = "auto" } = {}) {
    const id = await profileId(nome);
    if (!id) throw new Error(`pessoa nao encontrada: ${nome}`);
    const { error } = await supabase
      .from("sessions")
      .insert({ profile_id: id, confirmacao });
    if (error) throw error;
  },

  async fecharSessao(id, { confirmacao = "auto" } = {}) {
    const { data, error } = await supabase
      .from("sessions")
      .update({ check_out: agoraISO(), confirmacao, abandoned: false })
      .eq("id", id)
      .select("check_in, check_out")
      .single();
    if (error) throw error;
    return data;
  },

  async fecharSessaoAbandonada(id) {
    const { data: sessao, error: e1 } = await supabase
      .from("sessions")
      .select("check_in")
      .eq("id", id)
      .single();
    if (e1) throw e1;
    const fim = new Date(new Date(sessao.check_in).getTime() + MAX_SESSAO_MS).toISOString();
    const { data, error: e2 } = await supabase
      .from("sessions")
      .update({ check_out: fim, abandoned: true })
      .eq("id", id)
      .select("check_in, check_out")
      .single();
    if (e2) throw e2;
    return data;
  },

  async varrerSessoesExpiradas() {
    const { data, error } = await supabase
      .from("sessions")
      .select("id, check_in")
      .is("check_out", null);
    if (error) throw error;

    const agora = Date.now();
    const fechadas = [];
    for (const s of data) {
      if (agora - new Date(s.check_in).getTime() < MAX_SESSAO_MS) continue;
      fechadas.push(await this.fecharSessaoAbandonada(s.id));
    }
    return fechadas;
  },

  async sessoesAtivas() {
    const { data, error } = await supabase
      .from("sessions")
      .select("id, check_in, confirmacao, profiles(name, matricula)")
      .is("check_out", null)
      .order("check_in", { ascending: true });
    if (error) throw error;

    const agora = Date.now();
    return data.map((s) => {
      const perfil = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles;
      return {
        id: s.id,
        nome: perfil ? perfil.name : "?",
        matricula: perfil ? perfil.matricula || "" : "",
        check_in: s.check_in,
        duracaoMs: agora - new Date(s.check_in).getTime(),
        confirmacao: s.confirmacao || "auto",
      };
    });
  },
};
