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
import { formatDuration, groupByDay, totalsByMember, type MemberTotal } from "../lib/aggregate";
import { Header } from "../components/Header";
import { PeriodSelector } from "../components/PeriodSelector";
import { MemberSelector } from "../components/MemberSelector";
import { TotalsTable } from "../components/TotalsTable";
import { DailyHistory } from "../components/DailyHistory";
import { PrivacyTermsModal } from "../components/PrivacyTermsModal";
import { MemberDetailDrawer } from "../components/MemberDetailDrawer";
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
  const [memberId, setMemberId] = useState("");
  const [view, setView] = useState<View>("totals");
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // Modais e Drawer
  const [isTermsOpen, setIsTermsOpen] = useState(false);
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

      <main className="flex-1 px-4 py-8 md:px-8 space-y-6 max-w-6xl mx-auto w-full">
        {/* Título da Seção e Botão de Atualização */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-navy/10 px-2.5 py-0.5 text-xs font-bold text-navy">
                Presença em Tempo Real
              </span>
              <span className="text-xs text-muted">· {members.length} integrantes cadastrados</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink mt-1">
              Tempo de Permanência & Frequência
            </h2>
          </div>

          <button
            onClick={() => refreshData(false)}
            disabled={isRefreshing}
            title="Atualizar dados de permanência agora"
            className="inline-flex items-center gap-2 rounded-xl border border-navy/15 bg-card px-3.5 py-2 text-xs sm:text-sm font-semibold text-navy shadow-2xs transition-all hover:bg-navy/5 active:scale-95 disabled:opacity-60 cursor-pointer min-h-[44px]"
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
            <span>{isRefreshing ? "Sincronizando..." : "Atualizar Tabela"}</span>
          </button>
        </div>

        {/* KPI Cards de Resumo */}
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

        {/* Filtros e Alternância de Visualização */}
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
          <MemberSelector members={members} selected={memberId} onSelect={setMemberId} />
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
                rows={totals}
                onSelectMember={(row) => setSelectedMemberTotal(row)}
              />
            ) : (
              <DailyHistory days={days} />
            )}
          </div>
        )}
      </main>

      {/* Rodapé simples com status de sincronização */}
      <Footer
        lastRefreshed={lastRefreshed}
        onOpenTerms={() => setIsTermsOpen(true)}
      />

      {/* Modal de Termos LGPD */}
      <PrivacyTermsModal
        isOpen={isTermsOpen}
        onClose={() => setIsTermsOpen(false)}
      />

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
