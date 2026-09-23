import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  GraduationCap,
  UserPlus,
  SlidersHorizontal,
  Hourglass,
  Radio,
  UserCheck,
  Layers,
  FileText,
  AlertCircle,
  X,
  LayoutDashboard,
  ShieldCheck,
  FileSpreadsheet,
  Search,
  Sparkles,
  SunMedium,
  Coffee,
} from "lucide-react";
import { useAuth } from "../auth/useAuth";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import {
  fetchMembers,
  fetchPresentIds,
  fetchSessions,
  type Member,
  type SessionRecord,
} from "../lib/reports";
import { rangeFor, type PeriodKey } from "../lib/period";
import {
  formatDuration,
  groupByDay,
  sessionSeconds,
  totalsByMember,
  filterWeekdaySessions,
  calculateOccupancyInsights,
} from "../lib/aggregate";
import { Header } from "../components/Header";
import { PeriodSelector } from "../components/PeriodSelector";
import { TotalsTable } from "../components/TotalsTable";
import { DailyHistory } from "../components/DailyHistory";
import { MemberDetailDrawer } from "../components/MemberDetailDrawer";
import { PrivacyTermsModal } from "../components/PrivacyTermsModal";
import { ManualAttendanceModal } from "../components/ManualAttendanceModal";
import { TutorWarningModal, TutorWarningPanel } from "../components/TutorWarningModal";
import { TutorProfileModal } from "../components/TutorProfileModal";
import { Footer } from "../components/Footer";
import { ViewSelector } from "../components/ViewSelector";
import { KpiSkeleton, TableSkeleton } from "../components/TableSkeleton";
import { WeeklyChart } from "../components/WeeklyChart";
import { TutorInsightsCard } from "../components/TutorInsightsCard";
import { ExportButton } from "../components/ExportButton";
import { OfficialReportModal } from "../components/OfficialReportModal";

type View = "totals" | "history";
type TutorTab = "overview" | "audit" | "records";

export function Dashboard() {
  const { user, signOut } = useAuth();
  const [searchParams] = useSearchParams();
  const isStudentView = searchParams.get("mode") === "student";
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
  const [tutorTab, setTutorTab] = useState<TutorTab>("overview");
  const tutorTabContainerRef = useRef<HTMLDivElement>(null);
  const [isTutorTabDragging, setIsTutorTabDragging] = useState(false);
  const [tutorTabDragLeftPx, setTutorTabDragLeftPx] = useState<number | null>(null);
  const tutorTabDragRef = useRef<{
    startX: number;
    startY: number;
    initialLeft: number;
    pointerId: number;
    isDragging: boolean;
  } | null>(null);
  const tutorTabJustDraggedRef = useRef(false);

  const tutorTabsList: TutorTab[] = ["overview", "audit", "records"];
  const tutorTabIndex = Math.max(0, tutorTabsList.indexOf(tutorTab));

  const handleTutorTabPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!tutorTabContainerRef.current) return;
    const rect = tutorTabContainerRef.current.getBoundingClientRect();
    const padding = 4;
    const usableWidth = Math.max(rect.width - padding * 2, 1);
    const pillWidth = usableWidth / 3;
    const maxLeft = usableWidth - pillWidth;

    const currentPillLeft = tutorTabIndex * pillWidth;
    const touchX = e.clientX - rect.left - padding;
    const isTouchNearPill =
      touchX >= currentPillLeft - 12 && touchX <= currentPillLeft + pillWidth + 12;

    const initialLeft = isTouchNearPill
      ? currentPillLeft
      : Math.max(0, Math.min(touchX - pillWidth / 2, maxLeft));

    tutorTabDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialLeft,
      pointerId: e.pointerId,
      isDragging: false,
    };
  };

  const handleTutorTabPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = tutorTabDragRef.current;
    if (!drag || !tutorTabContainerRef.current) return;

    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;

    if (!drag.isDragging) {
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 7) {
        tutorTabDragRef.current = null;
        return;
      }
      if (Math.abs(dx) >= 7) {
        drag.isDragging = true;
        setIsTutorTabDragging(true);
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {}
      } else {
        return;
      }
    }

    const rect = tutorTabContainerRef.current.getBoundingClientRect();
    const padding = 4;
    const usableWidth = Math.max(rect.width - padding * 2, 1);
    const pillWidth = usableWidth / 3;
    const maxLeft = usableWidth - pillWidth;

    const currentLeft = Math.max(0, Math.min(drag.initialLeft + dx, maxLeft));
    setTutorTabDragLeftPx(currentLeft);

    // Atualização imediata em tempo real durante o arraste
    const targetIndex = Math.min(2, Math.max(0, Math.round(currentLeft / pillWidth)));
    const targetTab = tutorTabsList[targetIndex];
    if (targetTab && targetTab !== tutorTab) {
      setTutorTab(targetTab);
    }
  };

  const handleTutorTabPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = tutorTabDragRef.current;
    if (drag?.isDragging) {
      tutorTabJustDraggedRef.current = true;
      setTimeout(() => {
        tutorTabJustDraggedRef.current = false;
      }, 50);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
      setIsTutorTabDragging(false);
      setTutorTabDragLeftPx(null);
    }
    tutorTabDragRef.current = null;
  };

  const handleTutorTabPointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = tutorTabDragRef.current;
    if (drag?.isDragging) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
      setIsTutorTabDragging(false);
      setTutorTabDragLeftPx(null);
    }
    tutorTabDragRef.current = null;
  };
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [now, setNow] = useState<Date>(() => new Date());

  // Modais e gavetas
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [isTutorWarningOpen, setIsTutorWarningOpen] = useState(false);
  const [isTutorProfileOpen, setIsTutorProfileOpen] = useState(false);
  const [isManualAttendanceOpen, setIsManualAttendanceOpen] = useState(false);
  const [isOfficialReportOpen, setIsOfficialReportOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  // Ticker de 1 segundo para atualizar sessões em aberto em tempo real com fluidez
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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

  // Filtro Temporal de Dias Úteis: processa exclusivamente registros de Segunda a Sexta-feira
  const weekdaySessions = useMemo(() => {
    return filterWeekdaySessions(sessions);
  }, [sessions]);

  const totals = useMemo(() => {
    return totalsByMember(members, weekdaySessions, presentIds, now);
  }, [members, weekdaySessions, presentIds, now]);

  const days = useMemo(() => groupByDay(members, weekdaySessions, now), [members, weekdaySessions, now]);

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
      .map((d) => ({
        ...d,
        entries: d.entries.filter(
          (s) => s.memberName.toLowerCase().includes(q)
        ),
      }))
      .filter((d) => d.entries.length > 0);
  }, [days, searchQuery]);

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setSearchQuery(value);
    }, 200);
  };

  const clearSearch = () => {
    setSearchInput("");
    setSearchQuery("");
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
  };

  // Métricas agregadas
  const presentCount = presentIds.length;
  const totalLabSeconds = useMemo(
    () => totals.reduce((acc, t) => acc + t.totalSeconds, 0),
    [totals],
  );
  const activeMembersCount = useMemo(
    () => totals.filter((t) => t.totalSeconds > 0).length,
    [totals],
  );
  const totalSessionsCount = useMemo(
    () => totals.reduce((acc, t) => acc + t.sessionCount, 0),
    [totals],
  );

  // Lista de integrantes que estão no laboratório agora
  const presentMembers = useMemo(() => {
    return totals.filter((t) => t.present);
  }, [totals]);

  // Total de alunos com menos de 4 horas no período selecionado (dias úteis)
  const studentsUnderFourHoursCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of members) map.set(m.id, 0);
    for (const s of weekdaySessions) {
      if (s.voidedAt != null) continue;
      map.set(s.profileId, (map.get(s.profileId) ?? 0) + sessionSeconds(s, now));
    }
    return members.filter((m) => (map.get(m.id) ?? 0) < 4 * 3600).length;
  }, [members, weekdaySessions, now]);

  // Insights analíticos de ocupação e horários de estudo
  const occupancyInsights = useMemo(() => {
    return calculateOccupancyInsights(sessions, presentCount, now);
  }, [sessions, presentCount, now]);

  return (
    <div className="min-h-screen bg-transparent flex flex-col justify-between selection:bg-[#C15F3D]/20 text-[#171715] transition-colors duration-300">
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

          {/* ── 1. Painel do Tutor (Quando autenticado) ── */}
          {user && !isStudentView ? (
            <div className="space-y-4 animate-fade-in-up">
              {/* Card Unificado de Workspace do Tutor */}
              <div className="rounded-3xl border border-[#E5E2DC] dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shadow-xs transition-all duration-300 hover:shadow-sm">
                <div className="flex items-center gap-3.5">
                  {user.user_metadata?.avatar_url ? (
                    <img
                      src={user.user_metadata.avatar_url}
                      alt="Foto do Tutor"
                      className="h-11 w-11 shrink-0 rounded-2xl object-cover ring-2 ring-[#C15F3D]/25 dark:ring-amber-500/30 shadow-2xs"
                    />
                  ) : (
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FAF5F0] dark:bg-amber-950/40 border border-[#F0DCD3] dark:border-amber-800/40 text-[#C15F3D] dark:text-amber-400 text-lg shadow-2xs">
                      <GraduationCap className="h-5 w-5 text-amber-500" />
                    </span>
                  )}
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-editorial text-lg sm:text-xl font-normal text-[#171715] dark:text-slate-100">
                        Painel da Tutoria
                      </h2>
                      <span className="font-mono-data rounded-md bg-stone-100 dark:bg-slate-800 border border-stone-200 dark:border-slate-700 px-2 py-0.5 text-2xs text-[#57534E] dark:text-slate-300">
                        {user.email ? user.email.replace(/@ailab\.com$/i, "") : "Tutor"}
                      </span>
                    </div>
                    <p className="text-xs text-[#57534E] dark:text-slate-400 font-sans mt-0.5">
                      Auditoria semanal de 4 horas, relatórios de permanência e gestão do laboratório.
                    </p>
                  </div>
                </div>

                {/* Ações Rápidas do Workspace do Tutor */}
                <div className="grid grid-cols-2 gap-2 w-full sm:w-auto sm:flex sm:items-center">
                  <button
                    type="button"
                    onClick={() => setIsManualAttendanceOpen(true)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-full border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-medium text-[#171715] dark:text-slate-200 hover:bg-[#FAF9F5] dark:hover:bg-slate-700 hover:border-[#C15F3D]/40 shadow-2xs hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 cursor-pointer min-h-[40px] text-center"
                  >
                    <UserPlus className="h-3.5 w-3.5 text-[#C15F3D] dark:text-amber-400 shrink-0" />
                    <span className="truncate">+ Presença Manual</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsTutorProfileOpen(true)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-full border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-medium text-[#171715] dark:text-slate-200 hover:bg-[#FAF9F5] dark:hover:bg-slate-700 hover:border-stone-400 shadow-2xs hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 cursor-pointer min-h-[40px] text-center"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5 text-stone-600 dark:text-slate-300 shrink-0" />
                    <span className="truncate">Acesso @ailab.com</span>
                  </button>
                </div>
              </div>

              {/* Segmented Control Fluido Estilo iOS com Arraste (Drag) para as Abas do Tutor */}
              <div
                ref={tutorTabContainerRef}
                onPointerDown={handleTutorTabPointerDown}
                onPointerMove={handleTutorTabPointerMove}
                onPointerUp={handleTutorTabPointerUp}
                onPointerCancel={handleTutorTabPointerCancel}
                className="relative w-full sm:w-[560px] h-11 p-1 bg-[#FAF9F5] dark:bg-slate-800/80 rounded-2xl border border-[#E5E2DC] dark:border-slate-700 backdrop-blur-md shadow-2xs select-none touch-pan-y cursor-grab active:cursor-grabbing"
              >
                {/* Pílula deslizante fluida iOS */}
                <div
                  className={`absolute top-1 bottom-1 rounded-xl bg-white dark:bg-slate-900 shadow-2xs border border-[#E5E2DC]/80 dark:border-slate-600 pointer-events-none ${
                    isTutorTabDragging
                      ? "transition-none shadow-md scale-[1.01]"
                      : "transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
                  }`}
                  style={{
                    left:
                      isTutorTabDragging && tutorTabDragLeftPx !== null
                        ? `${4 + tutorTabDragLeftPx}px`
                        : `calc(4px + ${tutorTabIndex} * ((100% - 8px) / 3))`,
                    width: "calc((100% - 8px) / 3)",
                  }}
                />

                <div className="relative z-10 grid grid-cols-3 h-full">
                  <button
                    type="button"
                    onClick={() => {
                      if (tutorTabJustDraggedRef.current) return;
                      setTutorTab("overview");
                    }}
                    className={`inline-flex items-center justify-center gap-1.5 px-2 sm:px-3 rounded-xl text-xs font-medium transition-colors duration-200 cursor-pointer h-full ${
                      tutorTab === "overview"
                        ? "text-[#171715] dark:text-white font-semibold"
                        : "text-[#57534E] dark:text-slate-400 hover:text-[#171715] dark:hover:text-white"
                    }`}
                  >
                    <LayoutDashboard className="h-3.5 w-3.5 shrink-0" />
                    <span className="hidden sm:inline truncate">Visão Geral & Presença</span>
                    <span className="sm:hidden font-medium">Visão Geral</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (tutorTabJustDraggedRef.current) return;
                      setTutorTab("audit");
                    }}
                    className={`inline-flex items-center justify-center gap-1.5 px-2 sm:px-3 rounded-xl text-xs font-medium transition-colors duration-200 cursor-pointer h-full ${
                      tutorTab === "audit"
                        ? "text-[#171715] dark:text-white font-semibold"
                        : "text-[#57534E] dark:text-slate-400 hover:text-[#171715] dark:hover:text-white"
                    }`}
                  >
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                    <span className="hidden sm:inline truncate">Auditoria da Tutoria</span>
                    <span className="sm:hidden font-medium">Auditoria</span>
                    {studentsUnderFourHoursCount > 0 && (
                      <span className="inline-flex items-center justify-center bg-rose-500 text-white rounded-full h-4 min-w-[16px] px-1 text-[10px] font-bold shrink-0">
                        {studentsUnderFourHoursCount}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (tutorTabJustDraggedRef.current) return;
                      setTutorTab("records");
                    }}
                    className={`inline-flex items-center justify-center gap-1.5 px-2 sm:px-3 rounded-xl text-xs font-medium transition-colors duration-200 cursor-pointer h-full ${
                      tutorTab === "records"
                        ? "text-[#171715] dark:text-white font-semibold"
                        : "text-[#57534E] dark:text-slate-400 hover:text-[#171715] dark:hover:text-white"
                    }`}
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" />
                    <span className="hidden sm:inline truncate">Histórico & Relatórios</span>
                    <span className="sm:hidden font-medium">Histórico</span>
                  </button>
                </div>
              </div>

              {/* Seletor de Período Global da Tutoria (Compartilhado entre todas as abas) */}
              <div className="pt-0.5">
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
              </div>

              {/* ABA 1 DO TUTOR: Visão Geral & Presença */}
              {tutorTab === "overview" && (
                <div className="space-y-6 animate-fade-in-up">
                  {/* KPI Cards do Tutor */}
                  {loading && members.length === 0 ? (
                    <KpiSkeleton />
                  ) : (
                    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                      {/* Presentes Agora */}
                      <div className="group relative overflow-hidden rounded-3xl p-4 sm:p-5 border border-[#E5E2DC] dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl shadow-xs hover:shadow-sm hover:border-emerald-300 dark:hover:border-emerald-700 hover:-translate-y-0.5 transition-all duration-300 ease-out min-h-[124px] flex flex-col justify-between">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-teal-500" />
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-sans font-medium text-[#57534E] dark:text-slate-400">
                            Presentes agora
                          </span>
                          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs shadow-2xs group-hover:scale-105 transition-transform duration-200">
                            <Radio className="h-4 w-4 text-emerald-500 animate-pulse" />
                          </span>
                        </div>
                        <div className="mt-2.5 flex items-center gap-2">
                          <span className="text-2xl sm:text-3xl font-semibold text-[#171715] dark:text-slate-100 font-mono-data tracking-tight leading-none">
                            {presentCount}
                          </span>
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100/80 dark:bg-emerald-950/80 border border-emerald-300/80 dark:border-emerald-700/60 pl-2 pr-2.5 py-0.5 text-2xs font-semibold text-emerald-800 dark:text-emerald-300 font-sans shadow-2xs leading-none select-none">
                            <span className="relative flex h-2 w-2 items-center justify-center shrink-0">
                              <span className="absolute h-1.5 w-1.5 rounded-full bg-emerald-400 opacity-75 animate-ping" />
                              <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
                            </span>
                            <span className="leading-none">ao vivo</span>
                          </span>
                        </div>
                        <p className="text-[11px] text-[#57534E] dark:text-slate-400 mt-1.5 truncate">
                          No laboratório agora
                        </p>
                      </div>

                      {/* Total de Horas */}
                      <div className="group relative overflow-hidden rounded-3xl p-4 sm:p-5 border border-[#E5E2DC] dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl shadow-xs hover:shadow-sm hover:border-orange-300 dark:hover:border-orange-700 hover:-translate-y-0.5 transition-all duration-300 ease-out min-h-[124px] flex flex-col justify-between">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#C15F3D] to-orange-500" />
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-sans font-medium text-[#57534E] dark:text-slate-400">
                            Total de horas
                          </span>
                          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-50 dark:bg-orange-950/60 border border-orange-200/80 dark:border-orange-800/60 text-[#C15F3D] dark:text-orange-400 text-xs shadow-2xs group-hover:scale-105 transition-transform duration-200">
                            <Hourglass className="h-4 w-4 text-orange-500" />
                          </span>
                        </div>
                        <div className="mt-2.5">
                          <span className="text-xl sm:text-3xl font-semibold text-[#171715] dark:text-slate-100 font-mono-data tracking-tight">
                            {formatDuration(totalLabSeconds)}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#57534E] dark:text-slate-400 mt-1 truncate">
                          Acumuladas no período
                        </p>
                      </div>

                      {/* Integrantes Ativos */}
                      <div className="group relative overflow-hidden rounded-3xl p-4 sm:p-5 border border-[#E5E2DC] dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl shadow-xs hover:shadow-sm hover:border-indigo-300 dark:hover:border-indigo-700 hover:-translate-y-0.5 transition-all duration-300 ease-out min-h-[124px] flex flex-col justify-between">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-500" />
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-sans font-medium text-[#57534E] dark:text-slate-400">
                            Integrantes ativos
                          </span>
                          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800/60 text-indigo-800 dark:text-indigo-400 text-xs shadow-2xs group-hover:scale-105 transition-transform duration-200">
                            <UserCheck className="h-4 w-4 text-indigo-500" />
                          </span>
                        </div>
                        <div className="mt-2.5 flex items-baseline gap-1.5 sm:gap-2">
                          <span className="text-2xl sm:text-3xl font-semibold text-[#171715] dark:text-slate-100 font-mono-data tracking-tight">
                            {activeMembersCount}
                          </span>
                          <span className="text-2xs font-mono-data text-[#57534E] dark:text-slate-400">de {members.length}</span>
                        </div>
                        <p className="text-[11px] text-[#57534E] dark:text-slate-400 mt-1 truncate">
                          Com presença no filtro
                        </p>
                      </div>

                      {/* Total de Sessões */}
                      <div className="group relative overflow-hidden rounded-3xl p-4 sm:p-5 border border-[#E5E2DC] dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl shadow-xs hover:shadow-sm hover:border-amber-300 dark:hover:border-amber-700 hover:-translate-y-0.5 transition-all duration-300 ease-out min-h-[124px] flex flex-col justify-between">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 to-yellow-500" />
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-sans font-medium text-[#57534E] dark:text-slate-400">
                            Total de sessões
                          </span>
                          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200/80 dark:border-amber-800/60 text-amber-800 dark:text-amber-400 text-xs shadow-2xs group-hover:scale-105 transition-transform duration-200">
                            <Layers className="h-4 w-4 text-amber-500" />
                          </span>
                        </div>
                        <div className="mt-2.5">
                          <span className="text-2xl sm:text-3xl font-semibold text-[#171715] dark:text-slate-100 font-mono-data tracking-tight">
                            {totalSessionsCount}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#57534E] dark:text-slate-400 mt-1 truncate">
                          Registros computados
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Integrantes Presentes em Tempo Real */}
                  {presentMembers.length > 0 && (
                    <div className="rounded-3xl border border-emerald-200/70 dark:border-emerald-800/50 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 sm:p-5 animate-fade-in-up">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                          <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-900 dark:text-emerald-200 font-mono-data">
                            Integrantes no Laboratório Agora ({presentMembers.length})
                          </h3>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        {presentMembers.map((t) => (
                          <button
                            key={t.member.id}
                            type="button"
                            onClick={() => setSelectedMemberId(t.member.id)}
                            className="flex items-center justify-between p-3 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-200/80 dark:border-emerald-900/60 shadow-2xs hover:shadow-xs hover:border-emerald-400 dark:hover:border-emerald-600 transition-all duration-200 text-left cursor-pointer"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="relative">
                                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 font-semibold text-xs">
                                  {t.member.name.charAt(0).toUpperCase()}
                                </span>
                                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-[#171715] dark:text-slate-100 truncate">
                                  {t.member.name}
                                </p>
                                <p className="text-[10px] font-mono-data text-stone-500 dark:text-slate-400">
                                  {t.member.matricula ?? "Discente"}
                                </p>
                              </div>
                            </div>
                            <span className="font-mono-data text-xs font-semibold text-emerald-700 dark:text-emerald-400 shrink-0 ml-2">
                              {formatDuration(t.totalSeconds)}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Gráfico Semanal de Frequência (Dias Úteis) */}
                  {!loading && totals.length > 0 && (
                    <div className="transition-all duration-300">
                      <WeeklyChart rows={filteredTotals} range={range} sessions={weekdaySessions} />
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* ── 2. Painel do Aluno / Discente (Sem login, com senha de presença makers) ── */
            <div className="space-y-6 animate-fade-in-up">
              {/* Cabeçalho Limpo e Acolhedor do Aluno */}
              <div className="rounded-3xl border border-[#E5E2DC] dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
                <div>
                  <h2 className="font-editorial text-2xl sm:text-3xl font-normal text-[#171715] dark:text-slate-100 tracking-tight">
                    Painel do Aluno
                  </h2>
                  <p className="text-xs sm:text-sm text-[#57534E] dark:text-slate-400 font-sans mt-1">
                    Acompanhe em tempo real a lotação do laboratório, horários de pico e a melhor hora para estudar.
                  </p>
                </div>

                {/* Badge Vivo com Nível de Ocupação */}
                <div className="inline-flex items-center gap-2.5 rounded-2xl border border-[#E5E2DC] dark:border-slate-700 bg-[#FAF9F5] dark:bg-slate-800/90 px-4 py-2.5 shadow-2xs self-start sm:self-auto">
                  <span className="relative flex h-2.5 w-2.5 items-center justify-center">
                    <span className="absolute h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                    <span className="relative h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  <div>
                    <div className="text-xs font-mono-data font-bold text-[#171715] dark:text-slate-100">
                      {presentCount} {presentCount === 1 ? "discente agora" : "discentes agora"}
                    </div>
                    <div className="text-[10px] font-sans font-medium text-[#706E6A] dark:text-slate-400">
                      Lotação: <strong className="text-emerald-700 dark:text-emerald-400">{occupancyInsights.currentCrowdLevel}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Seletor de Período Integrado com Animação Fluida iOS */}
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

              {/* Cards de Insights de Ocupação do Laboratório (Mais úteis para os alunos) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {/* 1. Status de Lotação Ao Vivo */}
                <div className="rounded-3xl border border-[#E5E2DC] dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl p-4 sm:p-5 shadow-xs flex flex-col justify-between min-h-[136px] hover:shadow-sm hover:-translate-y-0.5 transition-all duration-300">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-sans font-semibold text-[#57534E] dark:text-slate-400">
                      Lotação Atual
                    </span>
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                      <Radio className="h-4 w-4 animate-pulse" />
                    </span>
                  </div>
                  <div>
                    <div className="text-xl sm:text-2xl font-bold font-mono-data text-[#171715] dark:text-slate-100">
                      {occupancyInsights.currentCrowdLevel}
                    </div>
                    <p className="text-[11px] text-[#57534E] dark:text-slate-400 mt-1 leading-snug">
                      {presentCount < 3
                        ? "Espaço calmo · Ótimo para leitura e estudos individuais"
                        : presentCount < 8
                        ? "Movimento equilibrado · Bom para colaborar e focar"
                        : "Laboratório movimentado com equipes ativas"}
                    </p>
                  </div>
                </div>

                {/* 2. Horário com Mais Discentes (Pico) */}
                <div className="rounded-3xl border border-amber-200/80 dark:border-amber-800/50 bg-amber-50/40 dark:bg-amber-950/20 backdrop-blur-xl p-4 sm:p-5 shadow-xs flex flex-col justify-between min-h-[136px] hover:shadow-sm hover:-translate-y-0.5 transition-all duration-300">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-sans font-semibold text-amber-900 dark:text-amber-300">
                      Horário com Mais Discentes
                    </span>
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100/80 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300">
                      <SunMedium className="h-4 w-4" />
                    </span>
                  </div>
                  <div>
                    <div className="text-xl sm:text-2xl font-bold font-mono-data text-amber-900 dark:text-amber-200">
                      {occupancyInsights.peakHour ? occupancyInsights.peakHour.label : occupancyInsights.peakShift.name}
                    </div>
                    <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 mt-1 leading-snug">
                      {occupancyInsights.peakHour
                        ? `${occupancyInsights.peakHour.sessionsCount} presenças no pico · Turno da ${occupancyInsights.peakShift.name}`
                        : `${occupancyInsights.peakShift.hoursDescription} (${occupancyInsights.peakShift.sessionsCount} presenças)`}
                    </p>
                  </div>
                </div>

                {/* 3. Horário Mais Tranquilo (Menos Discentes) */}
                <div className="rounded-3xl border border-indigo-200/80 dark:border-indigo-800/50 bg-indigo-50/40 dark:bg-indigo-950/20 backdrop-blur-xl p-4 sm:p-5 shadow-xs flex flex-col justify-between min-h-[136px] hover:shadow-sm hover:-translate-y-0.5 transition-all duration-300">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-sans font-semibold text-indigo-900 dark:text-indigo-300">
                      Horário Mais Tranquilo
                    </span>
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-100/80 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                      <Coffee className="h-4 w-4" />
                    </span>
                  </div>
                  <div>
                    <div className="text-xl sm:text-2xl font-bold font-mono-data text-indigo-900 dark:text-indigo-200">
                      {occupancyInsights.quietHour ? occupancyInsights.quietHour.label : occupancyInsights.quietShift.name}
                    </div>
                    <p className="text-[11px] text-indigo-800/80 dark:text-indigo-300/80 mt-1 leading-snug">
                      {occupancyInsights.quietHour
                        ? `${occupancyInsights.quietHour.sessionsCount} presenças · Intervalo favorável para foco`
                        : `${occupancyInsights.quietShift.hoursDescription} · Menor fluxo para foco`}
                    </p>
                  </div>
                </div>

                {/* 4. Distribuição de Turnos */}
                <div className="rounded-3xl border border-[#E5E2DC] dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl p-4 sm:p-5 shadow-xs flex flex-col justify-between min-h-[136px] hover:shadow-sm hover:-translate-y-0.5 transition-all duration-300">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-sans font-semibold text-[#57534E] dark:text-slate-400">
                      Distribuição por Turnos
                    </span>
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#FAF5F0] dark:bg-slate-800 text-[#C15F3D] dark:text-amber-400">
                      <Sparkles className="h-4 w-4" />
                    </span>
                  </div>
                  <div className="space-y-1.5 pt-2">
                    <div className="flex items-center justify-between text-2xs font-mono-data">
                      <span className="text-[#57534E] dark:text-slate-400">Manhã:</span>
                      <strong className="text-[#171715] dark:text-slate-100">{occupancyInsights.shiftsSummary.morning.percent}%</strong>
                    </div>
                    <div className="flex items-center justify-between text-2xs font-mono-data">
                      <span className="text-[#57534E] dark:text-slate-400">Tarde:</span>
                      <strong className="text-[#171715] dark:text-slate-100">{occupancyInsights.shiftsSummary.afternoon.percent}%</strong>
                    </div>
                    <div className="flex items-center justify-between text-2xs font-mono-data">
                      <span className="text-[#57534E] dark:text-slate-400">Noite:</span>
                      <strong className="text-[#171715] dark:text-slate-100">{occupancyInsights.shiftsSummary.evening.percent}%</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Gráfico de Dias Úteis com Dia de Pico Destacado (Segunda a Sexta) */}
              {!loading && totals.length > 0 && (
                <div className="transition-all duration-300">
                  <WeeklyChart rows={filteredTotals} range={range} sessions={weekdaySessions} />
                </div>
              )}

              {/* Tabela de Discentes com Busca Reativa (Visual original refinado estilo Apple) */}
              <div className="space-y-4">
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-stone-400 dark:text-slate-400 group-focus-within:text-[#C15F3D] dark:group-focus-within:text-amber-400 transition-colors">
                    <Search className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    placeholder="Filtrar por seu nome ou matrícula..."
                    value={searchInput}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="w-full h-11 rounded-2xl border border-[#E5E2DC] dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl py-2 pl-10 pr-9 text-xs sm:text-sm text-[#171715] dark:text-slate-100 placeholder:text-stone-400 dark:placeholder:text-slate-500 font-sans font-medium shadow-xs focus:border-[#C15F3D] focus:bg-white dark:focus:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-[#C15F3D]/20 transition-all"
                  />
                  {searchInput && (
                    <button
                      type="button"
                      onClick={clearSearch}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-stone-400 hover:text-stone-700 dark:hover:text-white cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <TotalsTable
                  rows={filteredTotals}
                  onSelectMember={(row) => setSelectedMemberId(row.member.id)}
                />
              </div>
            </div>
          )}

          {/* ABA 2 DO TUTOR: Auditoria & Metas Semanais (4h) */}
          {user && tutorTab === "audit" && (
            <div className="space-y-6 animate-fade-in-up">
              {!loading && (
                <TutorInsightsCard
                  members={members}
                  sessions={weekdaySessions}
                  now={now}
                  onSelectMember={(id) => setSelectedMemberId(id)}
                />
              )}

              {/* Painel Completo de Notificações e Advertências Acadêmicas (Direto na Página, Sem Modal) */}
              {!loading && (
                <TutorWarningPanel
                  members={members}
                  sessions={weekdaySessions}
                  tutorEmail={user.email ?? "tutor@ailab.com"}
                  period={period}
                  range={range}
                  now={now}
                />
              )}
            </div>
          )}

          {/* ABA 3 DO TUTOR: Histórico Completo, Filtros e Exportação */}
          {user && tutorTab === "records" && (
            <div className="space-y-4 animate-fade-in-up">
              {/* Barra de Busca, Alternância e Exportação */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-3xl p-3 sm:p-3.5 border border-[#E5E2DC] dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl shadow-xs transition-all duration-300">
                <div className="relative flex-1 group">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-stone-400 dark:text-slate-400 group-focus-within:text-[#C15F3D] dark:group-focus-within:text-amber-400 transition-colors">
                    <Search className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    placeholder="Filtrar por nome ou matrícula..."
                    value={searchInput}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="w-full h-10 rounded-2xl border border-stone-200 dark:border-slate-700 bg-[#FAF9F5] dark:bg-slate-950/60 py-2 pl-10 pr-9 text-xs sm:text-sm text-[#171715] dark:text-slate-100 placeholder:text-stone-400 dark:placeholder:text-slate-500 font-sans font-medium focus:border-[#C15F3D] focus:bg-white dark:focus:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-[#C15F3D]/20 transition-all"
                  />
                  {searchInput && (
                    <button
                      type="button"
                      onClick={clearSearch}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-stone-400 hover:text-stone-700 dark:hover:text-white cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <ViewSelector view={view} onViewChange={setView} />

                  <ExportButton
                    rows={filteredTotals}
                    period={period}
                    range={range}
                  />

                  <button
                    type="button"
                    onClick={() => setIsOfficialReportOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-2xl border border-[#E5E2DC] dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-sans font-medium text-[#57534E] dark:text-slate-300 hover:border-[#C15F3D]/50 hover:text-[#171715] dark:hover:text-slate-100 hover:bg-[#FAF9F5] dark:hover:bg-slate-700 active:scale-[0.97] shadow-2xs transition-all cursor-pointer min-h-[38px]"
                  >
                    <FileText className="h-3.5 w-3.5 text-[#C15F3D] dark:text-amber-400" />
                    <span>Relatório Oficial (PDF)</span>
                  </button>
                </div>
              </div>

              {/* Tabela ou Histórico */}
              {loading && members.length === 0 ? (
                <TableSkeleton />
              ) : (
                <div key={view} className="animate-fade-in-up">
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
          )}

          {/* Alerta de Erro Resiliente */}
          {error && (
            <div className="flex items-center justify-between rounded-2xl border border-rose-300 bg-rose-50 dark:bg-rose-950/40 p-4 text-sm text-rose-700 dark:text-rose-300 animate-slide-down" role="alert">
              <span className="flex items-center gap-1.5"><AlertCircle className="h-4 w-4 shrink-0" />{error}</span>
              <button
                type="button"
                onClick={() => refreshData(false)}
                className="font-bold underline hover:text-rose-900 cursor-pointer min-h-[44px] px-2"
              >
                Tentar novamente
              </button>
            </div>
          )}

        </div>
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

      {/* Modal de Auditoria e Advertências do Tutor */}
      {user && (
        <TutorWarningModal
          isOpen={isTutorWarningOpen}
          onClose={() => setIsTutorWarningOpen(false)}
          members={members}
          sessions={weekdaySessions}
          tutorEmail={user.email ?? ""}
          period={period}
          range={range}
          now={now}
        />
      )}

      {/* Modal de Configuração de Credenciais do Tutor (@ailab.com) */}
      {user && (
        <TutorProfileModal
          isOpen={isTutorProfileOpen}
          onClose={() => setIsTutorProfileOpen(false)}
        />
      )}

      {/* Modal de Registro Manual de Presença */}
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
        sessions={weekdaySessions}
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
