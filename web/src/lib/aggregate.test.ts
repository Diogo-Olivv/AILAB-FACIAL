import test from "node:test";
import assert from "node:assert/strict";
import {
  formatDuration,
  sessionSeconds,
  totalsByMember,
  groupByDay,
  isWeekday,
  filterWeekdaySessions,
  calculateTutorInsights,
} from "./aggregate.ts";
import type { Member, SessionRecord } from "./reports.ts";

test("formatDuration formata segundos em formato legível de horas e minutos", () => {
  assert.strictEqual(formatDuration(0), "0h 00m");
  assert.strictEqual(formatDuration(59), "0h 00m");
  assert.strictEqual(formatDuration(60), "0h 01m");
  assert.strictEqual(formatDuration(3600), "1h 00m");
  assert.strictEqual(formatDuration(3665), "1h 01m");
  assert.strictEqual(formatDuration(7325), "2h 02m");
});

test("sessionSeconds: sessões anuladas (voidedAt) computam rigorosamente 0 segundos", () => {
  const now = new Date("2026-09-13T12:00:00Z");

  // Sessão abandonada e encerrada pelo sweep de meia-noite (voided_at preenchido)
  const voidedSession: SessionRecord = {
    profileId: "aluno-1",
    checkIn: "2026-09-10T08:00:00Z",
    checkOut: "2026-09-11T00:00:00Z", // 16h decorridas no relógio
    durationS: null, // Postgres gerou NULL por causa do voided_at
    voidedAt: "2026-09-11T00:00:00Z",
  };

  const seconds = sessionSeconds(voidedSession, now);
  assert.strictEqual(
    seconds,
    0,
    "Sessão anulada por abandono DEVE computar exatamente 0 segundos (Invariante INV-04)",
  );
});

test("sessionSeconds: sessões válidas fechadas retornam durationS ou diferença de tempo", () => {
  const now = new Date("2026-09-13T12:00:00Z");

  const closedWithDuration: SessionRecord = {
    profileId: "aluno-2",
    checkIn: "2026-09-13T08:00:00Z",
    checkOut: "2026-09-13T10:00:00Z",
    durationS: 7200,
    voidedAt: null,
  };
  assert.strictEqual(sessionSeconds(closedWithDuration, now), 7200);

  const closedWithoutDuration: SessionRecord = {
    profileId: "aluno-2",
    checkIn: "2026-09-13T08:00:00Z",
    checkOut: "2026-09-13T09:30:00Z",
    durationS: null,
    voidedAt: null,
  };
  assert.strictEqual(sessionSeconds(closedWithoutDuration, now), 5400);
});

test("totalsByMember: ignora sessões anuladas no somatório e na contagem de presenças", () => {
  const members: Member[] = [
    { id: "aluno-1", name: "Alice Souza", matricula: "1001" },
    { id: "aluno-2", name: "Bruno Silva", matricula: "1002" },
  ];

  const sessions: SessionRecord[] = [
    // Alice: 1 sessão válida de 2 horas (7200s)
    {
      profileId: "aluno-1",
      checkIn: "2026-09-13T08:00:00Z",
      checkOut: "2026-09-13T10:00:00Z",
      durationS: 7200,
      voidedAt: null,
    },
    // Alice: 1 sessão anulada (esqueceu saída)
    {
      profileId: "aluno-1",
      checkIn: "2026-09-12T08:00:00Z",
      checkOut: "2026-09-13T00:00:00Z",
      durationS: null,
      voidedAt: "2026-09-13T00:00:00Z",
    },
    // Bruno: 1 sessão válida de 1 hora (3600s)
    {
      profileId: "aluno-2",
      checkIn: "2026-09-13T14:00:00Z",
      checkOut: "2026-09-13T15:00:00Z",
      durationS: 3600,
      voidedAt: null,
    },
  ];

  const presentIds = ["aluno-1"];
  const now = new Date("2026-09-13T18:00:00Z");

  const totals = totalsByMember(members, sessions, presentIds, now);

  assert.strictEqual(totals.length, 2);

  // Ordenação decrescente por totalSeconds
  assert.strictEqual(totals[0].member.id, "aluno-1");
  assert.strictEqual(totals[0].totalSeconds, 7200);
  assert.strictEqual(totals[0].sessionCount, 1, "Sessão anulada NÃO deve incrementar sessionCount");
  assert.strictEqual(totals[0].present, true);

  assert.strictEqual(totals[1].member.id, "aluno-2");
  assert.strictEqual(totals[1].totalSeconds, 3600);
  assert.strictEqual(totals[1].sessionCount, 1);
  assert.strictEqual(totals[1].present, false);
});

test("groupByDay: rotula sessões anuladas com voided=true e 0 segundos", () => {
  const members: Member[] = [
    { id: "aluno-1", name: "Alice Souza", matricula: "1001" },
  ];

  const sessions: SessionRecord[] = [
    {
      profileId: "aluno-1",
      checkIn: "2026-09-13T09:00:00Z",
      checkOut: "2026-09-14T00:00:00Z",
      durationS: null,
      voidedAt: "2026-09-14T00:00:00Z",
    },
  ];

  const groups = groupByDay(members, sessions, new Date("2026-09-14T12:00:00Z"));
  assert.strictEqual(groups.length, 1);
  assert.strictEqual(groups[0].entries.length, 1);

  const entry = groups[0].entries[0];
  assert.strictEqual(entry.voided, true);
  assert.strictEqual(entry.seconds, 0);
  assert.strictEqual(entry.open, false);
});

test("isWeekday: identifica corretamente dias úteis (Seg-Sex) e descarta finais de semana (Sáb-Dom)", () => {
  // 2026-09-14 é Segunda-feira
  assert.strictEqual(isWeekday(new Date("2026-09-14T12:00:00")), true, "Segunda deve ser dia útil");
  // 2026-09-15 é Terça-feira
  assert.strictEqual(isWeekday(new Date("2026-09-15T12:00:00")), true, "Terça deve ser dia útil");
  // 2026-09-16 é Quarta-feira
  assert.strictEqual(isWeekday(new Date("2026-09-16T12:00:00")), true, "Quarta deve ser dia útil");
  // 2026-09-17 é Quinta-feira
  assert.strictEqual(isWeekday(new Date("2026-09-17T12:00:00")), true, "Quinta deve ser dia útil");
  // 2026-09-18 é Sexta-feira
  assert.strictEqual(isWeekday(new Date("2026-09-18T12:00:00")), true, "Sexta deve ser dia útil");
  // 2026-09-19 é Sábado
  assert.strictEqual(isWeekday(new Date("2026-09-19T12:00:00")), false, "Sábado NÃO deve ser dia útil");
  // 2026-09-20 é Domingo
  assert.strictEqual(isWeekday(new Date("2026-09-20T12:00:00")), false, "Domingo NÃO deve ser dia útil");

  // Suporte a string ISO
  assert.strictEqual(isWeekday("2026-09-14T10:00:00Z"), true);
  assert.strictEqual(isWeekday("2026-09-19T10:00:00Z"), false);
});

test("filterWeekdaySessions: filtra estritamente sessões ocorridas em dias úteis", () => {
  const sessions: SessionRecord[] = [
    {
      profileId: "aluno-1",
      checkIn: "2026-09-14T09:00:00", // Seg
      checkOut: "2026-09-14T11:00:00",
      durationS: 7200,
    },
    {
      profileId: "aluno-1",
      checkIn: "2026-09-19T10:00:00", // Sáb
      checkOut: "2026-09-19T12:00:00",
      durationS: 7200,
    },
    {
      profileId: "aluno-2",
      checkIn: "2026-09-20T14:00:00", // Dom
      checkOut: "2026-09-20T16:00:00",
      durationS: 7200,
    },
  ];

  const filtered = filterWeekdaySessions(sessions);
  assert.strictEqual(filtered.length, 1);
  assert.strictEqual(filtered[0].checkIn, "2026-09-14T09:00:00");
});

test("calculateTutorInsights: calcula retenção, média diária, turnos e alunos em risco", () => {
  const members: Member[] = [
    { id: "aluno-1", name: "Alice Souza", matricula: "1001" },
    { id: "aluno-2", name: "Bruno Silva", matricula: "1002" },
    { id: "aluno-3", name: "Carlos Dias", matricula: "1003" },
  ];

  const sessions: SessionRecord[] = [
    // Alice: 5 horas na Terça de manhã (18000s) -> cumpriu meta (>4h)
    {
      profileId: "aluno-1",
      checkIn: "2026-09-15T08:00:00",
      checkOut: "2026-09-15T13:00:00",
      durationS: 18000,
    },
    // Bruno: 2 horas na Quarta à tarde (7200s) -> abaixo da meta (<4h)
    {
      profileId: "aluno-2",
      checkIn: "2026-09-16T14:00:00",
      checkOut: "2026-09-16T16:00:00",
      durationS: 7200,
    },
    // Sessão no sábado (deve ser ignorada pelo cálculo)
    {
      profileId: "aluno-3",
      checkIn: "2026-09-19T10:00:00",
      checkOut: "2026-09-19T12:00:00",
      durationS: 7200,
    },
  ];

  const now = new Date("2026-09-18T18:00:00");
  const insights = calculateTutorInsights(members, sessions, now);

  assert.strictEqual(insights.totalMembersCount, 3);
  assert.strictEqual(insights.activeMembersCount, 2, "Carlos só tem presença no sábado, logo ativo=2");
  assert.strictEqual(insights.retentionRate, 67, "2/3 membros ativos = 67%");
  assert.strictEqual(insights.totalWeekdaySessions, 2);
  assert.strictEqual(insights.totalWeekdaySeconds, 18000 + 7200);

  // Alunos em risco: Carlos (0h, critical) e Bruno (2h, warning)
  assert.strictEqual(insights.studentsAtRisk.length, 2);
  const carlos = insights.studentsAtRisk.find((s) => s.member.id === "aluno-3");
  assert.ok(carlos);
  assert.strictEqual(carlos?.status, "critical");
  assert.strictEqual(carlos?.totalSeconds, 0);

  const bruno = insights.studentsAtRisk.find((s) => s.member.id === "aluno-2");
  assert.ok(bruno);
  assert.strictEqual(bruno?.status, "warning");
  assert.strictEqual(bruno?.totalSeconds, 7200);
  assert.strictEqual(bruno?.deficitSeconds, 14400 - 7200);

  // Turno de pico (Alice teve 18000s de manhã vs Bruno 7200s à tarde)
  assert.strictEqual(insights.shifts.peakShift, "Manhã");
});

