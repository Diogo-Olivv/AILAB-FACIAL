import { LAB_CAPACITY } from "../lib/config";
import { WEEKLY_TARGET_SECONDS } from "../lib/attendanceTarget";
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
  RotateCcw,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "../auth/useAuth";
import { useSearchParams } from "react-router-dom";
import {
  fetchMembers,
  fetchPresentIds,
  fetchSessions,
  fetchPublicLabStats,
  type Member,
  type SessionRecord,
  type PublicLabStats,
} from "../lib/reports";
import { rangeFor, PERIOD_LABELS, type PeriodKey } from "../lib/period";
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
import { HowItWorksModal } from "../components/HowItWorksModal";
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
import { MemberAvatar } from "../components/MemberAvatar";

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
  const searchInputRef = useRef<HTMLInputElement | null>(null);
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
  const [publicStats, setPublicStats] = useState<PublicLabStats | null>(null);

  // Modais e gavetas
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false);
  const [isTutorWarningOpen, setIsTutorWarningOpen] = useState(false);
  const [isTutorProfileOpen, setIsTutorProfileOpen] = useState(false);
  const [isManualAttendanceOpen, setIsManualAttendanceOpen] = useState(false);
  const [isOfficialReportOpen, setIsOfficialReportOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  // Ticker de 1 segundo para atualizar sessões em aberto em tempo real
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // ESC com prioridade de fechamento: fecha a camada mais interna primeiro
  useEffect(() => {
    const handleEscKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (selectedMemberId) {
        setSelectedMemberId(null);
        return;
      }
      if (isOfficialReportOpen) {
        setIsOfficialReportOpen(false);
        return;
      }
      if (isManualAttendanceOpen) {
        setIsManualAttendanceOpen(false);
        return;
      }
      if (isTutorProfileOpen) {
        setIsTutorProfileOpen(false);
        return;
      }
      if (isTutorWarningOpen) {
        setIsTutorWarningOpen(false);
        return;
      }
      if (isHowItWorksOpen) {
        setIsHowItWorksOpen(false);
        return;
      }
      if (isTermsOpen) {
        setIsTermsOpen(false);
        return;
      }
      if (searchQuery) {
        clearSearch();
        return;
      }
    };
    window.addEventListener("keydown", handleEscKeyDown);
    return () => window.removeEventListener("keydown", handleEscKeyDown);
  }, [
    selectedMemberId,
    isOfficialReportOpen,
    isManualAttendanceOpen,
    isTutorProfileOpen,
    isTutorWarningOpen,
    isHowItWorksOpen,
    isTermsOpen,
    searchQuery,
  ]);

  // Atalho global "/" ou Ctrl+K / Cmd+K (respeita campos de edição e modais abertos)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditable =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      const hasOpenModal =
        Boolean(selectedMemberId) ||
        isOfficialReportOpen ||
        isManualAttendanceOpen ||
        isTutorProfileOpen ||
        isTutorWarningOpen ||
        isHowItWorksOpen ||
        isTermsOpen;

      if (isEditable || hasOpenModal) return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (user && !isStudentView && tutorTab !== "records") {
          setTutorTab("records");
          setTimeout(() => searchInputRef.current?.focus(), 60);
        } else {
          searchInputRef.current?.focus();
          searchInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        return;
      }

      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        if (user && !isStudentView && tutorTab !== "records") {
          setTutorTab("records");
          setTimeout(() => searchInputRef.current?.focus(), 60);
        } else {
          searchInputRef.current?.focus();
          searchInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [
    user,
    isStudentView,
    tutorTab,
    selectedMemberId,
    isOfficialReportOpen,
    isManualAttendanceOpen,
    isTutorProfileOpen,
    isTutorWarningOpen,
    isHowItWorksOpen,
    isTermsOpen,
  ]);

  const loadMembers = useCallback(async () => {
    try {
      const data = await fetchMembers();
      setMembers(data);
    } catch (e: any) {
      console.warn("Falha ao carregar lista de integrantes:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const range = useMemo(
    () => rangeFor(period, customFrom, customTo),
    [period, customFrom, customTo]
  );

  const refreshData = useCallback(
    async (silent = false) => {
      if (!silent) setIsRefreshing(true);
      setError("");
      try {
        const [nextSessions, nextPresent, stats] = await Promise.all([
          fetchSessions(range),
          fetchPresentIds(),
          fetchPublicLabStats(28),
        ]);
        setSessions(nextSessions);
        setPresentIds(nextPresent);
        setPublicStats(stats);
        setLastRefreshed(new Date());
      } catch (e: any) {
        const msg =
          e instanceof Error
            ? e.message
            : typeof e === "object" && e?.message
            ? String(e.message)
            : typeof e === "string"
            ? e
            : "Falha ao sincronizar telemetria. Tente novamente.";
        setError(msg);
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [range]
  );

  useEffect(() => {
    if (members.length === 0) {
      setLoading(true);
    }
    refreshData(false);
  }, [refreshData, members.length]);

  // Polling a cada 30 segundos
  useEffect(() => {
    const timer = setInterval(() => {
      refreshData(true);
    }, 30000);
    return () => clearInterval(timer);
  }, [refreshData]);

  // Filtro Temporal de Dias Úteis (Segunda a Sexta)
  const weekdaySessions = useMemo(() => {
    return filterWeekdaySessions(sessions);
  }, [sessions]);

  const totals = useMemo(() => {
    return totalsByMember(members, weekdaySessions, presentIds, now);
  }, [members, weekdaySessions, presentIds, now]);

  const days = useMemo(
    () => groupByDay(members, weekdaySessions, now),
    [members, weekdaySessions, now]
  );

  const selectedMemberTotal = useMemo(() => {
    if (!selectedMemberId) return null;
    return totals.find((t) => t.member.id === selectedMemberId) ?? null;
  }, [totals, selectedMemberId]);

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
        entries: d.entries.filter((s) => s.memberName.toLowerCase().includes(q)),
      }))
      .filter((d) => d.entries.length > 0);
  }, [days, searchQuery]);

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setSearchQuery(value);
    }, 180);
  };

  const clearSearch = () => {
    setSearchInput("");
    setSearchQuery("");
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
  };

  const resetPeriodToDefault = () => {
    setPeriod("week");
    setCustomFrom("");
    setCustomTo("");
  };

  // Métricas agregadas
  const presentCount = presentIds.length;
  const totalLabSeconds = useMemo(
    () => totals.reduce((acc, t) => acc + t.totalSeconds, 0),
    [totals]
  );
  const activeMembersCount = useMemo(
    () => totals.filter((t) => t.totalSeconds > 0).length,
    [totals]
  );
  const totalSessionsCount = useMemo(
    () => totals.reduce((acc, t) => acc + t.sessionCount, 0),
    [totals]
  );

  const presentMembers = useMemo(() => {
    return totals.filter((t) => t.present);
  }, [totals]);

  const studentsUnderFourHoursCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of members) map.set(m.id, 0);
    for (const s of weekdaySessions) {
      if (s.voidedAt != null) continue;
      map.set(s.profileId, (map.get(s.profileId) ?? 0) + sessionSeconds(s, now));
    }
    return members.filter((m) => (map.get(m.id) ?? 0) < WEEKLY_TARGET_SECONDS).length;
  }, [members, weekdaySessions, now]);

  const occupancyInsights = useMemo(() => {
    return calculateOccupancyInsights(
      sessions,
      presentCount,
      now,
      LAB_CAPACITY,
      publicStats?.buckets
    );
  }, [sessions, presentCount, now, publicStats]);

  const crowd = CROWD_STYLES[occupancyInsights.currentCrowdLevel];
  const shiftSegments = [
    {
      key: "morning",
      label: "Manhã",
      percent: occupancyInsights.shiftsSummary.morning.percent,
      bar: "bg-amber-400",
    },
    {
      key: "afternoon",
      label: "Tarde",
      percent: occupancyInsights.shiftsSummary.afternoon.percent,
      bar: "bg-orange-500",
    },
    {
      key: "evening",
      label: "Noite",
      percent: occupancyInsights.shiftsSummary.evening.percent,
      bar: "bg-indigo-500",
    },
  ];

  const hasActiveFilters = period !== "week" || Boolean(searchQuery.trim());

  return (
    <div className="min-h-screen bg-transparent flex flex-col justify-between selection:bg-orange-500/20 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* Barra superior de progresso durante sincronização */}
      {isRefreshing && (
        <div className="fixed top-0 left-0 right-0 z-50 h-0.5 bg-gradient-to-r from-transparent via-orange-500 to-emerald-500 animate-pulse" />
      )}

      {/* Header Global Fixo (z-40 h-16) */}
      <Header
        user={user}
        signOut={signOut}
        onOpenTerms={() => setIsTermsOpen(true)}
        onOpenHowItWorks={() => setIsHowItWorksOpen(true)}
        onRefresh={() => refreshData(false)}
        isRefreshing={isRefreshing}
        presentCount={presentCount}
        lastRefreshed={lastRefreshed}
        syncState={
          error
            ? "error"
            : isRefreshing
            ? "updating"
            : now.getTime() - lastRefreshed.getTime() > 60000
            ? "delayed"
            : "connected"
        }
      />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 relative">
        <div
          className={`space-y-6 transition-opacity duration-200 ${
            isRefreshing ? "opacity-80" : "opacity-100"
          }`}
        >
          {/* Banner de Erro Acionável (Heurística #9 — Recuperação de Erros) */}
          {error && (
            <div
              className="surface-card border-rose-500/30 bg-rose-500/10 dark:bg-rose-500/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-slide-down"
              role="alert"
            >
              <div className="flex items-start sm:items-center gap-3 min-w-0">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-500/15 ring-1 ring-rose-500/30 text-rose-600 dark:text-rose-400">
                  <AlertCircle className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300">
                    Falha na Sincronização de Telemetria
                  </p>
                  <p className="text-xs sm:text-sm text-rose-800 dark:text-rose-200 break-words mt-0.5">
                    {error}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => refreshData(false)}
                className="btn-secondary !border-rose-500/30 !text-rose-700 dark:!text-rose-200 shrink-0 self-end sm:self-auto"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Tentar novamente</span>
              </button>
            </div>
          )}

          {/* ── 1. Painel Executivo da Tutoria (Quando autenticado) ── */}
          {user && !isStudentView ? (
            <div className="space-y-6 animate-fade-in-up">
              {/* Card de Comando da Tutoria */}
              <div className="surface-card relative overflow-hidden p-4 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div
                  className="pointer-events-none absolute -top-24 -left-24 h-56 w-56 rounded-full bg-orange-500/10 blur-3xl"
                  aria-hidden="true"
                />
                <div className="relative flex items-center gap-3.5 min-w-0">
                  {user.user_metadata?.avatar_url ? (
                    <MemberAvatar
                      name={user.email ?? "Tutor"}
                      src={user.user_metadata.avatar_url}
                      size="lg"
                      highlight
                      present={presentCount > 0}
                    />
                  ) : (
                    <span className="flex h-11 w-11 min-w-[2.75rem] min-h-[2.75rem] aspect-square shrink-0 items-center justify-center rounded-full bg-orange-500/10 ring-1 ring-orange-500/25 text-orange-600 dark:text-amber-400">
                      <GraduationCap className="h-5 w-5" />
                    </span>
                  )}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono-data rounded-md bg-orange-500/10 text-orange-600 dark:text-amber-400 border border-orange-500/20 px-2 py-0.5 text-2xs font-semibold">
                        {user.email ? user.email.replace(/@ailab\.com$/i, "") : "Tutor"}
                      </span>
                    </div>
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
                      Painel da Tutoria
                    </h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Gestão de presença, auditoria da meta semanal de 4h e emissão de relatórios.
                    </p>
                  </div>
                </div>

                {/* Ações Rápidas da Tutoria */}
                <div className="relative grid grid-cols-2 sm:flex sm:items-center gap-2 w-full lg:w-auto">
                  <button
                    type="button"
                    onClick={() => setIsManualAttendanceOpen(true)}
                    className="btn-primary"
                  >
                    <UserPlus className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">+ Presença Manual</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsTutorProfileOpen(true)}
                    className="btn-secondary"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
                    <span className="truncate">Perfil do Tutor</span>
                  </button>
                </div>
              </div>

              {/* Barra Unificada: Segmented Control de Abas + Seletor de Período */}
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
                <div
                  ref={tutorTabContainerRef}
                  onPointerDown={handleTutorTabPointerDown}
                  onPointerMove={handleTutorTabPointerMove}
                  onPointerUp={handleTutorTabPointerUp}
                  onPointerCancel={handleTutorTabPointerCancel}
                  role="tablist"
                  aria-label="Seções do painel da tutoria"
                  className="segmented-track w-full xl:w-[580px] h-11 select-none touch-pan-y cursor-grab active:cursor-grabbing overflow-x-auto no-scrollbar"
                >
                  <div
                    className={`segmented-pill top-1 bottom-1 pointer-events-none ${
                      isTutorTabDragging
                        ? "transition-none scale-[1.01]"
                        : "transition-all duration-200 ease-out"
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
                    {(
                      [
                        {
                          key: "overview",
                          icon: LayoutDashboard,
                          full: "Visão Geral",
                          short: "Visão Geral",
                        },
                        {
                          key: "audit",
                          icon: ShieldCheck,
                          full: "Auditoria",
                          short: "Auditoria",
                        },
                        {
                          key: "records",
                          icon: FileSpreadsheet,
                          full: "Histórico",
                          short: "Histórico",
                        },
                      ] as const
                    ).map(({ key, icon: Icon, full, short }) => {
                      const active = tutorTab === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          role="tab"
                          aria-selected={active}
                          onClick={() => {
                            if (tutorTabJustDraggedRef.current) return;
                            setTutorTab(key);
                          }}
                          className={`inline-flex items-center justify-center gap-1.5 px-2 sm:px-3 rounded-lg text-xs transition-colors duration-150 cursor-pointer h-full ${
                            active
                              ? "text-slate-900 dark:text-white font-semibold"
                              : "text-slate-500 dark:text-slate-400 font-medium hover:text-slate-900 dark:hover:text-white"
                          }`}
                        >
                          <Icon
                            className={`h-3.5 w-3.5 shrink-0 ${
                              active ? "text-orange-500 dark:text-amber-400" : ""
                            }`}
                          />
                          <span className="hidden sm:inline truncate">{full}</span>
                          <span className="sm:hidden">{short}</span>
                          {key === "audit" && studentsUnderFourHoursCount > 0 && (
                            <span
                              className="inline-flex items-center justify-center bg-rose-500 text-white rounded-full h-4 min-w-[16px] px-1 text-[10px] font-mono-data font-bold tabular-nums shrink-0"
                              aria-label={`${studentsUnderFourHoursCount} abaixo da meta`}
                            >
                              {studentsUnderFourHoursCount}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex-1">
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
              </div>

              {/* ABA 1 DO TUTOR: Visão Geral & Presença */}
              {tutorTab === "overview" && (
                <div className="space-y-6 animate-fade-in-up">
                  {loading && members.length === 0 ? (
                    <KpiSkeleton />
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <KpiCard
                        label="Presentes agora ao vivo"
                        icon={Radio}
                        accent="emerald"
                        value={presentCount}
                        badge={
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            </span>
                            ao vivo
                          </span>
                        }
                        caption="Sessões abertas neste instante"
                      />
                      <KpiCard
                        label="Total de horas"
                        icon={Hourglass}
                        accent="orange"
                        value={formatDuration(totalLabSeconds)}
                        caption="Permanência útil acumulada"
                      />
                      <KpiCard
                        label="Integrantes ativos"
                        icon={UserCheck}
                        accent="indigo"
                        value={activeMembersCount}
                        suffix={`de ${members.length}`}
                        caption="Com presença registrada no filtro"
                      />
                      <KpiCard
                        label="Total de sessões"
                        icon={Layers}
                        accent="amber"
                        value={totalSessionsCount}
                        caption="Check-ins válidos computados"
                      />
                    </div>
                  )}

                  {/* Integrantes Presentes em Tempo Real */}
                  {presentMembers.length > 0 && (
                    <section
                      className="surface-card p-4 sm:p-5 animate-fade-in-up"
                      aria-labelledby="present-now-title"
                    >
                      <div className="flex items-center justify-between gap-3 mb-4">
                        <div className="flex items-center gap-2.5">
                          <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                          </span>
                          <h3
                            id="present-now-title"
                            className="text-sm font-bold tracking-tight text-slate-900 dark:text-white"
                          >
                            Integrantes no Laboratório Agora
                          </h3>
                          <span className="rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500/20 px-2 py-0.5 text-2xs font-mono-data tabular-nums font-bold">
                            {presentMembers.length}
                          </span>
                        </div>
                        <span className="hidden sm:inline text-xs text-slate-500 dark:text-slate-400">
                          Clique em um integrante para inspecionar sessões
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        {presentMembers.map((t) => (
                          <button
                            key={t.member.id}
                            type="button"
                            onClick={() => setSelectedMemberId(t.member.id)}
                            className="group flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/70 dark:bg-[#161F30] hover:bg-white dark:hover:bg-[#1E293B] hover:border-emerald-500/40 transition-all duration-150 text-left cursor-pointer"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <MemberAvatar
                                name={t.member.name}
                                src={t.member.avatarUrl}
                                size="md"
                                highlight={Boolean(t.member.isTutor)}
                                present
                              />
                              <div className="min-w-0">
                                <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white truncate group-hover:text-orange-600 dark:group-hover:text-amber-400 transition-colors">
                                  {t.member.name}
                                </p>
                                <p className="text-2xs font-mono-data tabular-nums text-slate-500 dark:text-slate-400 truncate">
                                  {t.member.matricula ? `#${t.member.matricula}` : "Discente"}
                                </p>
                              </div>
                            </div>
                            <span className="font-mono-data tabular-nums text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                              {formatDuration(t.totalSeconds, true)}
                            </span>
                          </button>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Gráfico Semanal de Frequência (Dias Úteis) */}
                  {!loading && totals.length > 0 && (
                    <WeeklyChart
                      rows={filteredTotals}
                      range={range}
                      sessions={weekdaySessions}
                    />
                  )}

                  {/* Insights Analíticos de Retenção e Turnos */}
                  {!loading && (
                    <TutorInsightsCard
                      members={members}
                      sessions={weekdaySessions}
                      now={now}
                      onSelectMember={(id) => setSelectedMemberId(id)}
                    />
                  )}
                </div>
              )}
            </div>
          ) : (
            /* ── 2. Painel do Aluno / Discente (Público) ── */
            <div className="space-y-6 animate-fade-in-up">
              {/* Hero Executivo do Painel do Aluno */}
              <div className="surface-card relative overflow-hidden p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                <div
                  className="pointer-events-none absolute -top-24 -right-20 h-64 w-64 rounded-full bg-gradient-to-br from-orange-500/10 via-amber-500/5 to-emerald-500/10 blur-3xl"
                  aria-hidden="true"
                />
                <div className="relative space-y-1">
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                    Painel do Aluno
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-xl">
                    Lotação em tempo real, melhores horários de estudo e consulta de permanência semanal.
                  </p>
                </div>

                {/* Indicador Semafórico Ao Vivo no Topo */}
                <div
                  className={`relative flex items-center gap-3.5 rounded-2xl px-4 py-3 self-start lg:self-auto ${crowd.badge}`}
                  aria-live="polite"
                >
                  <span className="relative flex h-3 w-3 items-center justify-center shrink-0">
                    <span
                      className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${crowd.ping}`}
                    />
                    <span className={`relative h-2.5 w-2.5 rounded-full ${crowd.dot}`} />
                  </span>
                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xl sm:text-2xl font-bold font-mono-data tabular-nums text-slate-900 dark:text-white leading-none">
                        {presentCount}
                      </span>
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                        {presentCount === 1 ? "presente agora" : "presentes agora"}
                      </span>
                    </div>
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                      Status: <strong className={crowd.text}>{crowd.label}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Seletor de Período */}
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

              {/* Bento Grid de KPIs do Painel do Aluno (4 Colunas) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Card Destaque — Lotação Atual ao Vivo */}
                <div className="surface-card surface-card-interactive p-5 flex flex-col justify-between gap-4 min-h-[158px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="eyebrow">Lotação Atual</span>
                    <span
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${crowd.tile}`}
                    >
                      <Radio className="h-4 w-4" />
                    </span>
                  </div>
                  <div>
                    <div className="flex items-baseline justify-between gap-2">
                      <span
                        className={`text-2xl sm:text-3xl font-bold tracking-tight tabular-nums ${crowd.text}`}
                      >
                        {crowd.label}
                      </span>
                      <span className="text-xs font-mono-data tabular-nums font-semibold text-slate-500 dark:text-slate-400">
                        {presentCount} {presentCount === 1 ? "ativo" : "ativos"}
                      </span>
                    </div>
                    <div
                      className="mt-3 grid grid-cols-3 gap-1.5"
                      role="meter"
                      aria-valuemin={1}
                      aria-valuemax={3}
                      aria-valuenow={crowd.level}
                      aria-label={`Nível de lotação: ${crowd.label}`}
                    >
                      {[1, 2, 3].map((lvl) => (
                        <span
                          key={lvl}
                          className={`h-2 rounded-full transition-colors duration-300 ${
                            lvl <= crowd.level
                              ? crowd.bar
                              : "bg-slate-200/80 dark:bg-white/[0.07]"
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2.5 leading-snug">
                      {crowd.hint}
                    </p>
                  </div>
                </div>

                {/* 2. Horário de Pico */}
                <div className="surface-card surface-card-interactive p-5 flex flex-col justify-between gap-4 min-h-[158px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="eyebrow">Horário de Pico</span>
                    <span className="w-9 h-9 rounded-lg flex items-center justify-center bg-amber-500/10 ring-1 ring-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
                      <SunMedium className="h-4 w-4" />
                    </span>
                  </div>
                  <div>
                    <div className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white font-mono-data tabular-nums">
                      {occupancyInsights.peakHour
                        ? occupancyInsights.peakHour.label
                        : occupancyInsights.peakShift.name}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-snug tabular-nums">
                      {occupancyInsights.peakHour ? (
                        <>
                          <strong className="font-mono-data font-semibold text-amber-600 dark:text-amber-400">
                            {occupancyInsights.peakHour.sessionsCount}
                          </strong>{" "}
                          presenças no pico · Turno da {occupancyInsights.peakShift.name}
                        </>
                      ) : (
                        <>
                          {occupancyInsights.peakShift.hoursDescription} (
                          <span className="font-mono-data">
                            {occupancyInsights.peakShift.sessionsCount}
                          </span>{" "}
                          presenças)
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {/* 3. Horário Mais Tranquilo */}
                <div className="surface-card surface-card-interactive p-5 flex flex-col justify-between gap-4 min-h-[158px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="eyebrow">Mais Tranquilo</span>
                    <span className="w-9 h-9 rounded-lg flex items-center justify-center bg-indigo-500/10 ring-1 ring-indigo-500/20 text-indigo-600 dark:text-indigo-400 shrink-0">
                      <Coffee className="h-4 w-4" />
                    </span>
                  </div>
                  <div>
                    <div className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white font-mono-data tabular-nums">
                      {occupancyInsights.quietHour
                        ? occupancyInsights.quietHour.label
                        : occupancyInsights.quietShift.name}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-snug tabular-nums">
                      {occupancyInsights.quietHour ? (
                        <>
                          <strong className="font-mono-data font-semibold text-indigo-600 dark:text-indigo-400">
                            {occupancyInsights.quietHour.sessionsCount}
                          </strong>{" "}
                          presenças · Janela ideal para foco individual
                        </>
                      ) : (
                        `${occupancyInsights.quietShift.hoursDescription} · Menor fluxo para foco`
                      )}
                    </p>
                  </div>
                </div>

                {/* 4. Distribuição por Turnos (Manhã / Tarde / Noite) */}
                <div className="surface-card surface-card-interactive p-5 flex flex-col justify-between gap-4 min-h-[158px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="eyebrow">Distribuição por Turnos</span>
                    <span className="w-9 h-9 rounded-lg flex items-center justify-center bg-orange-500/10 ring-1 ring-orange-500/20 text-orange-600 dark:text-amber-400 shrink-0">
                      <Sparkles className="h-4 w-4" />
                    </span>
                  </div>
                  <div>
                    <div
                      className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
                      aria-hidden="true"
                    >
                      {shiftSegments.map((seg) =>
                        seg.percent > 0 ? (
                          <span
                            key={seg.key}
                            className={`h-full ${seg.bar} transition-all duration-500 first:rounded-l-full last:rounded-r-full`}
                            style={{ width: `${seg.percent}%` }}
                          />
                        ) : null
                      )}
                    </div>
                    <ul className="mt-3 grid grid-cols-3 gap-2">
                      {shiftSegments.map((seg) => (
                        <li
                          key={seg.key}
                          className="rounded-lg bg-slate-100/70 dark:bg-[#161F30] px-2 py-1.5 text-center"
                        >
                          <div className="flex items-center justify-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                            <span className={`h-2 w-2 rounded-full ${seg.bar} shrink-0`} />
                            <span className="truncate">{seg.label}</span>
                          </div>
                          <strong className="block font-mono-data tabular-nums text-xs font-bold text-slate-900 dark:text-white mt-0.5">
                            {seg.percent}%
                          </strong>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Gráfico Semanal de Presenças (Dias Úteis) */}
              {!loading && totals.length > 0 && (
                <WeeklyChart
                  rows={filteredTotals}
                  range={range}
                  sessions={weekdaySessions}
                />
              )}

              {/* Seção de Busca + Tabela Geral de Integrantes e Presenças ao Vivo */}
              <div className="space-y-3">
                <SearchField
                  inputRef={searchInputRef}
                  value={searchInput}
                  onChange={handleSearchChange}
                  onClear={clearSearch}
                  placeholder="Buscar integrante por nome ou matrícula..."
                  resultCount={searchQuery ? filteredTotals.length : undefined}
                  className="surface-card !rounded-xl"
                />

                {hasActiveFilters && (
                  <ActiveFilterChips
                    period={period}
                    searchQuery={searchQuery}
                    onResetPeriod={resetPeriodToDefault}
                    onClearSearch={clearSearch}
                  />
                )}

                {loading && members.length === 0 ? (
                  <TableSkeleton />
                ) : (
                  <TotalsTable
                    rows={filteredTotals}
                    totalCount={totals.length}
                    searchActive={Boolean(searchQuery.trim())}
                    onClearSearch={clearSearch}
                    onSelectMember={(row) => setSelectedMemberId(row.member.id)}
                  />
                )}
              </div>

              {/* Aviso Institucional & Resguardo LGPD */}
              <div className="surface-card p-4 sm:p-5 border-l-4 border-l-orange-500 bg-gradient-to-r from-orange-500/5 via-transparent to-transparent">
                <div className="flex items-center gap-2 mb-1">
                  <span className="eyebrow text-orange-600 dark:text-amber-400">
                    Privacidade & Governança (LGPD Art. 11)
                  </span>
                  <span className="rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500/20 text-2xs px-2 py-0.5 font-bold">
                    DP-1 Ativa
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
                  Em conformidade com a LGPD, o painel público exibe apenas dados de lotação agregados. Auditoria individual de horas é restrita à tutoria e coordenação acadêmica.
                </p>
              </div>
            </div>
          )}

          {/* ABA 2 DO TUTOR: Auditoria & Metas Semanais (4h) */}
          {user && !isStudentView && tutorTab === "audit" && (
            <div className="space-y-6 animate-fade-in-up">
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
          {user && !isStudentView && tutorTab === "records" && (
            <div className="space-y-4 animate-fade-in-up">
              <div className="surface-card flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5 p-2.5">
                <SearchField
                  inputRef={searchInputRef}
                  value={searchInput}
                  onChange={handleSearchChange}
                  onClear={clearSearch}
                  placeholder="Filtrar por nome ou matrícula..."
                  resultCount={
                    searchQuery
                      ? view === "totals"
                        ? filteredTotals.length
                        : filteredDays.reduce((acc, d) => acc + d.entries.length, 0)
                      : undefined
                  }
                  className="flex-1 surface-muted"
                />

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
                    className="btn-secondary"
                  >
                    <FileText className="h-3.5 w-3.5 text-orange-500 dark:text-amber-400" />
                    <span className="hidden sm:inline">Relatório Oficial (PDF)</span>
                    <span className="sm:hidden">Relatório (PDF)</span>
                  </button>
                </div>
              </div>

              {hasActiveFilters && (
                <ActiveFilterChips
                  period={period}
                  searchQuery={searchQuery}
                  onResetPeriod={resetPeriodToDefault}
                  onClearSearch={clearSearch}
                />
              )}

              {loading && members.length === 0 ? (
                <TableSkeleton />
              ) : (
                <div key={view} className="animate-fade-in-up">
                  {view === "totals" ? (
                    <TotalsTable
                      rows={filteredTotals}
                      totalCount={totals.length}
                      searchActive={Boolean(searchQuery.trim())}
                      onClearSearch={clearSearch}
                      onSelectMember={(row) => setSelectedMemberId(row.member.id)}
                    />
                  ) : (
                    <DailyHistory days={filteredDays} />
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Rodapé com status de sincronização e atalhos de ajuda/privacidade */}
      <Footer
        lastRefreshed={lastRefreshed}
        onOpenTerms={() => setIsTermsOpen(true)}
        onOpenHowItWorks={() => setIsHowItWorksOpen(true)}
        isRefreshing={isRefreshing}
      />

      {/* Modal Como Funciona (H10) */}
      <HowItWorksModal
        isOpen={isHowItWorksOpen}
        onClose={() => setIsHowItWorksOpen(false)}
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

// ── Configuração Semafórica de Lotação (Seção 3.1 & 4.2) ──────────────────────
const CROWD_STYLES = {
  Indefinido: {
    label: "Sem classificação",
    level: 0,
    hint: "Capacidade do laboratório não configurada · exibindo apenas a contagem",
    dot: "bg-slate-400",
    ping: "bg-transparent",
    bar: "bg-slate-400",
    text: "text-slate-600 dark:text-slate-300",
    tile: "bg-slate-500/10 ring-1 ring-slate-500/20 text-slate-600 dark:text-slate-300",
    badge: "bg-slate-500/10 ring-1 ring-slate-500/20",
  },
  Tranquilo: {
    label: "Tranquilo",
    level: 1,
    hint: "Ocupação baixa em relação à capacidade do laboratório",
    dot: "bg-emerald-500",
    ping: "bg-emerald-500",
    bar: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
    tile: "bg-emerald-500/10 ring-1 ring-emerald-500/20 text-emerald-600 dark:text-emerald-400",
    badge: "bg-emerald-500/10 ring-1 ring-emerald-500/20",
  },
  Moderado: {
    label: "Moderado",
    level: 2,
    hint: "Ocupação intermediária em relação à capacidade do laboratório",
    dot: "bg-amber-500",
    ping: "bg-amber-500",
    bar: "bg-amber-500",
    text: "text-amber-600 dark:text-amber-400",
    tile: "bg-amber-500/10 ring-1 ring-amber-500/20 text-amber-600 dark:text-amber-400",
    badge: "bg-amber-500/10 ring-1 ring-amber-500/20",
  },
  Movimentado: {
    label: "Cheio",
    level: 3,
    hint: "Ocupação alta em relação à capacidade do laboratório",
    dot: "bg-rose-500",
    ping: "bg-rose-500",
    bar: "bg-rose-500",
    text: "text-rose-600 dark:text-rose-400",
    tile: "bg-rose-500/10 ring-1 ring-rose-500/20 text-rose-600 dark:text-rose-400",
    badge: "bg-rose-500/10 ring-1 ring-rose-500/20",
  },
} as const;

// ── KPI Card Executivo da Tutoria (Seção 4.2) ─────────────────────────────────
const KPI_ACCENTS = {
  emerald: {
    tile: "bg-emerald-500/10 ring-1 ring-emerald-500/20 text-emerald-600 dark:text-emerald-400",
    glow: "from-emerald-500/15",
  },
  orange: {
    tile: "bg-orange-500/10 ring-1 ring-orange-500/20 text-orange-600 dark:text-amber-400",
    glow: "from-orange-500/15",
  },
  indigo: {
    tile: "bg-indigo-500/10 ring-1 ring-indigo-500/20 text-indigo-600 dark:text-indigo-400",
    glow: "from-indigo-500/15",
  },
  amber: {
    tile: "bg-amber-500/10 ring-1 ring-amber-500/20 text-amber-600 dark:text-amber-400",
    glow: "from-amber-500/15",
  },
} as const;

interface KpiCardProps {
  label: string;
  icon: LucideIcon;
  accent: keyof typeof KPI_ACCENTS;
  value: React.ReactNode;
  suffix?: string;
  badge?: React.ReactNode;
  caption: string;
}

function KpiCard({
  label,
  icon: Icon,
  accent,
  value,
  suffix,
  badge,
  caption,
}: KpiCardProps) {
  const a = KPI_ACCENTS[accent];
  return (
    <div className="surface-card surface-card-interactive group relative overflow-hidden p-5 min-h-[136px] flex flex-col justify-between">
      <div
        className={`pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full bg-gradient-to-br ${a.glow} to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200`}
        aria-hidden="true"
      />
      <div className="relative flex items-center justify-between gap-2">
        <span className="eyebrow truncate">{label}</span>
        <span
          className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${a.tile}`}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="relative mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white font-mono-data tabular-nums leading-none">
          {value}
        </span>
        {suffix && (
          <span className="text-xs font-mono-data tabular-nums text-slate-500 dark:text-slate-400">
            {suffix}
          </span>
        )}
        {badge}
      </div>
      <p className="relative text-xs text-slate-500 dark:text-slate-400 mt-2 truncate">
        {caption}
      </p>
    </div>
  );
}

// ── Campo de Busca com Atalho "/" e "⌘K" (Heurísticas #3 e #7) ────────────────
interface SearchFieldProps {
  inputRef?: React.RefObject<HTMLInputElement | null>;
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  placeholder: string;
  resultCount?: number;
  className?: string;
}

function SearchField({
  inputRef,
  value,
  onChange,
  onClear,
  placeholder,
  resultCount,
  className = "",
}: SearchFieldProps) {
  return (
    <div className={`relative group flex items-center ${className}`}>
      <Search
        className="pointer-events-none absolute left-3.5 h-4 w-4 text-slate-400 group-focus-within:text-orange-500 dark:group-focus-within:text-amber-400 transition-colors"
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && value) {
            e.stopPropagation();
            onClear();
          }
        }}
        aria-label={placeholder}
        className={`w-full h-11 rounded-xl border-0 bg-transparent py-2 pl-10 ${
          typeof resultCount === "number"
            ? "pr-36"
            : value
            ? "pr-11"
            : "pr-4 sm:pr-20"
        } text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/40 [&::-webkit-search-cancel-button]:hidden`}
      />
      <div className="absolute right-2.5 flex items-center gap-1.5">
        {!value && (
          <kbd
            className="hidden sm:inline-flex items-center gap-0.5 rounded-md border border-slate-200 dark:border-white/[0.1] bg-slate-100/80 dark:bg-[#161F30] px-1.5 py-0.5 text-[10px] font-mono-data font-semibold text-slate-500 dark:text-slate-400 pointer-events-none select-none"
            title="Pressione / ou Ctrl+K para buscar rapidamente"
          >
            /
          </kbd>
        )}
        {typeof resultCount === "number" && (
          <span className="rounded-md bg-slate-100 dark:bg-[#161F30] border border-slate-200/80 dark:border-white/[0.08] px-2 py-0.5 text-2xs font-mono-data tabular-nums font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
            {resultCount} {resultCount === 1 ? "resultado" : "resultados"}
          </span>
        )}
        {value && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 dark:hover:bg-white/[0.1] dark:hover:text-white cursor-pointer"
            aria-label="Limpar busca"
            title="Limpar busca (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Chips de Filtros Ativos (Heurística #6 — Reconhecimento) ──────────────────
function ActiveFilterChips({
  period,
  searchQuery,
  onResetPeriod,
  onClearSearch,
}: {
  period: PeriodKey;
  searchQuery: string;
  onResetPeriod: () => void;
  onClearSearch: () => void;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-2 text-xs animate-fade-in"
      aria-label="Filtros ativos"
    >
      <span className="text-2xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        Filtros ativos:
      </span>
      {period !== "week" && (
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500/10 text-orange-700 dark:text-amber-300 ring-1 ring-orange-500/25 px-2.5 py-1 text-2xs font-semibold">
          <span>Período: {PERIOD_LABELS[period]}</span>
          <button
            type="button"
            onClick={onResetPeriod}
            className="hover:text-orange-900 dark:hover:text-white cursor-pointer"
            aria-label="Restaurar período para Esta semana"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      )}
      {searchQuery.trim() && (
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-200/80 dark:bg-[#161F30] text-slate-700 dark:text-slate-200 ring-1 ring-slate-300/80 dark:ring-white/[0.1] px-2.5 py-1 text-2xs font-semibold">
          <span>Busca: &ldquo;{searchQuery.trim()}&rdquo;</span>
          <button
            type="button"
            onClick={onClearSearch}
            className="hover:text-slate-950 dark:hover:text-white cursor-pointer"
            aria-label="Remover filtro de busca"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      )}
    </div>
  );
}
