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
import { formatDuration, groupByDay, sessionSeconds, totalsByMember } from "../lib/aggregate";
import { Header } from "../components/Header";
import { PeriodSelector } from "../components/PeriodSelector";
import { TotalsTable } from "../components/TotalsTable";
import { DailyHistory } from "../components/DailyHistory";
import { PrivacyTermsModal } from "../components/PrivacyTermsModal";
import { MemberDetailDrawer } from "../components/MemberDetailDrawer";
import { TutorWarningModal } from "../components/TutorWarningModal";
import { TutorProfileModal } from "../components/TutorProfileModal";
import { Footer } from "../components/Footer";
import { ViewSelector } from "../components/ViewSelector";
import { KpiSkeleton, TableSkeleton } from "../components/TableSkeleton";

type View = "totals" | "history";

export function Dashboard() {
  const { user, signOut } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [presentIds, setPresentIds] = useState<string[]>([]);
  const [period, setPeriod] = useState<PeriodKey>("week");
  const [searchQuery, setSearchQuery] = useState("");
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
    () => rangeFor(period),
    [period],
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
          <div className="rounded-3xl border border-[#E5E2DC] bg-[#FAF9F5] p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shadow-[0_4px_24px_rgba(23,23,21,0.03)] animate-fade-in">
            <div className="flex items-center gap-3.5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FAF5F0] border border-[#F0DCD3] text-[#C15F3D] text-xl shadow-2xs">
                🎓
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-editorial text-lg sm:text-xl font-normal text-[#171715]">
                    Painel da Tutoria
                  </h3>
                  <span className="font-mono-data rounded-md bg-white border border-[#E5E2DC] px-2.5 py-0.5 text-2xs font-medium text-[#706E6A]">
                    {user.email}
                  </span>
                </div>
                <p className="text-xs text-[#706E6A] font-sans mt-0.5">
                  Audite o cumprimento da meta semanal obrigatória de 4 horas e emita comunicados acadêmicos.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setIsTutorProfileOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E2DC] bg-white px-4 py-2 text-xs sm:text-sm font-medium text-[#171715] hover:bg-[#FAF9F5] hover:border-[#706E6A]/40 shadow-2xs active:scale-[0.98] transition-all cursor-pointer min-h-[42px]"
              >
                <span>⚙️</span>
                <span>Configurar Acesso (@ailab.com)</span>
              </button>

              <button
                type="button"
                onClick={() => setIsTutorWarningOpen(true)}
                className="inline-flex items-center gap-2 rounded-full bg-[#171715] hover:bg-[#2A2925] px-4 py-2 text-xs sm:text-sm font-sans font-medium text-[#FAF9F5] shadow-sm active:scale-[0.98] transition-all cursor-pointer min-h-[42px]"
              >
                <span>⚠️</span>
                <span>Auditoria Semanal & Metas ({studentsUnderFourHoursCount})</span>
              </button>
            </div>
          </div>
        )}

        {/* KPI Cards de Resumo com Tipografia Claude & Perplexity */}
        {loading && members.length === 0 ? (
          <KpiSkeleton />
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-4 animate-fade-in">
            {/* Presentes Agora */}
            <div className="rounded-3xl p-4 sm:p-5 border border-[#E5E2DC] bg-white/85 shadow-[0_4px_20px_rgba(23,23,21,0.03)] hover:border-[#706E6A]/30 transition-all duration-300">
              <div className="flex items-center justify-between">
                <span className="text-xs font-sans font-medium text-[#706E6A]">
                  Presentes agora
                </span>
                <span className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs shadow-2xs">
                  🟢
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-2xl sm:text-3xl font-semibold text-[#171715] font-mono-data tracking-tight leading-none">
                  {presentCount}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-300/80 px-2 py-0.5 text-2xs font-semibold text-emerald-800 font-sans shadow-2xs leading-none">
                  <span className="relative flex h-2 w-2 items-center justify-center">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-600" />
                  </span>
                  <span>ao vivo</span>
                </span>
              </div>
              <p className="text-[11px] text-[#706E6A] mt-1.5 truncate">No laboratório</p>
            </div>

            {/* Total de Horas */}
            <div className="rounded-3xl p-4 sm:p-5 border border-[#E5E2DC] bg-white/85 shadow-[0_4px_20px_rgba(23,23,21,0.03)] hover:border-[#706E6A]/30 transition-all duration-300">
              <div className="flex items-center justify-between">
                <span className="text-xs font-sans font-medium text-[#706E6A]">
                  Total de horas
                </span>
                <span className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-xl bg-blue-50 border border-blue-200/80 text-blue-800 text-xs shadow-2xs">
                  ⏱️
                </span>
              </div>
              <div className="mt-2.5">
                <span className="text-xl sm:text-3xl font-semibold text-[#171715] font-mono-data tracking-tight">
                  {formatDuration(totalLabSeconds)}
                </span>
              </div>
              <p className="text-[11px] text-[#706E6A] mt-1 truncate">Acumuladas no período</p>
            </div>

            {/* Integrantes Ativos */}
            <div className="rounded-3xl p-4 sm:p-5 border border-[#E5E2DC] bg-white/85 shadow-[0_4px_20px_rgba(23,23,21,0.03)] hover:border-[#706E6A]/30 transition-all duration-300">
              <div className="flex items-center justify-between">
                <span className="text-xs font-sans font-medium text-[#706E6A]">
                  Integrantes ativos
                </span>
                <span className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-xl bg-purple-50 border border-purple-200/80 text-purple-800 text-xs shadow-2xs">
                  👥
                </span>
              </div>
              <div className="mt-2.5 flex items-baseline gap-1.5 sm:gap-2">
                <span className="text-2xl sm:text-3xl font-semibold text-[#171715] font-mono-data tracking-tight">
                  {activeMembersCount}
                </span>
                <span className="text-2xs font-mono-data text-[#706E6A]">de {members.length}</span>
              </div>
              <p className="text-[11px] text-[#706E6A] mt-1 truncate">Integrantes com registro</p>
            </div>

            {/* Total de Sessões */}
            <div className="rounded-3xl p-4 sm:p-5 border border-[#E5E2DC] bg-white/85 shadow-[0_4px_20px_rgba(23,23,21,0.03)] hover:border-[#706E6A]/30 transition-all duration-300">
              <div className="flex items-center justify-between">
                <span className="text-xs font-sans font-medium text-[#706E6A]">
                  Total de sessões
                </span>
                <span className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-xl bg-amber-50 border border-amber-200/80 text-amber-800 text-xs shadow-2xs">
                  📌
                </span>
              </div>
              <div className="mt-2.5">
                <span className="text-2xl sm:text-3xl font-semibold text-[#171715] font-mono-data tracking-tight">
                  {totalSessionsCount}
                </span>
              </div>
              <p className="text-[11px] text-[#706E6A] mt-1 truncate">Registros válidos</p>
            </div>
          </div>
        )}

        {/* Controles de Período, Visualização e Busca perfeitamente simétricos */}
        <div className="space-y-3">
          <PeriodSelector
            period={period}
            range={range}
            onPeriod={setPeriod}
          />

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-3xl p-3 sm:p-3.5 border border-[#E5E2DC] bg-white/85 backdrop-blur-xl shadow-[0_4px_20px_rgba(23,23,21,0.02)] transition-all duration-300">
            {/* Segmented control de visualizações */}
            <ViewSelector view={view} onViewChange={setView} />

            {/* Campo de Busca Reativa estilo Perplexity Command Bar */}
            <div className="relative w-full sm:w-80 group">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-[#706E6A] group-focus-within:text-[#C15F3D] transition-colors">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar integrante ou matrícula..."
                className="w-full h-11 rounded-2xl border border-[#E5E2DC] bg-[#FAF9F5] py-2.5 pl-10 pr-9 text-xs sm:text-sm text-[#171715] placeholder:text-[#706E6A]/60 font-sans font-medium focus:border-[#C15F3D] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#C15F3D]/10 transition-all"
                aria-label="Buscar integrantes por nome ou matrícula"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-[#706E6A] hover:text-[#171715] cursor-pointer"
                  aria-label="Limpar busca"
                >
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#E5E2DC] text-[10px] font-bold text-[#171715] hover:bg-[#D5D2CC]">
                    ✕
                  </span>
                </button>
              )}
            </div>
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

      {/* Gaveta de detalhes do integrante */}
      <MemberDetailDrawer
        isOpen={Boolean(selectedMemberTotal)}
        member={selectedMemberTotal?.member ?? null}
        sessions={sessions}
        isPresent={Boolean(selectedMemberTotal?.present)}
        totalSeconds={selectedMemberTotal?.totalSeconds ?? 0}
        onClose={() => setSelectedMemberId(null)}
        onSessionUpdated={() => refreshData(true)}
        onMemberRemoved={async () => {
          setSelectedMemberId(null);
          await loadMembers();
          await refreshData(true);
        }}
      />
    </div>
  );
}

