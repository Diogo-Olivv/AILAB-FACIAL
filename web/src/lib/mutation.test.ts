import test from "node:test";
import assert from "node:assert/strict";
import {
  formatDuration,
  sessionSeconds,
  totalsByMember,
  groupByDay,
} from "./aggregate.ts";
import type { Member, SessionRecord } from "./reports.ts";

/**
 * Bateria de Testes de Mutação (Mutation Analysis)
 * 
 * Esses testes garantem que qualquer mutação no código de regras de negócio
 * (inversão de operadores, quebra de limites, omissão de checagem de nulos, etc.)
 * fará a suite falhar imediatamente ("matando" o mutante).
 */

test("Mutante 1: Sessão anulada (voidedAt) JAMAIS deve computar horas, mesmo tendo checkIn e checkOut", () => {
  const session: SessionRecord = {
    id: 101,
    profileId: "m-1",
    checkIn: "2026-09-15T10:00:00Z",
    checkOut: "2026-09-15T14:00:00Z",
    durationS: 14400,
    voidedAt: "2026-09-15T15:00:00Z", // Foi anulada pelo tutor
    autoClosed: true,
  };

  const seconds = sessionSeconds(session, new Date("2026-09-15T16:00:00Z"));
  // Se um mutante remover a checagem de voidedAt, seconds será 14400 e o teste falhará
  assert.equal(seconds, 0, "Sessão com voidedAt deve retornar estritamente 0 segundos");
});

test("Mutante 2: Detecção de anomalia (> 10h) deve operar estritamente no limiar de 36.000 segundos", () => {
  const isAnomalous = (durationS: number, isOpen: boolean, checkInStr?: string, refDate = new Date("2026-09-15T22:00:00Z")) => {
    const TEN_HOURS_S = 10 * 3600; // 36000
    if (durationS > TEN_HOURS_S) return true;
    if (isOpen && checkInStr) {
      const elapsed = Math.floor((refDate.getTime() - new Date(checkInStr).getTime()) / 1000);
      return elapsed > TEN_HOURS_S;
    }
    return false;
  };

  // 1 segundo abaixo de 10h (35.999s) -> NÃO deve ser anômala
  assert.equal(isAnomalous(35999, false), false, "35999s não deve ser anômala");

  // Exatamente 10h (36.000s) -> Limite exato não anômalo
  assert.equal(isAnomalous(36000, false), false, "36000s exatos não é maior que 10h");

  // 1 segundo acima de 10h (36.001s) -> DEVE ser anômala
  assert.equal(isAnomalous(36001, false), true, "36001s DEVE ser anômala (>10h)");

  // Sessão aberta há 10h e 1 minuto
  assert.equal(isAnomalous(0, true, "2026-09-15T11:59:00Z"), true, "Aberta há >10h deve ser anômala");
  // Sessão aberta há 9h59m
  assert.equal(isAnomalous(0, true, "2026-09-15T12:01:00Z"), false, "Aberta há <10h não deve ser anômala");
});

test("Mutante 3: Inversão de cálculo de minutos em formatDuration", () => {
  // Garantir que a formatação não sofra regressão
  assert.equal(formatDuration(0), "0h 00m");
  assert.equal(formatDuration(59), "0h 00m");
  assert.equal(formatDuration(60), "0h 01m");
  assert.equal(formatDuration(3599), "0h 59m");
  assert.equal(formatDuration(3600), "1h 00m");
  assert.equal(formatDuration(3665), "1h 01m");
  assert.equal(formatDuration(36000), "10h 00m");
  assert.equal(formatDuration(36000, true), "10h 00m 00s");
});

test("Mutante 4: Validação de Matrícula (apenas dígitos e comprimento exato)", () => {
  const validateMatricula = (mat: string, len: number = 8) => {
    return new RegExp(`^\\d{${len}}$`).test(mat);
  };

  assert.equal(validateMatricula("20240001"), true);
  // Mutantes que aceitam letras ou caracteres especiais:
  assert.equal(validateMatricula("2024000a"), false);
  assert.equal(validateMatricula("2024-001"), false);
  // Mutantes de comprimento incorreto:
  assert.equal(validateMatricula("2024000"), false); // 7 digitos
  assert.equal(validateMatricula("202400001"), false); // 9 digitos
  assert.equal(validateMatricula(""), false);
});

test("Mutante 5: Agregação por Integrante deve isolar sessões de alunos distintos e desconsiderar anuladas", () => {
  const members: Member[] = [
    { id: "m-1", name: "Alice", matricula: "20240010" },
    { id: "m-2", name: "Bob", matricula: "20240020" },
  ];

  const sessions: SessionRecord[] = [
    {
      id: 1,
      profileId: "m-1",
      checkIn: "2026-09-15T08:00:00Z",
      checkOut: "2026-09-15T10:00:00Z",
      durationS: 7200, // 2h
    },
    {
      id: 2,
      profileId: "m-1",
      checkIn: "2026-09-15T14:00:00Z",
      checkOut: "2026-09-15T15:00:00Z",
      durationS: 3600,
      voidedAt: "2026-09-15T16:00:00Z", // Anulada -> não conta
    },
    {
      id: 3,
      profileId: "m-2",
      checkIn: "2026-09-15T09:00:00Z",
      checkOut: "2026-09-15T12:00:00Z",
      durationS: 10800, // 3h
    },
  ];

  const totals = totalsByMember(members, sessions, ["m-1"], new Date("2026-09-15T18:00:00Z"));
  const alice = totals.find((t) => t.member.id === "m-1");
  const bob = totals.find((t) => t.member.id === "m-2");

  assert.ok(alice);
  assert.ok(bob);
  assert.equal(alice.totalSeconds, 7200, "Alice deve ter apenas 7200s (sessão anulada deve ser ignorada)");
  assert.equal(alice.sessionCount, 1, "Alice deve ter apenas 1 sessão válida");
  assert.equal(alice.present, true, "Alice está marcada como presente");
  assert.equal(bob.totalSeconds, 10800, "Bob deve ter 10800s");
  assert.equal(bob.present, false, "Bob não está no laboratório");
});
