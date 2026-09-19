import test from "node:test";
import assert from "node:assert/strict";
import {
  formatDuration,
  sessionSeconds,
  totalsByMember,
  groupByDay,
  type MemberTotal,
} from "./aggregate.ts";
import { rangeFor } from "./period.ts";
import type { Member, SessionRecord } from "./reports.ts";

/**
 * FASE 3: TESTES BASEADOS EM PROPRIEDADES (PROPERTY-BASED TESTING)
 * 
 * Em vez de exemplos pontuais estáticos, geramos centenas de combinações aleatórias
 * com casos de borda extremos (fuzzing determinístico) para provar matematicamente
 * os invariantes de preservação de estado, não-negatividade e ordenação.
 */

// Gerador Linear Congruente determinístico para reprodutibilidade estrita
function pseudoRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

test("Propriedade 1: Invariante de Não-Negatividade Universal (totalSeconds >= 0)", () => {
  const rand = pseudoRandom(1337);
  const now = new Date("2026-09-15T18:00:00Z");

  for (let iter = 0; iter < 200; iter++) {
    // Gera durações aleatórias, incluindo nulas, negativas ou com datas no futuro
    const duration = rand() > 0.3 ? Math.floor(rand() * 86400) : null;
    const isClosed = rand() > 0.4;
    const isVoided = rand() > 0.7;

    // CheckIn pode ser no passado ou no futuro (simulando clock skew)
    const checkInOffset = (rand() - 0.5) * 200000; // segundos em relação a now
    const checkIn = new Date(now.getTime() - checkInOffset * 1000).toISOString();
    const checkOut = isClosed
      ? new Date(new Date(checkIn).getTime() + Math.floor(rand() * 40000) * 1000).toISOString()
      : null;

    const session: SessionRecord = {
      id: iter,
      profileId: "m-rand",
      checkIn,
      checkOut,
      durationS: duration,
      voidedAt: isVoided ? new Date().toISOString() : null,
    };

    const seconds = sessionSeconds(session, now);
    assert.ok(
      seconds >= 0,
      `Iteração ${iter}: sessionSeconds nunca pode ser negativo. Recebeu ${seconds}`
    );
  }
});

test("Propriedade 2: Invariante de Exclusão Absoluta de Sessões Anuladas (voidedAt)", () => {
  const rand = pseudoRandom(42);
  const members: Member[] = [
    { id: "m-1", name: "Alice", matricula: "20240001" },
    { id: "m-2", name: "Bob", matricula: "20240002" },
  ];
  const now = new Date("2026-09-15T18:00:00Z");

  for (let iter = 0; iter < 100; iter++) {
    // Cria sessões válidas
    const validCount = Math.floor(rand() * 5) + 1;
    const sessions: SessionRecord[] = [];
    let expectedAliceSeconds = 0;

    for (let i = 0; i < validCount; i++) {
      const dur = Math.floor(rand() * 7200) + 60;
      sessions.push({
        id: i,
        profileId: "m-1",
        checkIn: "2026-09-15T08:00:00Z",
        checkOut: "2026-09-15T10:00:00Z",
        durationS: dur,
      });
      expectedAliceSeconds += dur;
    }

    // Injeta sessões anuladas com tempos gigantescos (até 500 horas)
    const voidCount = Math.floor(rand() * 10) + 1;
    for (let j = 0; j < voidCount; j++) {
      sessions.push({
        id: 1000 + j,
        profileId: "m-1",
        checkIn: "2026-09-15T00:00:00Z",
        checkOut: "2026-09-15T23:00:00Z",
        durationS: 1800000, // 500 horas
        voidedAt: "2026-09-15T12:00:00Z",
      });
    }

    const totals = totalsByMember(members, sessions, [], now);
    const alice = totals.find((t) => t.member.id === "m-1");

    assert.ok(alice);
    assert.equal(
      alice.totalSeconds,
      expectedAliceSeconds,
      `Iteração ${iter}: As ${voidCount} sessões anuladas NÃO devem alterar os segundos válidos de Alice`
    );
    assert.equal(
      alice.sessionCount,
      validCount,
      `Iteração ${iter}: As sessões anuladas NÃO devem contar como presenças válidas`
    );
  }
});

test("Propriedade 3: Invariante Monótono do Leaderboard (ordenado decrescentemente)", () => {
  const rand = pseudoRandom(999);
  const now = new Date("2026-09-15T18:00:00Z");

  for (let iter = 0; iter < 100; iter++) {
    const memberCount = Math.floor(rand() * 15) + 2; // entre 2 e 17 alunos
    const members: Member[] = [];
    const sessions: SessionRecord[] = [];

    for (let m = 0; m < memberCount; m++) {
      const id = `m-${m}`;
      members.push({ id, name: `Aluno ${m}`, matricula: `2024000${m}` });

      const numSessions = Math.floor(rand() * 6);
      for (let s = 0; s < numSessions; s++) {
        sessions.push({
          id: m * 100 + s,
          profileId: id,
          checkIn: "2026-09-15T08:00:00Z",
          checkOut: "2026-09-15T10:00:00Z",
          durationS: Math.floor(rand() * 14400),
        });
      }
    }

    const totals = totalsByMember(members, sessions, [], now);

    // Propriedade universal: Para todo i, totals[i].totalSeconds >= totals[i+1].totalSeconds
    for (let i = 0; i < totals.length - 1; i++) {
      assert.ok(
        totals[i].totalSeconds >= totals[i + 1].totalSeconds,
        `Iteração ${iter}: Ranking quebrado na posição ${i} (${totals[i].totalSeconds} < ${totals[i + 1].totalSeconds})`
      );
    }
  }
});

test("Propriedade 4: Invariante de Simetria de Período Customizado (range.from <= range.to)", () => {
  const rand = pseudoRandom(555);

  for (let iter = 0; iter < 100; iter++) {
    // Gera duas datas aleatórias no ano de 2026
    const dayA = (Math.floor(rand() * 28) + 1).toString().padStart(2, "0");
    const dayB = (Math.floor(rand() * 28) + 1).toString().padStart(2, "0");
    const monthA = (Math.floor(rand() * 12) + 1).toString().padStart(2, "0");
    const monthB = (Math.floor(rand() * 12) + 1).toString().padStart(2, "0");

    const dateStr1 = `2026-${monthA}-${dayA}`;
    const dateStr2 = `2026-${monthB}-${dayB}`;

    const range = rangeFor("custom", dateStr1, dateStr2);

    assert.ok(
      range.from.getTime() <= range.to.getTime(),
      `Iteração ${iter}: from (${range.from.toISOString()}) deve ser <= to (${range.to.toISOString()}) para inputs ${dateStr1} e ${dateStr2}`
    );
  }
});

test("Propriedade 5: Invariante de Conservação de Sessões no Histórico Diário", () => {
  const rand = pseudoRandom(777);
  const now = new Date("2026-09-15T18:00:00Z");

  for (let iter = 0; iter < 50; iter++) {
    const member: Member = { id: "m-1", name: "Lucas", matricula: "20240099" };
    const sessionCount = Math.floor(rand() * 10) + 1;
    const sessions: SessionRecord[] = [];
    let expectedValidSeconds = 0;

    for (let s = 0; s < sessionCount; s++) {
      const dur = Math.floor(rand() * 7200) + 100;
      const isVoid = rand() > 0.5;
      sessions.push({
        id: s,
        profileId: "m-1",
        checkIn: `2026-09-${(s % 20 + 1).toString().padStart(2, "0")}T08:00:00Z`,
        checkOut: `2026-09-${(s % 20 + 1).toString().padStart(2, "0")}T10:00:00Z`,
        durationS: dur,
        voidedAt: isVoid ? "2026-09-15T10:00:00Z" : null,
      });

      if (!isVoid) {
        expectedValidSeconds += dur;
      }
    }

    const days = groupByDay([member], sessions, now);
    const dayTotalSeconds = days.reduce((sum, d) => sum + d.totalSeconds, 0);

    assert.equal(
      dayTotalSeconds,
      expectedValidSeconds,
      `Iteração ${iter}: A soma dos dias (${dayTotalSeconds}) deve ser idêntica à soma de sessões válidas (${expectedValidSeconds})`
    );
  }
});
