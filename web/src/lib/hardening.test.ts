import { test } from "node:test";
import assert from "node:assert/strict";

import { classifyCrowd, calculateOccupancyInsights, calculateTutorInsights } from "./aggregate.ts";
import { WEEKLY_TARGET_SECONDS } from "./attendanceTarget.ts";
import { escapeCsvField } from "./csv.ts";

// ── Lotação: sem capacidade real não há classificação ─────────────────────────

test("lotação: sem capacidade configurada o nível é Indefinido, qualquer que seja a contagem", () => {
  for (const capacity of [null, undefined, 0, -5, Number.NaN]) {
    for (const present of [0, 3, 8, 50]) {
      assert.equal(classifyCrowd(present, capacity as number | null), "Indefinido");
    }
  }
});

test("lotação: níveis derivam da fração da capacidade configurada", () => {
  assert.equal(classifyCrowd(0, 20), "Tranquilo");
  assert.equal(classifyCrowd(6, 20), "Tranquilo"); // 30%
  assert.equal(classifyCrowd(7, 20), "Moderado"); // 35%
  assert.equal(classifyCrowd(13, 20), "Moderado"); // 65%
  assert.equal(classifyCrowd(14, 20), "Movimentado"); // 70%
  // A mesma contagem muda de nível conforme a capacidade real.
  assert.equal(classifyCrowd(14, 100), "Tranquilo");
});

test("lotação: calculateOccupancyInsights não inventa nível quando a capacidade é omitida", () => {
  const insights = calculateOccupancyInsights([], 12, new Date("2026-11-10T15:00:00-03:00"));
  assert.equal(insights.currentCrowdLevel, "Indefinido");
});

// ── Meta semanal: uma única definição ─────────────────────────────────────────

test("meta: calculateTutorInsights usa a constante única da meta semanal", () => {
  const member = { id: "m1", name: "Ana", matricula: "1", avatarUrl: null, isTutor: false };
  const base = {
    id: "s1",
    profileId: "m1",
    checkIn: "2026-11-09T12:00:00.000Z", // segunda-feira
    autoClosed: false,
    voidedAt: null,
  };
  const now = new Date("2026-11-10T12:00:00.000Z");

  const below = calculateTutorInsights(
    [member],
    [{ ...base, checkOut: "2026-11-09T13:00:00.000Z", durationS: WEEKLY_TARGET_SECONDS - 1 }] as never,
    now
  );
  assert.equal(below.studentsAtRisk.length, 1);
  assert.equal(below.studentsAtRisk[0].deficitSeconds, 1);

  const exact = calculateTutorInsights(
    [member],
    [{ ...base, checkOut: "2026-11-09T16:00:00.000Z", durationS: WEEKLY_TARGET_SECONDS }] as never,
    now
  );
  assert.equal(exact.studentsAtRisk.length, 0);
});

// ── CSV: neutralização de fórmulas ────────────────────────────────────────────

test("csv: campos textuais que começam com = + - @ são neutralizados", () => {
  assert.equal(escapeCsvField("=HYPERLINK(\"http://x\")"), "\"'=HYPERLINK(\"\"http://x\"\")\"");
  assert.equal(escapeCsvField("+55 61 9999"), "'+55 61 9999");
  assert.equal(escapeCsvField("-cmd"), "'-cmd");
  assert.equal(escapeCsvField("@SUM(A1)"), "'@SUM(A1)");
  assert.equal(escapeCsvField("\tinicio"), "'\tinicio");
});

test("csv: texto comum e aspas continuam corretos", () => {
  assert.equal(escapeCsvField("Maria Silva"), "Maria Silva");
  assert.equal(escapeCsvField("Silva, Maria"), "\"Silva, Maria\"");
  assert.equal(escapeCsvField("O \"Zé\""), "\"O \"\"Zé\"\"\"");
  assert.equal(escapeCsvField("232038442"), "232038442");
  // Hífen no meio do nome não é fórmula.
  assert.equal(escapeCsvField("Ana-Clara"), "Ana-Clara");
});
