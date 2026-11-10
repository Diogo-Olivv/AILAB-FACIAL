import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getMondayOfWeek,
  getSundayOfWeek,
  getWeekBoundaries,
  isFutureWeek,
  isCurrentWeek,
} from "./tz.ts";
import {
  computeWeeklyCompliance,
  type AttendanceJustification,
  WEEKLY_TARGET_SECONDS,
} from "./compliance.ts";

describe("Timezone e Limites de Semana Civil (America/Sao_Paulo)", () => {
  it("determina a segunda-feira como início da semana civil", () => {
    // Quarta-feira, 11 de novembro de 2026
    const wednesday = new Date("2026-11-11T14:30:00Z");
    const monday = getMondayOfWeek(wednesday);
    assert.equal(monday, "2026-11-09");
  });

  it("determina que domingo pertence à semana civil que se encerra nele", () => {
    // Domingo, 15 de novembro de 2026
    const sunday = new Date("2026-11-15T20:00:00Z");
    const monday = getMondayOfWeek(sunday);
    assert.equal(monday, "2026-11-09");
    const endSunday = getSundayOfWeek("2026-11-09");
    assert.equal(endSunday, "2026-11-15");
  });

  it("calcula intervalos e rótulos de semana civil corretamente", () => {
    const d = new Date("2026-11-10T12:00:00Z");
    const bounds = getWeekBoundaries(d);
    assert.equal(bounds.periodStart, "2026-11-09");
    assert.equal(bounds.periodEnd, "2026-11-15");
    assert.match(bounds.label, /09\/11 a 15\/11\/2026/);
  });

  it("distingue semanas atuais, passadas e futuras", () => {
    const now = new Date("2026-11-10T12:00:00Z");
    assert.equal(isCurrentWeek("2026-11-09", now), true);
    assert.equal(isFutureWeek("2026-11-09", now), false);
    assert.equal(isFutureWeek("2026-11-16", now), true);
    assert.equal(isFutureWeek("2026-11-02", now), false);
  });
});

describe("Conformidade e Justificativa de Frequência Acadêmica", () => {
  const profileId = "00000000-0000-0000-0000-000000000001";
  const periodStart = "2026-11-09";

  it("cumpre a meta quando horas realizadas atingem ou superam 4h", () => {
    const compliance = computeWeeklyCompliance(
      profileId,
      4 * 3600, // exatas 4 horas
      periodStart,
      null,
      WEEKLY_TARGET_SECONDS
    );
    assert.equal(compliance.status, "met");
    assert.equal(compliance.deficitSeconds, 0);
    assert.equal(compliance.totalSeconds, 14400);
  });

  it("identifica débito quando horas realizadas são inferiores a 4h sem justificativa", () => {
    const compliance = computeWeeklyCompliance(
      profileId,
      2 * 3600, // 2 horas
      periodStart,
      null,
      WEEKLY_TARGET_SECONDS
    );
    assert.equal(compliance.status, "debt");
    assert.equal(compliance.deficitSeconds, 2 * 3600);
    assert.equal(compliance.totalSeconds, 7200);
  });

  it("marca status como justified na presença de justificativa ativa, preservando horas reais", () => {
    const activeJust: AttendanceJustification = {
      id: "just-001",
      profileId,
      periodStart: "2026-11-09",
      periodEnd: "2026-11-15",
      category: "saude",
      reason: "Consulta médica com atestado",
      status: "active",
      registeredByTutorEmail: "tutor@ailab.com",
      createdAt: "2026-11-10T10:00:00Z",
    };

    const compliance = computeWeeklyCompliance(
      profileId,
      1 * 3600, // 1 hora real cumprida
      periodStart,
      activeJust,
      WEEKLY_TARGET_SECONDS
    );

    assert.equal(compliance.status, "justified");
    // Horas reais não são adulteradas (permanecem 1 hora / 3600s)
    assert.equal(compliance.totalSeconds, 3600);
    // Débito matemático continua rastreado
    assert.equal(compliance.deficitSeconds, 3 * 3600);
    assert.deepEqual(compliance.justification, activeJust);
  });

  it("reverte para status debt caso a justificativa tenha sido revogada", () => {
    const revokedJust: AttendanceJustification = {
      id: "just-001",
      profileId,
      periodStart: "2026-11-09",
      periodEnd: "2026-11-15",
      category: "saude",
      reason: "Consulta médica com atestado",
      status: "revoked",
      registeredByTutorEmail: "tutor@ailab.com",
      revokedByTutorEmail: "coordenador@ailab.com",
      revokedAt: "2026-11-10T11:00:00Z",
      revocationReason: "Atestado inválido para o período",
      createdAt: "2026-11-10T10:00:00Z",
    };

    const compliance = computeWeeklyCompliance(
      profileId,
      1 * 3600,
      periodStart,
      revokedJust,
      WEEKLY_TARGET_SECONDS
    );

    assert.equal(compliance.status, "debt");
    assert.equal(compliance.deficitSeconds, 3 * 3600);
    assert.equal(compliance.justification, revokedJust);
  });
});
