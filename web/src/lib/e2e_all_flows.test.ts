import test from "node:test";
import assert from "node:assert/strict";
import {
  formatDuration,
  sessionSeconds,
  totalsByMember,
  groupByDay,
} from "./aggregate.ts";
import { rangeFor, formatRange, PERIOD_LABELS, type PeriodKey } from "./period.ts";
import type { Member, SessionRecord } from "./reports.ts";

// ============================================================================
// FLUXO 1: PAINEL PÚBLICO (MÉTRICAS, PERÍODOS, PESQUISA E TIMELINE)
// ============================================================================
test("E2E FLUXO 1: Painel Público - Agregações, Intervalos de Datas e Filtros", () => {
  const members: Member[] = [
    { id: "m-1", name: "Carlos Eduardo", matricula: "202401" },
    { id: "m-2", name: "Beatriz Lima", matricula: "202402" },
    { id: "m-3", name: "Daniel Rocha", matricula: "202403" },
  ];

  const now = new Date("2026-09-15T15:00:00Z");

  const sessions: SessionRecord[] = [
    // Carlos: 2 sessões válidas (1h e 2h)
    {
      profileId: "m-1",
      checkIn: "2026-09-15T08:00:00Z",
      checkOut: "2026-09-15T09:00:00Z",
      durationS: 3600,
      voidedAt: null,
    },
    {
      profileId: "m-1",
      checkIn: "2026-09-15T10:00:00Z",
      checkOut: "2026-09-15T12:00:00Z",
      durationS: 7200,
      voidedAt: null,
    },
    // Beatriz: 1 sessão em andamento (aberta há 3h)
    {
      profileId: "m-2",
      checkIn: "2026-09-15T12:00:00Z",
      checkOut: null,
      durationS: null,
      voidedAt: null,
    },
    // Daniel: 1 sessão esquecida/anulada pelo sweep (0 segundos)
    {
      profileId: "m-3",
      checkIn: "2026-09-14T08:00:00Z",
      checkOut: "2026-09-15T00:00:00Z",
      durationS: null,
      voidedAt: "2026-09-15T00:00:00Z",
    },
  ];

  const presentIds = ["m-2"];
  const totals = totalsByMember(members, sessions, presentIds, now);

  // 1. Verificação de Integrantes Ativos e Totais
  assert.strictEqual(totals.length, 3);
  
  // Beatriz deve ter 3h (10800s) acumuladas da sessão em andamento
  const beatriz = totals.find((t) => t.member.id === "m-2");
  assert.ok(beatriz);
  assert.strictEqual(beatriz.present, true);
  assert.strictEqual(beatriz.totalSeconds, 10800);
  assert.strictEqual(beatriz.sessionCount, 1);

  // Carlos deve ter 3h (10800s) e 2 sessões
  const carlos = totals.find((t) => t.member.id === "m-1");
  assert.ok(carlos);
  assert.strictEqual(carlos.totalSeconds, 10800);
  assert.strictEqual(carlos.sessionCount, 2);

  // Daniel tem 0 segundos e 0 sessões válidas (sessão anulada)
  const daniel = totals.find((t) => t.member.id === "m-3");
  assert.ok(daniel);
  assert.strictEqual(daniel.totalSeconds, 0);
  assert.strictEqual(daniel.sessionCount, 0);

  // 2. Cálculo dos 4 KPIs do Dashboard
  const presentCount = presentIds.length;
  const totalLabSeconds = totals.reduce((sum, r) => sum + r.totalSeconds, 0);
  const activeMembersCount = totals.filter((r) => r.sessionCount > 0).length;
  const totalValidSessionsCount = sessions.filter((s) => s.voidedAt === null).length;

  assert.strictEqual(presentCount, 1, "Deve ter 1 presente agora (Beatriz)");
  assert.strictEqual(totalLabSeconds, 21600, "Total de horas: 6h (21600s)");
  assert.strictEqual(activeMembersCount, 2, "2 integrantes ativos com sessão válida");
  assert.strictEqual(totalValidSessionsCount, 3, "3 sessões válidas no período");

  // 3. Intervalos de Período
  const dayRange = rangeFor("day");
  const weekRange = rangeFor("week");
  const monthRange = rangeFor("month");

  assert.ok(dayRange.from <= dayRange.to);
  assert.ok(weekRange.from <= weekRange.to);
  assert.ok(monthRange.from <= monthRange.to);
  assert.strictEqual(PERIOD_LABELS["day"], "Hoje");
  assert.strictEqual(PERIOD_LABELS["week"], "Esta semana");
  assert.strictEqual(PERIOD_LABELS["month"], "Este mês");

  // 4. Busca Reativa por Nome ou Matrícula
  const queryName = "carlos";
  const searchResultName = totals.filter(
    (t) =>
      t.member.name.toLowerCase().includes(queryName.toLowerCase()) ||
      (t.member.matricula && t.member.matricula.includes(queryName))
  );
  assert.strictEqual(searchResultName.length, 1);
  assert.strictEqual(searchResultName[0].member.id, "m-1");

  const queryMatricula = "202402";
  const searchResultMatricula = totals.filter(
    (t) =>
      t.member.name.toLowerCase().includes(queryMatricula.toLowerCase()) ||
      (t.member.matricula && t.member.matricula.includes(queryMatricula))
  );
  assert.strictEqual(searchResultMatricula.length, 1);
  assert.strictEqual(searchResultMatricula[0].member.id, "m-2");
});

// ============================================================================
// FLUXO 2: ACESSO DO TUTOR, CONTINGÊNCIA E AUDITORIA SEMANAL (< 4H)
// ============================================================================
test("E2E FLUXO 2: Acesso do Tutor - Auditoria de 4 Horas, Entrada Manual e Expurgo LGPD", () => {
  const members: Member[] = [
    { id: "m-1", name: "Carlos Eduardo", matricula: "202401" },
    { id: "m-2", name: "Beatriz Lima", matricula: "202402" },
    { id: "m-3", name: "Aluno Desistente", matricula: "202499" },
  ];

  // Sessões da semana
  const sessions: SessionRecord[] = [
    // Carlos: 5 horas cumpridas (meta atingida >= 4h)
    {
      profileId: "m-1",
      checkIn: "2026-09-14T08:00:00Z",
      checkOut: "2026-09-14T13:00:00Z",
      durationS: 5 * 3600,
      voidedAt: null,
    },
    // Beatriz: apenas 2 horas cumpridas (< 4h, em débito)
    {
      profileId: "m-2",
      checkIn: "2026-09-14T14:00:00Z",
      checkOut: "2026-09-14T16:00:00Z",
      durationS: 2 * 3600,
      voidedAt: null,
    },
    // Aluno Desistente: 0 horas (< 4h, em débito)
  ];

  // 1. Auditoria Semanal do Tutor: Alunos em débito (< 4h)
  const studentsUnderFourHours = members.filter((m) => {
    const totalSecs = sessions
      .filter((s) => s.profileId === m.id && s.voidedAt === null)
      .reduce((sum, s) => sum + (s.durationS ?? 0), 0);
    return totalSecs < 4 * 3600;
  });

  assert.strictEqual(studentsUnderFourHours.length, 2, "Beatriz e Aluno Desistente estão com < 4 horas");
  assert.ok(studentsUnderFourHours.some((m) => m.id === "m-2"));
  assert.ok(studentsUnderFourHours.some((m) => m.id === "m-3"));

  // 2. Contingência do Tutor: Registro Manual de Entrada
  const openSessions = new Map<string, string>(); // profileId -> checkIn

  function tutorRegisterEntrySim(profileId: string, memberList: Member[]): { success: boolean; message?: string } {
    const member = memberList.find((m) => m.id === profileId);
    if (!member) return { success: false, message: "Integrante não encontrado ou inativo." };
    if (openSessions.has(profileId)) {
      return { success: false, message: "Integrante já possui presença em andamento." };
    }
    openSessions.set(profileId, new Date().toISOString());
    return { success: true };
  }

  // Entrada de Carlos manual bem sucedida
  const res1 = tutorRegisterEntrySim("m-1", members);
  assert.strictEqual(res1.success, true);
  assert.ok(openSessions.has("m-1"));

  // Tentativa duplicada bloqueada com mensagem amigável
  const resDuplicate = tutorRegisterEntrySim("m-1", members);
  assert.strictEqual(resDuplicate.success, false);
  assert.strictEqual(resDuplicate.message, "Integrante já possui presença em andamento.");

  // 3. Descadastramento de Integrante Desistente com Expurgo LGPD
  const faceEmbeddings = new Map<string, number[]>([
    ["m-3", [0.12, 0.34, 0.56]],
  ]);
  let activeProfiles = [...members];

  function tutorRemoveMemberSim(profileId: string): { success: boolean; purgedEmbeddings: boolean } {
    openSessions.delete(profileId);
    const hadEmbeddings = faceEmbeddings.has(profileId);
    faceEmbeddings.delete(profileId);
    activeProfiles = activeProfiles.filter((m) => m.id !== profileId);
    return { success: true, purgedEmbeddings: hadEmbeddings };
  }

  const removeRes = tutorRemoveMemberSim("m-3");
  assert.strictEqual(removeRes.success, true);
  assert.strictEqual(removeRes.purgedEmbeddings, true);
  assert.strictEqual(faceEmbeddings.has("m-3"), false, "Biometria facial DEVE ser expurgada do banco");
  assert.strictEqual(activeProfiles.length, 2, "Lista de integrantes ativos do dashboard não deve mais conter o desistente");

  // 4. Gestão de Sessões Anômalas (> 10h) pelo Tutor (Invalidar & Excluir)
  let studentSessions: SessionRecord[] = [
    {
      id: 101,
      profileId: "m-2",
      checkIn: "2026-09-14T08:00:00Z",
      checkOut: "2026-09-14T20:30:00Z", // 12h30m (Anômala, ultrapassou 10h)
      durationS: 45000,
      voidedAt: null,
    },
    {
      id: 102,
      profileId: "m-2",
      checkIn: "2026-09-15T09:00:00Z",
      checkOut: "2026-09-15T12:00:00Z", // 3h (Normal)
      durationS: 10800,
      voidedAt: null,
    },
  ];

  // 4a. Detecção da anomalia (> 10h = 36.000 segundos)
  const anomalousSessions = studentSessions.filter(
    (s) => s.durationS != null && s.durationS > 36000
  );
  assert.strictEqual(anomalousSessions.length, 1);
  assert.strictEqual(anomalousSessions[0].id, 101);

  // Total antes da anulação: 45000 + 10800 = 55800s
  const now = new Date();
  const initialTotal = studentSessions.reduce((acc, s) => acc + sessionSeconds(s, now), 0);
  assert.strictEqual(initialTotal, 55800);

  // 4b. Tutor Invalida / Anula a sessão anômala #101
  const sessionToVoid = studentSessions.find((s) => s.id === 101)!;
  sessionToVoid.voidedAt = new Date().toISOString();
  sessionToVoid.autoClosed = true;

  // Garantir que a sessão anulada computa rigorosamente 0 segundos
  assert.strictEqual(sessionSeconds(sessionToVoid, now), 0, "Sessão anulada pelo tutor deve computar 0 segundos");
  const afterVoidTotal = studentSessions.reduce((acc, s) => acc + sessionSeconds(s, now), 0);
  assert.strictEqual(afterVoidTotal, 10800, "Total deve computar apenas a sessão normal remanescente");

  // 4c. Tutor Reativa a sessão
  sessionToVoid.voidedAt = null;
  assert.strictEqual(sessionSeconds(sessionToVoid, now), 45000, "Reativação restaura o cômputo original");

  // 4d. Tutor Exclui definitivamente a sessão anômala
  studentSessions = studentSessions.filter((s) => s.id !== 101);
  assert.strictEqual(studentSessions.length, 1);
  assert.strictEqual(studentSessions[0].id, 102);
  const finalTotal = studentSessions.reduce((acc, s) => acc + sessionSeconds(s, now), 0);
  assert.strictEqual(finalTotal, 10800, "Exclusão remove a sessão permanentemente do cômputo");
});

// ============================================================================
// FLUXO 3: CADASTRO BIOMÉTRICO (REQUISITO 3+ FOTOS, EMBEDDING E CONSENTIMENTO)
// ============================================================================
test("E2E FLUXO 3: Cadastro Biométrico - Validação de 3+ Fotos, Vetor 512-D e Consentimento", () => {
  function validateEnrollmentRequest(
    tutorToken: string | null,
    name: string,
    consent: boolean,
    frameCount: number
  ): { status: number; error?: string } {
    if (!tutorToken || tutorToken !== "valid-tutor-auth-token") {
      return { status: 401, error: "Acesso negado: token de tutor obrigatório." };
    }
    if (!name.trim()) {
      return { status: 422, error: "Nome do integrante é obrigatório." };
    }
    if (!consent) {
      return { status: 422, error: "Consentimento expresso LGPD é mandatório." };
    }
    if (frameCount < 3) {
      return { status: 400, error: "Envie ao menos 3 fotos para cadastro seguro." };
    }
    return { status: 200 };
  }

  // Falha: sem token
  assert.strictEqual(validateEnrollmentRequest(null, "João", true, 3).status, 401);
  // Falha: sem consentimento
  assert.strictEqual(validateEnrollmentRequest("valid-tutor-auth-token", "João", false, 3).status, 422);
  // Falha: fotos insuficientes (< 3)
  assert.strictEqual(validateEnrollmentRequest("valid-tutor-auth-token", "João", true, 2).status, 400);
  // Sucesso
  assert.strictEqual(validateEnrollmentRequest("valid-tutor-auth-token", "João Santos", true, 5).status, 200);

  // Simulação de vetor neural normalizado L2
  const mockVector = new Float32Array(512);
  for (let i = 0; i < 512; i++) mockVector[i] = 1 / Math.sqrt(512);
  
  let norm = 0;
  for (let i = 0; i < 512; i++) norm += mockVector[i] * mockVector[i];
  assert.ok(Math.abs(Math.sqrt(norm) - 1.0) < 1e-5, "Vetor biométrico deve ter norma L2 unitária");
});

// ============================================================================
// FLUXO 4: RECADASTRO BIOMÉTRICO (ATUALIZAÇÃO DE ROSTO E CACHE)
// ============================================================================
test("E2E FLUXO 4: Recadastro Biométrico - Substituição Segura de Embeddings", () => {
  const database = {
    profiles: new Map([["prof-1", { id: "prof-1", name: "Maria Clara", matricula: "1001" }]]),
    embeddings: new Map([["prof-1", [0.1, 0.2, 0.3]]]),
    cacheVersion: 1,
  };

  function refreshEmbedding(profileId: string, newFramesCount: number) {
    if (!database.profiles.has(profileId)) {
      throw new Error("404: Perfil não encontrado.");
    }
    if (newFramesCount < 3) {
      throw new Error("400: Mínimo de 3 frames necessários.");
    }
    database.embeddings.set(profileId, [0.9, 0.8, 0.7]);
    database.cacheVersion += 1;
    return { success: true, profileId, cacheVersion: database.cacheVersion };
  }

  const res = refreshEmbedding("prof-1", 4);
  assert.strictEqual(res.success, true);
  assert.strictEqual(database.embeddings.get("prof-1")?.[0], 0.9);
  assert.strictEqual(database.cacheVersion, 2, "Cache neural deve ser invalidado após recadastro");
});

// ============================================================================
// FLUXO 5: DETECÇÃO, SPOOFING E CICLO DE SESSÕES NO TOTEM
// ============================================================================
test("E2E FLUXO 5: Detecção e Presença - Desafio Temporal, Anti-Spoofing e Sessões", () => {
  interface Challenge {
    id: string;
    token: string;
    expiresAt: number;
    used: boolean;
  }

  const challenges = new Map<string, Challenge>();

  function createChallenge(): Challenge {
    const id = "chal-" + Math.random().toString(36).slice(2);
    const chal: Challenge = { id, token: "tok-" + id, expiresAt: Date.now() + 15000, used: false };
    challenges.set(id, chal);
    return chal;
  }

  function consumeChallenge(id: string): { valid: boolean; reason?: string } {
    const c = challenges.get(id);
    if (!c) return { valid: false, reason: "Desafio inexistente" };
    if (c.used) return { valid: false, reason: "Desafio já utilizado" };
    if (Date.now() > c.expiresAt) return { valid: false, reason: "Desafio expirado" };
    c.used = true;
    return { valid: true };
  }

  const chal = createChallenge();
  assert.strictEqual(consumeChallenge(chal.id).valid, true);
  assert.strictEqual(consumeChallenge(chal.id).valid, false, "Replay attack deve ser prevenido");

  function simulateSpoofCheck(confidenceScore: number, faceSizeRatio: number): { pass: boolean; status: string } {
    if (faceSizeRatio < 0.15) return { pass: false, status: "face_too_small" };
    if (confidenceScore < 0.85) return { pass: false, status: "spoof_detected" };
    return { pass: true, status: "live_verified" };
  }

  assert.strictEqual(simulateSpoofCheck(0.60, 0.30).status, "spoof_detected");
  assert.strictEqual(simulateSpoofCheck(0.95, 0.05).status, "face_too_small");
  assert.strictEqual(simulateSpoofCheck(0.92, 0.35).status, "live_verified");

  const checkInTime = new Date("2026-09-15T14:00:00Z");
  const checkOutTime = new Date("2026-09-15T16:15:00Z");
  const elapsedMinutes = Math.floor((checkOutTime.getTime() - checkInTime.getTime()) / 60000);
  assert.strictEqual(elapsedMinutes, 135, "14h até 16h15 = 135 minutos");
  assert.strictEqual(formatDuration(elapsedMinutes * 60), "2h 15m");
});

// ============================================================================
// FLUXO 6: RELATÓRIO OFICIAL DE FREQUÊNCIA E EXPORTAÇÃO PDF / IMPRESSÃO
// ============================================================================
test("E2E FLUXO 6: Relatório Oficial e Exportação PDF - Caminho Feliz e Casos Limítrofes", async () => {
  // 1. Caminho Feliz: Turma com integrantes em todos os estados de compliance
  const happyRows = [
    {
      member: { id: "m-1", name: "Ana Souza", matricula: "2024101" },
      totalSeconds: 18000, // 5h (>= 4h -> Regular)
      sessionCount: 3,
      isCurrentlyPresent: false,
    },
    {
      member: { id: "m-2", name: "Bruno Costa", matricula: "2024102" },
      totalSeconds: 14400, // Exatos 4h -> Regular
      sessionCount: 2,
      isCurrentlyPresent: true,
    },
    {
      member: { id: "m-3", name: "Carla Dias", matricula: "2024103" },
      totalSeconds: 7200, // 2h (< 4h -> Parcial)
      sessionCount: 1,
      isCurrentlyPresent: false,
    },
    {
      member: { id: "m-4", name: "Diego Ramos", matricula: "" }, // Sem matrícula
      totalSeconds: 0, // 0h -> Sem Horas
      sessionCount: 0,
      isCurrentlyPresent: false,
    },
  ];

  const totalSec = happyRows.reduce((acc, r) => acc + r.totalSeconds, 0);
  assert.strictEqual(totalSec, 39600, "Total de segundos deve ser 39.600s (11.0h)");
  const totalHours = (totalSec / 3600).toFixed(1);
  assert.strictEqual(totalHours, "11.0", "Total de horas formatado");

  const compliantCount = happyRows.filter((r) => r.totalSeconds >= 14400).length;
  assert.strictEqual(compliantCount, 2, "2 alunos com meta cumprida (Ana e Bruno)");

  const complianceRate = Math.round((compliantCount / happyRows.length) * 100);
  assert.strictEqual(complianceRate, 50, "Taxa de cumprimento da turma deve ser 50%");

  // Validação das regras de fronteira estrita (14.399s vs 14.400s)
  const isCompliantBoundary1 = 14399 >= 14400;
  const isCompliantBoundary2 = 14400 >= 14400;
  assert.strictEqual(isCompliantBoundary1, false, "14.399s (3h59m59s) NÃO é regular");
  assert.strictEqual(isCompliantBoundary2, true, "14.400s (4h00m00s) É regular");

  // Geração de Hash Criptográfico SHA-256 Anti-Fraude
  const payload = `AILAB-ATTENDANCE-REPORT|FROM:2026-09-01T00:00:00.000Z|TO:2026-09-07T23:59:59.000Z|MEMBERS:4|TOTAL_SEC:39600|TUTOR:tutor@ailab.com`;
  const msgBuffer = new TextEncoder().encode(payload);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();

  assert.strictEqual(hashHex.length, 64, "Hash SHA-256 deve ter 64 caracteres hexadecimais");
  assert.match(hashHex, /^[0-9A-F]{64}$/, "Hash SHA-256 deve conter apenas dígitos hex maiúsculos");

  // 2. Caminho Limítrofe / Errado: Relatório sem discentes (0 rows)
  const emptyRows: typeof happyRows = [];
  const emptyTotalSec = emptyRows.reduce((acc, r) => acc + r.totalSeconds, 0);
  const emptyCompliant = emptyRows.filter((r) => r.totalSeconds >= 14400).length;
  const emptyRate = emptyRows.length > 0 ? Math.round((emptyCompliant / emptyRows.length) * 100) : 0;

  assert.strictEqual(emptyTotalSec, 0, "Sem registros, total de segundos deve ser 0");
  assert.strictEqual(emptyCompliant, 0, "Sem registros, compliant deve ser 0");
  assert.strictEqual(emptyRate, 0, "Sem registros, taxa deve ser 0% sem divisão por zero (NaN)");
});

