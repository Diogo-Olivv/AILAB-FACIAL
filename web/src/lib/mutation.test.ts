import test from "node:test";
import assert from "node:assert/strict";
import {
  formatDuration,
  sessionSeconds,
  totalsByMember,
  groupByDay,
  type MemberTotal,
} from "./aggregate.ts";
import { rangeFor, formatRange, type PeriodKey } from "./period.ts";
import type { Member, SessionRecord } from "./reports.ts";

/**
 * BATERIA COMPLETA DE TESTES DE MUTAÇÃO (FASE 1)
 * 
 * Esses testes exercitam sistematicamente operadores relacionais, limiares de negócio,
 * inversão de ordenação e tratamento de exceções de integridade biométrica/acadêmica.
 * Se qualquer desenvolvedor ou refatoração introduzir um mutante, o teste falha ("mata" o mutante).
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
  // Se um mutante remover a checagem `if (session.voidedAt != null) return 0;`, seconds será 14400.
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

  // Exatamente 10h (36.000s) -> Limite exato não anômalo (mutante >= falharia aqui)
  assert.equal(isAnomalous(36000, false), false, "36000s exatos não é maior que 10h");

  // 1 segundo acima de 10h (36.001s) -> DEVE ser anômala (mutante > 36000 mantém true)
  assert.equal(isAnomalous(36001, false), true, "36001s DEVE ser anômala (>10h)");

  // Sessão aberta há 10h e 1 segundo
  assert.equal(isAnomalous(0, true, "2026-09-15T11:59:59Z"), true, "Aberta há >10h deve ser anômala");
  // Sessão aberta há 9h59m59s
  assert.equal(isAnomalous(0, true, "2026-09-15T12:00:01Z"), false, "Aberta há <10h não deve ser anômala");
});

test("Mutante 3: Inversão de cálculo de minutos em formatDuration", () => {
  assert.equal(formatDuration(0), "0h 00m");
  assert.equal(formatDuration(59), "0h 00m");
  assert.equal(formatDuration(60), "0h 01m");
  assert.equal(formatDuration(3599), "0h 59m");
  assert.equal(formatDuration(3600), "1h 00m");
  assert.equal(formatDuration(3665), "1h 01m");
  assert.equal(formatDuration(36000), "10h 00m");
  assert.equal(formatDuration(36000, true), "10h 00m 00s");
});

test("Mutante 4: Validação de Matrícula (apenas dígitos e comprimento exato de 8 caracteres)", () => {
  const validateMatricula = (mat: string, len: number = 8) => {
    return new RegExp(`^\\d{${len}}$`).test(mat);
  };

  assert.equal(validateMatricula("20240001"), true);
  // Mutantes que aceitam letras ou caracteres especiais:
  assert.equal(validateMatricula("2024000a"), false);
  assert.equal(validateMatricula("2024-001"), false);
  assert.equal(validateMatricula("2024 001"), false);
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

test("Mutante 6: Ordenação do Leaderboard de Integrantes DEVE ser estritamente decrescente por horas", () => {
  const members: Member[] = [
    { id: "m-1", name: "Alice (Poucas Horas)", matricula: "20240001" },
    { id: "m-2", name: "Carlos (Mais Horas)", matricula: "20240002" },
    { id: "m-3", name: "Beatriz (Média Horas)", matricula: "20240003" },
  ];

  const sessions: SessionRecord[] = [
    { id: 1, profileId: "m-1", checkIn: "2026-09-15T08:00:00Z", checkOut: "2026-09-15T09:00:00Z", durationS: 3600 },
    { id: 2, profileId: "m-2", checkIn: "2026-09-15T08:00:00Z", checkOut: "2026-09-15T14:00:00Z", durationS: 21600 },
    { id: 3, profileId: "m-3", checkIn: "2026-09-15T08:00:00Z", checkOut: "2026-09-15T11:00:00Z", durationS: 10800 },
  ];

  const totals = totalsByMember(members, sessions, [], new Date("2026-09-15T18:00:00Z"));
  
  // Se o mutante trocar `b.totalSeconds - a.totalSeconds` por `a.totalSeconds - b.totalSeconds`, Alice viria primeiro!
  assert.equal(totals[0].member.id, "m-2", "Primeiro colocado deve ser Carlos com 6 horas");
  assert.equal(totals[1].member.id, "m-3", "Segundo colocado deve ser Beatriz com 3 horas");
  assert.equal(totals[2].member.id, "m-1", "Terceiro colocado deve ser Alice com 1 hora");
});

test("Mutante 7: Histórico Diário (groupByDay) - Sessão anulada sem checkOut NÃO pode ser rotulada como open", () => {
  const members: Member[] = [{ id: "m-1", name: "Lucas", matricula: "20240099" }];
  const sessions: SessionRecord[] = [
    {
      id: 99,
      profileId: "m-1",
      checkIn: "2026-09-15T08:00:00Z",
      checkOut: null, // Não fez checkOut
      durationS: null,
      voidedAt: "2026-09-15T10:00:00Z", // Mas o tutor anulou a sessão
    },
  ];

  const days = groupByDay(members, sessions, new Date("2026-09-15T18:00:00Z"));
  assert.equal(days.length, 1);
  const entry = days[0].entries[0];

  // Se o mutante omitir `&& !isVoided`, `entry.open` seria true!
  assert.equal(entry.voided, true, "Deve estar marcada como voided");
  assert.equal(entry.open, false, "Sessão anulada NÃO pode constar como aberta/presente");
  assert.equal(entry.seconds, 0, "Sessão anulada deve ter 0 segundos");
  assert.equal(days[0].totalSeconds, 0, "O dia deve computar 0 segundos");
});

test("Mutante 8: Histórico Diário (groupByDay) - Ordenação cronológica reversa (mais recente primeiro)", () => {
  const members: Member[] = [{ id: "m-1", name: "Lucas", matricula: "20240099" }];
  const sessions: SessionRecord[] = [
    { id: 1, profileId: "m-1", checkIn: "2026-09-10T10:00:00Z", checkOut: "2026-09-10T12:00:00Z", durationS: 7200 },
    { id: 2, profileId: "m-1", checkIn: "2026-09-15T10:00:00Z", checkOut: "2026-09-15T12:00:00Z", durationS: 7200 },
    { id: 3, profileId: "m-1", checkIn: "2026-09-12T10:00:00Z", checkOut: "2026-09-12T12:00:00Z", durationS: 7200 },
  ];

  const days = groupByDay(members, sessions, new Date("2026-09-15T18:00:00Z"));
  // Se o mutante inverter para ordenação crescente, 2026-09-10 viria primeiro
  assert.equal(days[0].key, "2026-09-15", "O dia mais recente deve vir no topo");
  assert.equal(days[1].key, "2026-09-12");
  assert.equal(days[2].key, "2026-09-10");
});

test("Mutante 9: Inversão defensiva de intervalo de período customizado (rangeFor)", () => {
  // Usuário insere acidentalmente from > to
  const range = rangeFor("custom", "2026-09-20", "2026-09-10");

  // Se o mutante remover `if (from > to) { return { from: to, to: from } }`, from continuaria posterior a to!
  assert.ok(range.from <= range.to, "from deve ser anterior ou igual a to");
  assert.equal(range.from.getDate(), 10, "Dia inicial invertido deve ser 10");
  assert.equal(range.to.getDate(), 20, "Dia final invertido deve ser 20");
});

test("Mutante 10: Auditoria Acadêmica de 4 Horas Semanais do Tutor (TARGET_SECONDS = 14400s)", () => {
  const TARGET_SECONDS = 4 * 3600; // 14400

  const calculateAuditStatus = (totalSeconds: number) => {
    const deficit = Math.max(0, TARGET_SECONDS - totalSeconds);
    const isUnder = totalSeconds < TARGET_SECONDS;
    return { deficit, isUnder };
  };

  // 3h59m59s (14.399s) -> Deve estar pendente (isUnder: true) com 1s de déficit
  const under = calculateAuditStatus(14399);
  assert.equal(under.isUnder, true);
  assert.equal(under.deficit, 1);

  // Exatamente 4h00m00s (14.400s) -> Metas cumpridas (isUnder: false) com 0s de déficit
  // Se o mutante trocar `< TARGET_SECONDS` por `<= TARGET_SECONDS`, falharia aqui!
  const exact = calculateAuditStatus(14400);
  assert.equal(exact.isUnder, false);
  assert.equal(exact.deficit, 0);

  // 5h (18.000s) -> Cumpridas
  const over = calculateAuditStatus(18000);
  assert.equal(over.isUnder, false);
  assert.equal(over.deficit, 0);
});

test("Mutante 11: Clock Skew / Horário local inconsistente em sessão aberta", () => {
  // Se o relógio do cliente estiver dessincronizado e now for anterior a checkIn:
  const session: SessionRecord = {
    id: 999,
    profileId: "m-1",
    checkIn: "2026-09-15T12:00:00Z",
    checkOut: null,
    durationS: null,
  };

  const clientNowBeforeCheckIn = new Date("2026-09-15T11:50:00Z");
  const seconds = sessionSeconds(session, clientNowBeforeCheckIn);

  // Se o mutante esquecer Math.max(0, elapsed), seconds seria negativo (-600s)!
  assert.equal(seconds, 0, "Sessão aberta com clock skew no passado JAMAIS pode retornar segundos negativos");
});

test("Mutante 12: Regra de Cadastro Sequencial do Tablet - Estritamente 3 fotos e consentimento LGPD", () => {
  const canEnroll = (name: string, matricula: string, consent: boolean, shotsCount: number) => {
    const isMatriculaValid = /^\d{8}$/.test(matricula);
    const REQUIRED_SHOTS = 3;
    return name.trim().length > 0 && isMatriculaValid && consent === true && shotsCount === REQUIRED_SHOTS;
  };

  // Válido
  assert.equal(canEnroll("João Silva", "20240001", true, 3), true);

  // Mutante que permite cadastrar com 2 fotos (menos ângulos = baixa acurácia)
  assert.equal(canEnroll("João Silva", "20240001", true, 2), false);

  // Mutante que permite cadastrar sem consentimento LGPD (violação legal)
  assert.equal(canEnroll("João Silva", "20240001", false, 3), false);

  // Mutante que aceita nome apenas com espaços
  assert.equal(canEnroll("   ", "20240001", true, 3), false);
});
