import test from "node:test";
import assert from "node:assert/strict";
import {
  combineDateTime,
  validateManualSession,
  overlaps,
  type ManualSessionInput,
} from "./manualSession.ts";
import type { SessionRecord } from "./reports.ts";

/**
 * Testes da lógica pura do registro manual de presença (contingência de papel).
 * Segue o estilo mutation dos testes existentes: exercita limiares exatos e
 * inversões de comparação para "matar" mutantes.
 */

const valid: ManualSessionInput = {
  profileId: "m-1",
  date: "2026-09-15",
  entryTime: "14:00",
  exitTime: "16:00",
};
const FIXED_NOW = new Date("2026-09-18T12:00:00Z");

test("validate: entrada válida e anterior à saída é aceita", () => {
  assert.deepEqual(validateManualSession(valid, FIXED_NOW), { ok: true });
});

test("validate: exige seleção de integrante", () => {
  const r = validateManualSession({ ...valid, profileId: "" }, FIXED_NOW);
  assert.equal(r.ok, false);
});

test("validate: exige data e horas preenchidas", () => {
  assert.equal(validateManualSession({ ...valid, date: "" }, FIXED_NOW).ok, false);
  assert.equal(validateManualSession({ ...valid, entryTime: "" }, FIXED_NOW).ok, false);
  assert.equal(validateManualSession({ ...valid, exitTime: "" }, FIXED_NOW).ok, false);
});

test("validate: entrada IGUAL à saída deve falhar (limiar estrito, mata mutante <=)", () => {
  const r = validateManualSession({ ...valid, entryTime: "15:00", exitTime: "15:00" }, FIXED_NOW);
  assert.equal(r.ok, false, "entrada == saída não pode ser aceita");
});

test("validate: entrada posterior à saída deve falhar", () => {
  const r = validateManualSession({ ...valid, entryTime: "16:00", exitTime: "14:00" }, FIXED_NOW);
  assert.equal(r.ok, false);
});

test("validate: data/horário no futuro deve falhar", () => {
  const future = validateManualSession(
    { ...valid, date: "2026-09-20", entryTime: "10:00", exitTime: "12:00" },
    FIXED_NOW
  );
  assert.equal(future.ok, false, "não pode registrar presença futura");
});

test("combineDateTime: diferença entre horas independe do fuso (2h = 7200000ms)", () => {
  const entry = combineDateTime("2026-09-15", "14:00");
  const exit = combineDateTime("2026-09-15", "16:00");
  assert.equal(new Date(exit).getTime() - new Date(entry).getTime(), 2 * 3600 * 1000);
  // Se um mutante trocar a ordem dos argumentos, o ISO conteria a data errada
  assert.ok(entry.startsWith("2026-09-1"), "ISO deve preservar a data informada");
});

test("overlaps: sessões apenas encostadas (fim == início) NÃO se sobrepõem", () => {
  const existing: SessionRecord[] = [
    { profileId: "m-1", checkIn: "2026-09-15T12:00:00Z", checkOut: "2026-09-15T14:00:00Z", durationS: 7200 },
  ];
  const candidate = { checkIn: "2026-09-15T14:00:00Z", checkOut: "2026-09-15T16:00:00Z" };
  assert.equal(overlaps(candidate, existing), false);
});

test("overlaps: sobreposição parcial é detectada", () => {
  const existing: SessionRecord[] = [
    { profileId: "m-1", checkIn: "2026-09-15T13:00:00Z", checkOut: "2026-09-15T15:00:00Z", durationS: 7200 },
  ];
  const candidate = { checkIn: "2026-09-15T14:00:00Z", checkOut: "2026-09-15T16:00:00Z" };
  assert.equal(overlaps(candidate, existing), true);
});

test("overlaps: sessão anulada (voidedAt) é ignorada", () => {
  const existing: SessionRecord[] = [
    {
      profileId: "m-1",
      checkIn: "2026-09-15T13:00:00Z",
      checkOut: "2026-09-15T17:00:00Z",
      durationS: null,
      voidedAt: "2026-09-15T18:00:00Z",
    },
  ];
  const candidate = { checkIn: "2026-09-15T14:00:00Z", checkOut: "2026-09-15T16:00:00Z" };
  assert.equal(overlaps(candidate, existing), false, "sessão anulada não deve conflitar");
});

test("overlaps: sessão aberta (checkOut nulo) conta como em andamento", () => {
  const existing: SessionRecord[] = [
    { profileId: "m-1", checkIn: "2026-09-15T13:00:00Z", checkOut: null, durationS: null },
  ];
  const candidate = { checkIn: "2026-09-15T15:00:00Z", checkOut: "2026-09-15T16:00:00Z" };
  assert.equal(overlaps(candidate, existing), true, "candidato após início de sessão aberta deve conflitar");
});
