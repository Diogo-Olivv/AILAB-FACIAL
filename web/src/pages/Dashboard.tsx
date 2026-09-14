import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/useAuth";
import {
  fetchMembers,
  fetchPresentIds,
  fetchSessions,
  type Member,
  type SessionRecord,
} from "../lib/reports";
import { rangeFor, type PeriodKey } from "../lib/period";
import { formatDuration, groupByDay, totalsByMember } from "../lib/aggregate";
import { PeriodSelector } from "../components/PeriodSelector";
import { MemberSelector } from "../components/MemberSelector";
import { TotalsTable } from "../components/TotalsTable";
import { DailyHistory } from "../components/DailyHistory";
import { KpiSkeleton, TableSkeleton } from "../components/TableSkeleton";
import logo from "../ailab_makers.jpeg";

type View = "totals" | "history";

export function Dashboard() {
  const { signOut } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [presentIds, setPresentIds] = useState<string[]>([]);
  const [period, setPeriod] = useState<PeriodKey>("week");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [memberId, setMemberId] = useState("");
  const [view, setView] = useState<View>("totals");
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  useEffect(() => {
    fetchMembers()
      .then(setMembers)
      .catch((e) => setError(e instanceof Error ? e.message : "Falha ao carregar integrantes."));
  }, []);

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
      } catch (e) {
        setError(e instanceof Error ? e.message : "Falha ao carregar dados.");
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

  const filtered = useMemo(
    () => (memberId ? sessions.filter((s) => s.profileId === memberId) : sessions),
    [sessions, memberId],
  );

  const totals = useMemo(() => {
    const scope = memberId ? members.filter((m) => m.id === memberId) : members;
    return totalsByMember(scope, filtered, presentIds, new Date());
  }, [members, filtered, presentIds, memberId]);

  const days = useMemo(() => groupByDay(members, filtered, new Date()), [members, filtered]);

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
  const totalSessionsCount = useMemo(() => filtered.length, [filtered]);

  return (
    <div className="min-h-screen bg-cream px-4 py-8 md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header com branding, status e ações */}
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-line bg-card/80 p-5 backdrop-blur-md shadow-xs">
          <div className="flex items-center gap-3.5">
            <img
              src={logo}
              alt="Maker Foundation"
              className="h-14 w-14 rounded-2xl border-2 border-line/60 object-cover shadow-2xs"
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink">
                  Tempo de permanência
                </h1>
                <span className="hidden sm:inline-block rounded-full bg-green/15 px-2 py-0.5 text-xs font-semibold text-green">
                  AiLab
                </span>
              </div>
              <p className="text-xs sm:text-sm text-muted">
                Painel inteligente de acompanhamento e frequência do laboratório.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => refreshData(false)}
              disabled={isRefreshing}
              title="Atualizar dados agora"
              className="inline-flex items-center gap-2 rounded-xl border border-navy/15 bg-card px-3.5 py-2 text-sm font-medium text-navy shadow-2xs transition-all hover:bg-navy/5 active:scale-95 disabled:opacity-60 cursor-pointer"
            >
              <svg
                className={`h-4 w-4 transition-transform ${isRefreshing ? "animate-spin text-green" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <span className="hidden sm:inline">
                {isRefreshing ? "Atualizando..." : "Atualizar"}
              </span>
            </button>
            <button
              onClick={signOut}
              className="rounded-xl border border-warn/20 bg-warn/10 px-4 py-2 text-sm font-medium text-warn transition-all hover:bg-warn/20 active:scale-95 shadow-2xs cursor-pointer"
            >
              Sair
            </button>
          </div>
        </header>

        {/* KPI Cards de Resumo */}
        {loading ? (
          <KpiSkeleton />
        ) : (
          <section className="grid grid-cols-2 gap-3.5 sm:grid-cols-4 sm:gap-4 animate-fade-in">
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
                <span className="text-3xl font-bold text-ink">{presentCount}</span>
                <span className="text-xs font-semibold text-green">ao vivo</span>
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
                <span className="text-2xl sm:text-3xl font-bold text-ink">
                  {formatDuration(totalLabSeconds)}
                </span>
              </div>
              <p className="text-xs text-muted mt-1">acumulado no período</p>
            </div>

            {/* Integrantes Ativos */}
            <div className="rounded-2xl border border-line bg-card p-4 sm:p-5 shadow-2xs transition-all duration-200 hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Ativos
                </span>
                <span className="text-sm">👥</span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-bold text-ink">{activeMembersCount}</span>
                <span className="text-xs text-muted">de {members.length}</span>
              </div>
              <p className="text-xs text-muted mt-1">integrantes com presença</p>
            </div>

            {/* Total de Sessões */}
            <div className="rounded-2xl border border-line bg-card p-4 sm:p-5 shadow-2xs transition-all duration-200 hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Sessões
                </span>
                <span className="text-sm">📌</span>
              </div>
              <div className="mt-2">
                <span className="text-3xl font-bold text-ink">{totalSessionsCount}</span>
              </div>
              <p className="text-xs text-muted mt-1">registros no período</p>
            </div>
          </section>
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

        {/* Filtros e Alternância de Visualização */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-card p-3 shadow-2xs">
          <div className="flex gap-2">
            <button
              onClick={() => setView("totals")}
              className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 active:scale-95 cursor-pointer ${
                view === "totals"
                  ? "bg-navy text-white shadow-sm ring-2 ring-navy/20"
                  : "border border-line bg-card text-muted hover:text-ink hover:bg-navy/5"
              }`}
            >
              Totais por Integrante
            </button>
            <button
              onClick={() => setView("history")}
              className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 active:scale-95 cursor-pointer ${
                view === "history"
                  ? "bg-navy text-white shadow-sm ring-2 ring-navy/20"
                  : "border border-line bg-card text-muted hover:text-ink hover:bg-navy/5"
              }`}
            >
              Histórico Diário
            </button>
          </div>
          <MemberSelector members={members} selected={memberId} onSelect={setMemberId} />
        </div>

        {/* Alerta de Erro */}
        {error && (
          <div className="flex items-center justify-between rounded-2xl border border-warn/30 bg-warn/10 p-4 text-sm text-warn animate-slide-down">
            <span>⚠️ {error}</span>
            <button
              onClick={() => refreshData(false)}
              className="font-semibold underline hover:text-warn/80"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {/* Conteúdo Principal com Animação */}
        {loading ? (
          <TableSkeleton />
        ) : (
          <div key={view} className="animate-fade-in">
            {view === "totals" ? (
              <TotalsTable rows={totals} />
            ) : (
              <DailyHistory days={days} />
            )}
          </div>
        )}

        {/* Rodapé com timestamp de sincronização */}
        <footer className="pt-2 text-center text-xs text-muted flex items-center justify-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-green" />
          Sincronizado às {lastRefreshed.toLocaleTimeString("pt-BR")} (atualização automática a cada 30s)
        </footer>
      </div>
    </div>
  );
}
