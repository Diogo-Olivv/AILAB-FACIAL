import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/useAuth";
import { supabase } from "../lib/supabase";
import {
  fetchMembers,
  fetchPresentIds,
  fetchSessions,
  type Member,
  type SessionRecord,
} from "../lib/reports";
import { rangeFor, type PeriodKey } from "../lib/period";
import { formatDuration, groupByDay, sessionSeconds, totalsByMember, type MemberTotal } from "../lib/aggregate";
import { Header } from "../components/Header";
import { PeriodSelector } from "../components/PeriodSelector";
import { TotalsTable } from "../components/TotalsTable";
import { DailyHistory } from "../components/DailyHistory";
import { PrivacyTermsModal } from "../components/PrivacyTermsModal";
import { MemberDetailDrawer } from "../components/MemberDetailDrawer";
import { TutorWarningModal } from "../components/TutorWarningModal";
import { Footer } from "../components/Footer";
import { KpiSkeleton, TableSkeleton } from "../components/TableSkeleton";

type View = "totals" | "history";

export function Dashboard() {
  const { user, signOut } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [presentIds, setPresentIds] = useState<string[]>([]);
  const [period, setPeriod] = useState<PeriodKey>("week");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [view, setView] = useState<View>("totals");
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // Modais e Drawer
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [isTutorWarningOpen, setIsTutorWarningOpen] = useState(false);
  const [selectedMemberTotal, setSelectedMemberTotal] = useState<MemberTotal | null>(null);

  const loadMembers = useCallback(async () => {
    try {
      const data = await fetchMembers();
      setMembers(data);
    } catch (e: any) {
      if (e?.message?.includes("JWT") || e?.message?.includes("expired")) {
        await supabase.auth.signOut();
        const retryData = await fetchMembers();
        setMembers(retryData);
      } else {
        setError(e instanceof Error ? e.message : "Falha ao carregar integrantes.");
      }
    }
  }, []);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const range = useMemo(
    () => rangeFor(period, customFrom, customTo),
    [period, customFrom, customTo],
  );

  const refreshData = useCallback(
    async (silent = false) => {
      if (!silent) setIsRefreshing(true);
      setError("");
      try {
        const [nextSessions, nextPresent] = await Promise.all([
          fetchSessions(range),
          fetchPresentIds(),
        ]);
        setSessions(nextSessions);
        setPresentIds(nextPresent);
        setLastRefreshed(new Date());
      } catch (e: any) {
        // Recuperação automática caso haja token JWT expirado no navegador
        if (e?.message?.includes("JWT") || e?.message?.includes("expired") || e?.message?.includes("401")) {
          try {
            await supabase.auth.signOut();
            const [retrySessions, retryPresent] = await Promise.all([
              fetchSessions(range),
              fetchPresentIds(),
            ]);
            setSessions(retrySessions);
            setPresentIds(retryPresent);
            setLastRefreshed(new Date());
            return;
          } catch {
            // Continua com erro
          }
        }
        setError(
          e instanceof Error
            ? e.message
            : "Falha ao acessar os dados de permanência. Tente novamente."
        );
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [range],
  );

  useEffect(() => {
    setLoading(true);
    refreshData(false);
  }, [refreshData]);

  // Polling a cada 30 segundos para manter os dados atualizados em tempo real no dashboard
  useEffect(() => {
    const timer = setInterval(() => {
      refreshData(true);
    }, 30000);
    return () => clearInterval(timer);
  }, [refreshData]);

  const totals = useMemo(() => {
    return totalsByMember(members, sessions, presentIds, new Date());
  }, [members, sessions, presentIds]);

  const days = useMemo(() => groupByDay(members, sessions, new Date()), [members, sessions]);

  // Filtragem dinâmica por nome e matrícula
  const filteredTotals = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return totals;
    return totals.filter(
      (t) =>
        t.member.name.toLowerCase().includes(q) ||
        (t.member.matricula && t.member.matricula.toLowerCase().includes(q))
    );
  }, [totals, searchQuery]);

  const filteredDays = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return days;
    return days
      .map((day) => ({
        ...day,
        entries: day.entries.filter((entry) =>
          entry.memberName.toLowerCase().includes(q)
        ),
      }))
      .filter((day) => day.entries.length > 0);
  }, [days, searchQuery]);

  // Métricas para KPI Cards
  const presentCount = useMemo(() => presentIds.length, [presentIds]);
  const totalLabSeconds = useMemo(
    () => totals.reduce((sum, r) => sum + r.totalSeconds, 0),
    [totals],
  );
  const activeMembersCount = useMemo(
    () => totals.filter((r) => r.sessionCount > 0).length,
    [totals],
  );
  const totalSessionsCount = useMemo(() => sessions.length, [sessions]);

  // Contagem de alunos com débito na semana (< 4h) para o Tutor
  const studentsUnderFourHoursCount = useMemo(() => {
    const weekRange = rangeFor("week");
    const now = new Date();
    const weekSessions = sessions.filter((s) => {
      const d = new Date(s.checkIn);
      return d >= weekRange.from && d <= weekRange.to;
    });
    const map = new Map<string, number>();
    for (const m of members) map.set(m.id, 0);
    for (const s of weekSessions) {
      if (s.voidedAt != null) continue;
      map.set(s.profileId, (map.get(s.profileId) ?? 0) + sessionSeconds(s, now));
    }
    return members.filter((m) => (map.get(m.id) ?? 0) < 4 * 3600).length;
  }, [members, sessions]);

  return (
    <div className="min-h-screen bg-cream flex flex-col justify-between selection:bg-green/20">
      {/* Cabeçalho limpo com contagem ao vivo e ações rápidas */}
      <Header
        user={user}
        signOut={signOut}
        onOpenTerms={() => setIsTermsOpen(true)}
        onRefresh={() => refreshData(false)}
        isRefreshing={isRefreshing}
        presentCount={presentCount}
      />

      <main className="flex-1 px-4 py-6 md:px-8 space-y-6 max-w-6xl mx-auto w-full">
        {/* Painel do Tutor (visível apenas para tutores autenticados) */}
        {user && (
          <div className="rounded-2xl border border-navy/20 bg-navy/5 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shadow-2xs animate-fade-in">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-navy text-white text-xl">
                🎓
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-ink">
                    Painel Exclusivo do Tutor
                  </h3>
                  <span className="rounded-full bg-navy/15 px-2 py-0.5 text-2xs font-bold text-navy">
                    {user.email}
                  </span>
                </div>
                <p className="text-xs text-muted mt-0.5">
                  Audite o cumprimento da meta semanal (4 horas) e emita advertências aos alunos em débito.
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsTutorWarningOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-warn px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-sm transition-all hover:bg-warn/90 active:scale-95 cursor-pointer min-h-[44px]"
            >
              <span>⚠️</span>
              <span>Auditoria Semanal & Advertências ({studentsUnderFourHoursCount})</span>
            </button>
          </div>
        )}

        {/* KPI Cards de Resumo Direto (sem título redundante) */}
        {loading ? (
          <KpiSkeleton />
        ) : (
          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4 sm:gap-4 animate-fade-in">
            {/* Presentes Agora */}
            <div className="rounded-2xl border border-line bg-card p-4 sm:p-5 shadow-2xs transition-all duration-200 hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Presentes
                </span>
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green" />
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-ink">{presentCount}</span>
                <span className="text-xs font-bold text-green">ao vivo</span>
              </div>
              <p className="text-xs text-muted mt-1">no laboratório agora</p>
            </div>

            {/* Total de Horas */}
            <div className="rounded-2xl border border-line bg-card p-4 sm:p-5 shadow-2xs transition-all duration-200 hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Horas Totais
                </span>
                <span className="text-sm">⏱️</span>
              </div>
              <div className="mt-2">
                <span className="text-2xl sm:text-3xl font-extrabold text-navy">
                  {formatDuration(totalLabSeconds)}
                </span>
              </div>
              <p className="text-xs text-muted mt-1">acumuladas no período</p>
            </div>

            {/* Integrantes com Registro */}
            <div className="rounded-2xl border border-line bg-card p-4 sm:p-5 shadow-2xs transition-all duration-200 hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Ativos no Período
                </span>
                <span className="text-sm">👥</span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-ink">{activeMembersCount}</span>
                <span className="text-xs text-muted">de {members.length}</span>
              </div>
              <p className="text-xs text-muted mt-1">integrantes com presença</p>
            </div>

            {/* Total de Sessões */}
            <div className="rounded-2xl border border-line bg-card p-4 sm:p-5 shadow-2xs transition-all duration-200 hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Total Sessões
                </span>
                <span className="text-sm">📌</span>
              </div>
              <div className="mt-2">
                <span className="text-3xl font-extrabold text-ink">{totalSessionsCount}</span>
              </div>
              <p className="text-xs text-muted mt-1">registros válidos</p>
            </div>
          </div>
        )}

        {/* Seletor de Período */}
        <PeriodSelector
          period={period}
          range={range}
          customFrom={customFrom}
          customTo={customTo}
          onPeriod={setPeriod}
          onCustomFrom={setCustomFrom}
          onCustomTo={setCustomTo}
        />

        {/* Barra de Filtros com Busca Integrada por Nome e Matrícula */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-card p-3 shadow-2xs">
          <div className="flex gap-2">
            <button
              onClick={() => setView("totals")}
              className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200 active:scale-95 cursor-pointer min-h-[44px] ${
                view === "totals"
                  ? "bg-navy text-white shadow-sm ring-2 ring-navy/20"
                  : "border border-line bg-card text-muted hover:text-ink hover:bg-navy/5"
              }`}
            >
              Totais por Integrante
            </button>
            <button
              onClick={() => setView("history")}
              className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200 active:scale-95 cursor-pointer min-h-[44px] ${
                view === "history"
                  ? "bg-navy text-white shadow-sm ring-2 ring-navy/20"
                  : "border border-line bg-card text-muted hover:text-ink hover:bg-navy/5"
              }`}
            >
              Histórico Diário
            </button>
          </div>

          {/* Campo de Busca Reativa por Nome ou Matrícula */}
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted pointer-events-none text-xs">
              🔍
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nome ou matrícula..."
              className="w-full rounded-xl border border-line bg-white py-2 pl-8 pr-7 text-xs sm:text-sm text-ink placeholder:text-muted/70 focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/20 shadow-2xs"
              aria-label="Buscar integrantes por nome ou matrícula"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-muted hover:text-ink cursor-pointer text-xs"
                aria-label="Limpar busca"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Alerta de Erro Resiliente */}
        {error && (
          <div className="flex items-center justify-between rounded-2xl border border-warn/30 bg-warn/10 p-4 text-sm text-warn animate-slide-down" role="alert">
            <span>⚠️ {error}</span>
            <button
              onClick={() => refreshData(false)}
              className="font-bold underline hover:text-warn/80 cursor-pointer min-h-[44px] px-2"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {/* Conteúdo Principal com Tabela e Drawer */}
        {loading ? (
          <TableSkeleton />
        ) : (
          <div key={view} className="animate-fade-in">
            {view === "totals" ? (
              <TotalsTable
                rows={filteredTotals}
                onSelectMember={(row) => setSelectedMemberTotal(row)}
              />
            ) : (
              <DailyHistory days={filteredDays} />
            )}
          </div>
        )}
      </main>

      {/* Rodapé simples com status de sincronização */}
      <Footer
        lastRefreshed={lastRefreshed}
        onOpenTerms={() => setIsTermsOpen(true)}
      />

      {/* Modal de Termos LGPD (100% Responsivo) */}
      <PrivacyTermsModal
        isOpen={isTermsOpen}
        onClose={() => setIsTermsOpen(false)}
      />

      {/* Modal de Auditoria e Advertências do Tutor */}
      {user && (
        <TutorWarningModal
          isOpen={isTutorWarningOpen}
          onClose={() => setIsTutorWarningOpen(false)}
          members={members}
          sessions={sessions}
          tutorEmail={user.email ?? ""}
        />
      )}

      {/* Gaveta de detalhes do integrante */}
      <MemberDetailDrawer
        isOpen={Boolean(selectedMemberTotal)}
        member={selectedMemberTotal?.member ?? null}
        sessions={sessions}
        isPresent={Boolean(selectedMemberTotal?.present)}
        totalSeconds={selectedMemberTotal?.totalSeconds ?? 0}
        onClose={() => setSelectedMemberTotal(null)}
      />
    </div>
  );
}

