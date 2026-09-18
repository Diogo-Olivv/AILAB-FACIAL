import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { formatDuration, groupByDay, sessionSeconds, totalsByMember } from "../lib/aggregate";
import { Header } from "../components/Header";
import { PeriodSelector } from "../components/PeriodSelector";
import { TotalsTable } from "../components/TotalsTable";
import { DailyHistory } from "../components/DailyHistory";
import { PrivacyTermsModal } from "../components/PrivacyTermsModal";
import { MemberDetailDrawer } from "../components/MemberDetailDrawer";
import { TutorWarningModal } from "../components/TutorWarningModal";
import { TutorProfileModal } from "../components/TutorProfileModal";
import { ManualAttendanceModal } from "../components/ManualAttendanceModal";
import { Footer } from "../components/Footer";
import { ViewSelector } from "../components/ViewSelector";
import { KpiSkeleton, TableSkeleton } from "../components/TableSkeleton";
import { WeeklyChart } from "../components/WeeklyChart";
import { ExportButton } from "../components/ExportButton";
import { OfficialReportModal } from "../components/OfficialReportModal";

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
  const [searchInput, setSearchInput] = useState("");
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [view, setView] = useState<View>("totals");
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [now, setNow] = useState<Date>(() => new Date());

  // Ticker de 1 segundo para atualizar sessões em aberto em tempo real com fluidez
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Modais e Drawer
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [isTutorWarningOpen, setIsTutorWarningOpen] = useState(false);
  const [isTutorProfileOpen, setIsTutorProfileOpen] = useState(false);
  const [isManualAttendanceOpen, setIsManualAttendanceOpen] = useState(false);
  const [isOfficialReportOpen, setIsOfficialReportOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    try {
      const data = await fetchMembers();
      setMembers(data);
    } catch (e: any) {
      if (e?.message?.includes("JWT") || e?.message?.includes("expired")) {
        await supabase.auth.signOut();
        const retryData = await fetchMembers();
        setMembers(retryData);
        return;
      }
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível carregar a lista de integrantes do laboratório."
      );
    } finally {
      setLoading(false);
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
    if (members.length === 0) {
      setLoading(true);
    }
    refreshData(false);
  }, [refreshData, members.length]);

  // Polling a cada 30 segundos para manter os dados atualizados em tempo real no dashboard
  useEffect(() => {
    const timer = setInterval(() => {
      refreshData(true);
    }, 30000);
    return () => clearInterval(timer);
  }, [refreshData]);

  const totals = useMemo(() => {
    return totalsByMember(members, sessions, presentIds, now);
  }, [members, sessions, presentIds, now]);

  const days = useMemo(() => groupByDay(members, sessions, now), [members, sessions, now]);

  const selectedMemberTotal = useMemo(() => {
    if (!selectedMemberId) return null;
    return totals.find((t) => t.member.id === selectedMemberId) ?? null;
  }, [totals, selectedMemberId]);

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
    <div className="min-h-screen bg-transparent flex flex-col justify-between selection:bg-[#C15F3D]/20 text-[#171715]">
      {/* Linha sutil de carregamento superior em tempo real */}
      {isRefreshing && (
        <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-gradient-to-r from-transparent via-[#C15F3D] to-amber-500 animate-pulse" />
      )}

      {/* Cabeçalho limpo com contagem ao vivo e ações rápidas */}
      <Header
        user={user}
        signOut={signOut}
        onOpenTerms={() => setIsTermsOpen(true)}
        onRefresh={() => refreshData(false)}
        isRefreshing={isRefreshing}
        presentCount={presentCount}
      />

      <main className="flex-1 px-3 py-5 sm:px-6 md:px-8 max-w-6xl mx-auto w-full relative">
        <div className={`space-y-6 transition-opacity duration-300 ${isRefreshing ? "opacity-75" : "opacity-100"}`}>
        {/* Painel do Tutor estilo Claude Paper */}
        {user && (
          <div className="rounded-3xl border border-[#E5E2DC] dark:border-slate-800 bg-gradient-to-br from-[#FAF9F5] via-white to-amber-50/30 dark:from-slate-900/95 dark:via-slate-900/90 dark:to-amber-950/20 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shadow-[0_4px_24px_rgba(23,23,21,0.03)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)] animate-fade-in">
            <div className="flex items-center gap-3.5">
              {user.user_metadata?.avatar_url ? (
                <img
                  src={user.user_metadata.avatar_url}
                  alt="Foto do Tutor"
                  className="h-12 w-12 shrink-0 rounded-2xl object-cover ring-2 ring-[#C15F3D]/25 dark:ring-amber-500/30 shadow-2xs"
                />
              ) : (
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FAF5F0] dark:bg-amber-950/40 border border-[#F0DCD3] dark:border-amber-800/40 text-[#C15F3D] dark:text-amber-400 text-xl shadow-2xs">
                  🎓
                </span>
              )}
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-editorial text-lg sm:text-xl font-normal text-[#171715] dark:text-slate-100">
                    Painel da Tutoria
                  </h3>
                  <span className="font-mono-data rounded-md bg-white dark:bg-slate-800 border border-[#E5E2DC] dark:border-slate-700 px-2.5 py-0.5 text-2xs font-medium text-[#706E6A] dark:text-slate-300">
                    {user.email}
                  </span>
                </div>
                <p className="text-xs text-[#706E6A] dark:text-slate-400 font-sans mt-0.5">
                  Audite o cumprimento da meta semanal obrigatória de 4 horas e emita comunicados acadêmicos.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setIsManualAttendanceOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E2DC] dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs sm:text-sm font-medium text-[#171715] dark:text-slate-200 hover:bg-[#FAF9F5] dark:hover:bg-slate-700 hover:border-[#706E6A]/40 shadow-2xs active:scale-[0.98] transition-all cursor-pointer min-h-[42px]"
              >
                <span>📝</span>
                <span>Registrar Presença Manual</span>
              </button>

              <button
                type="button"
                onClick={() => setIsTutorProfileOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E2DC] dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs sm:text-sm font-medium text-[#171715] dark:text-slate-200 hover:bg-[#FAF9F5] dark:hover:bg-slate-700 hover:border-[#706E6A]/40 shadow-2xs active:scale-[0.98] transition-all cursor-pointer min-h-[42px]"
              >
                <span>⚙️</span>
                <span>Configurar Acesso (@ailab.com)</span>
              </button>

              <button
                type="button"
                onClick={() => setIsTutorWarningOpen(true)}
                className="inline-flex items-center gap-2 rounded-full bg-[#171715] dark:bg-white hover:bg-[#2A2925] dark:hover:bg-slate-100 px-4 py-2 text-xs sm:text-sm font-sans font-medium text-[#FAF9F5] dark:text-slate-900 shadow-sm active:scale-[0.98] transition-all cursor-pointer min-h-[42px]"
              >
                <span>⚠️</span>
                <span>Auditoria Semanal & Metas ({studentsUnderFourHoursCount})</span>
              </button>
            </div>
          </div>
        )}

        {/* KPI Cards com Cores Sutis e Sombras Delicadas */}
        {loading && members.length === 0 ? (
          <KpiSkeleton />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 animate-fade-in">
            {/* Presentes Agora */}
            <div className="group relative overflow-hidden rounded-3xl p-4 sm:p-5 border border-[#E5E2DC] dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl shadow-xs dark:shadow-[0_2px_12px_rgba(0,0,0,0.2)] hover:shadow-[0_12px_32px_rgba(5,150,105,0.18)] hover:border-emerald-300 dark:hover:border-emerald-700 hover:-translate-y-1 transition-all duration-300 ease-out min-h-[124px] flex flex-col justify-between">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-teal-500" />
              <div className="flex items-center justify-between">
                <span className="text-xs font-sans font-medium text-[#706E6A] dark:text-slate-400">
                  Presentes agora
                </span>
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs shadow-2xs group-hover:scale-110 transition-transform">
                  🟢
                </span>
              </div>
              <div className="mt-2.5 flex items-center gap-2">
                <span className="text-2xl sm:text-3xl font-semibold text-[#171715] dark:text-slate-100 font-mono-data tracking-tight leading-none">
                  {presentCount}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100/80 dark:bg-emerald-950/80 border border-emerald-300/80 dark:border-emerald-700/60 pl-2 pr-2.5 py-0.5 text-2xs font-semibold text-emerald-800 dark:text-emerald-300 font-sans shadow-2xs leading-none select-none">
                  <span className="relative flex h-2 w-2 items-center justify-center shrink-0">
                    <span className="absolute h-1.5 w-1.5 rounded-full bg-emerald-400 opacity-75 animate-live-ping" />
                    <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
                  </span>
                  <span className="leading-none">ao vivo</span>
                </span>
              </div>
              <p className="text-[11px] text-[#706E6A] dark:text-slate-400 mt-1.5 truncate">
                No laboratório agora
              </p>
            </div>

            {/* Total de Horas */}
            <div className="group relative overflow-hidden rounded-3xl p-4 sm:p-5 border border-[#E5E2DC] dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl shadow-xs dark:shadow-[0_2px_12px_rgba(0,0,0,0.2)] hover:shadow-[0_12px_32px_rgba(193,95,61,0.18)] hover:border-orange-300 dark:hover:border-orange-700 hover:-translate-y-1 transition-all duration-300 ease-out min-h-[124px] flex flex-col justify-between">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#C15F3D] to-orange-500" />
              <div className="flex items-center justify-between">
                <span className="text-xs font-sans font-medium text-[#706E6A] dark:text-slate-400">
                  Total de horas
                </span>
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-50 dark:bg-orange-950/60 border border-orange-200/80 dark:border-orange-800/60 text-[#C15F3D] dark:text-orange-400 text-xs shadow-2xs group-hover:scale-110 transition-transform">
                  ⏱️
                </span>
              </div>
              <div className="mt-2.5">
                <span className="text-xl sm:text-3xl font-semibold text-[#171715] dark:text-slate-100 font-mono-data tracking-tight">
                  {formatDuration(totalLabSeconds)}
                </span>
              </div>
              <p className="text-[11px] text-[#706E6A] dark:text-slate-400 mt-1 truncate">
                Acumuladas no período
              </p>
            </div>

            {/* Integrantes Ativos */}
            <div className="group relative overflow-hidden rounded-3xl p-4 sm:p-5 border border-[#E5E2DC] dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl shadow-xs dark:shadow-[0_2px_12px_rgba(0,0,0,0.2)] hover:shadow-[0_12px_32px_rgba(99,102,241,0.18)] hover:border-indigo-300 dark:hover:border-indigo-700 hover:-translate-y-1 transition-all duration-300 ease-out min-h-[124px] flex flex-col justify-between">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-500" />
              <div className="flex items-center justify-between">
                <span className="text-xs font-sans font-medium text-[#706E6A] dark:text-slate-400">
                  Integrantes ativos
                </span>
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800/60 text-indigo-800 dark:text-indigo-400 text-xs shadow-2xs group-hover:scale-110 transition-transform">
                  👥
                </span>
              </div>
              <div className="mt-2.5 flex items-baseline gap-1.5 sm:gap-2">
                <span className="text-2xl sm:text-3xl font-semibold text-[#171715] dark:text-slate-100 font-mono-data tracking-tight">
                  {activeMembersCount}
                </span>
                <span className="text-2xs font-mono-data text-[#706E6A] dark:text-slate-400">de {members.length}</span>
              </div>
              <p className="text-[11px] text-[#706E6A] dark:text-slate-400 mt-1 truncate">
                Com presença no filtro
              </p>
            </div>

            {/* Total de Sessões */}
            <div className="group relative overflow-hidden rounded-3xl p-4 sm:p-5 border border-[#E5E2DC] dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl shadow-xs dark:shadow-[0_2px_12px_rgba(0,0,0,0.2)] hover:shadow-[0_12px_32px_rgba(217,119,6,0.18)] hover:border-amber-300 dark:hover:border-amber-700 hover:-translate-y-1 transition-all duration-300 ease-out min-h-[124px] flex flex-col justify-between">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 to-yellow-500" />
              <div className="flex items-center justify-between">
                <span className="text-xs font-sans font-medium text-[#706E6A] dark:text-slate-400">
                  Total de sessões
                </span>
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200/80 dark:border-amber-800/60 text-amber-800 dark:text-amber-400 text-xs shadow-2xs group-hover:scale-110 transition-transform">
                  📌
                </span>
              </div>
              <div className="mt-2.5">
                <span className="text-2xl sm:text-3xl font-semibold text-[#171715] dark:text-slate-100 font-mono-data tracking-tight">
                  {totalSessionsCount}
                </span>
              </div>
              <p className="text-[11px] text-[#706E6A] dark:text-slate-400 mt-1 truncate">
                Registros computados
              </p>
            </div>
          </div>
        )}

        {/* Controles de Período, Visualização e Busca */}
        <div className="space-y-3">
          <PeriodSelector
            period={period}
            range={range}
            onPeriod={(p) => {
              setPeriod(p);
              if (p !== "custom") {
                setCustomFrom("");
                setCustomTo("");
              }
            }}
            customFrom={customFrom}
            customTo={customTo}
            onCustomRange={(from, to) => {
              setCustomFrom(from);
              setCustomTo(to);
            }}
          />

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-3xl p-3 sm:p-3.5 border border-[#E5E2DC] dark:border-slate-800 bg-white/85 dark:bg-slate-900/90 backdrop-blur-xl shadow-[0_4px_20px_rgba(23,23,21,0.02)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] transition-all duration-300">
            {/* Segmented control de visualizações */}
            <ViewSelector view={view} onViewChange={setView} />

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {/* Campo de Busca Reativa com debounce de 150ms */}
              <div className="relative flex-1 sm:w-80 group">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-[#706E6A] dark:text-slate-400 group-focus-within:text-[#C15F3D] transition-colors">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                </div>
                <input
                  key="search-main"
                  type="text"
                  value={searchInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSearchInput(val);
                    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
                    searchDebounceRef.current = setTimeout(() => setSearchQuery(val), 150);
                  }}
                  placeholder="Buscar integrante ou matrícula..."
                  className="w-full h-11 rounded-2xl border border-[#E5E2DC] dark:border-slate-700 bg-[#FAF9F5] dark:bg-slate-950/60 py-2.5 pl-10 pr-9 text-xs sm:text-sm text-[#171715] dark:text-slate-100 placeholder:text-[#706E6A]/60 dark:placeholder:text-slate-500 font-sans font-medium focus:border-[#C15F3D] focus:bg-white dark:focus:bg-slate-950 focus:outline-none focus:ring-4 focus:ring-[#C15F3D]/10 transition-all"
                  aria-label="Buscar integrantes por nome ou matrícula"
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={() => { setSearchInput(""); setSearchQuery(""); }}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-[#706E6A] dark:text-slate-400 hover:text-[#171715] dark:hover:text-white cursor-pointer"
                    aria-label="Limpar busca"
                  >
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#E5E2DC] dark:bg-slate-700 text-[10px] font-bold text-[#171715] dark:text-slate-200 hover:bg-[#D5D2CC]">
                      ✕
                    </span>
                  </button>
                )}
              </div>

              {/* Botões de Exportação CSV e Relatório Oficial PDF */}
              <div className="flex items-center gap-1.5 shrink-0">
                <ExportButton rows={filteredTotals} range={range} period={period} />
                <button
                  type="button"
                  onClick={() => setIsOfficialReportOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-2xl border border-[#E5E2DC] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 sm:px-3.5 py-2 text-xs font-semibold text-[#171715] dark:text-slate-200 hover:bg-[#FAF9F5] dark:hover:bg-slate-700 hover:border-[#C15F3D]/40 shadow-2xs active:scale-[0.98] transition-all cursor-pointer min-h-[42px]"
                  title="Gerar Relatório Oficial com Certificação SHA-256 e PDF"
                >
                  <span>📑</span>
                  <span className="hidden sm:inline">Relatório Oficial (PDF)</span>
                  <span className="sm:hidden">PDF</span>
                </button>
              </div>
            </div>
          </div>

          {/* Gráfico de Distribuição Semanal */}
          {!loading && totals.length > 0 && (
            <WeeklyChart rows={filteredTotals} range={range} />
          )}
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
        {loading && members.length === 0 ? (
          <TableSkeleton />
        ) : (
          <div key={view} className="animate-fade-in">
            {view === "totals" ? (
              <TotalsTable
                rows={filteredTotals}
                onSelectMember={(row) => setSelectedMemberId(row.member.id)}
              />
            ) : (
              <DailyHistory days={filteredDays} />
            )}
          </div>
        )}
        </div>
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

      {/* Modal de Configuração de Credenciais do Tutor (@ailab.com) */}
      {user && (
        <TutorProfileModal
          isOpen={isTutorProfileOpen}
          onClose={() => setIsTutorProfileOpen(false)}
        />
      )}

      {/* Modal de Registro Manual de Presença (contingência lista de papel) */}
      {user && (
        <ManualAttendanceModal
          isOpen={isManualAttendanceOpen}
          onClose={() => setIsManualAttendanceOpen(false)}
          members={members}
          onRegistered={async () => {
            await refreshData(true);
          }}
        />
      )}

      {/* Modal de Relatório Oficial de Frequência e Impressão PDF */}
      <OfficialReportModal
        isOpen={isOfficialReportOpen}
        onClose={() => setIsOfficialReportOpen(false)}
        rows={filteredTotals}
        range={range}
        period={period}
        tutorEmail={user?.email}
      />

      {/* Gaveta de detalhes do integrante */}
      <MemberDetailDrawer
        isOpen={Boolean(selectedMemberTotal)}
        member={selectedMemberTotal?.member ?? null}
        sessions={sessions}
        isPresent={Boolean(selectedMemberTotal?.present)}
        totalSeconds={selectedMemberTotal?.totalSeconds ?? 0}
        onClose={() => setSelectedMemberId(null)}
        onSessionUpdated={async () => {
          await Promise.all([loadMembers(), refreshData(true)]);
        }}
        onMemberRemoved={async () => {
          setSelectedMemberId(null);
          await loadMembers();
          await refreshData(true);
        }}
      />
    </div>
  );
}

