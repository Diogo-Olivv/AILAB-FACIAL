import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/useAuth";
import {
  fetchMembers,
  fetchPresentIds,
  fetchSessions,
  type Member,
  type SessionRecord,
} from "../lib/reports";
import { rangeFor, type PeriodKey } from "../lib/period";
import { groupByDay, totalsByMember } from "../lib/aggregate";
import { PeriodSelector } from "../components/PeriodSelector";
import { MemberSelector } from "../components/MemberSelector";
import { TotalsTable } from "../components/TotalsTable";
import { DailyHistory } from "../components/DailyHistory";
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
  const [error, setError] = useState("");

  useEffect(() => {
    fetchMembers()
      .then(setMembers)
      .catch((e) => setError(e instanceof Error ? e.message : "Falha ao carregar integrantes."));
  }, []);

  const range = useMemo(
    () => rangeFor(period, customFrom, customTo),
    [period, customFrom, customTo],
  );

  useEffect(() => {
    setLoading(true);
    setError("");
    Promise.all([fetchSessions(range), fetchPresentIds()])
      .then(([nextSessions, nextPresent]) => {
        setSessions(nextSessions);
        setPresentIds(nextPresent);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Falha ao carregar sessões."))
      .finally(() => setLoading(false));
  }, [range]);

  const filtered = useMemo(
    () => (memberId ? sessions.filter((s) => s.profileId === memberId) : sessions),
    [sessions, memberId],
  );

  const totals = useMemo(() => {
    const scope = memberId ? members.filter((m) => m.id === memberId) : members;
    return totalsByMember(scope, filtered, presentIds, new Date());
  }, [members, filtered, presentIds, memberId]);

  const days = useMemo(() => groupByDay(members, filtered, new Date()), [members, filtered]);

  return (
    <div className="min-h-screen bg-cream px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src={logo}
              alt="Maker Foundation"
              className="h-12 w-12 rounded-full border border-line object-cover"
            />
            <div>
              <h1 className="text-2xl font-semibold text-ink">Tempo de permanência</h1>
              <p className="text-sm text-muted">Painel de acompanhamento do laboratório.</p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="rounded-lg border border-warn/20 bg-warn/10 px-4 py-2 text-sm font-medium text-warn transition hover:bg-warn/20"
          >
            Sair
          </button>
        </header>

        <PeriodSelector
          period={period}
          range={range}
          customFrom={customFrom}
          customTo={customTo}
          onPeriod={setPeriod}
          onCustomFrom={setCustomFrom}
          onCustomTo={setCustomTo}
        />

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-green/20 bg-green/5 p-3">
          <div className="flex gap-2">
            <button
              onClick={() => setView("totals")}
              className={`rounded-lg px-4 py-2 text-sm transition ${
                view === "totals"
                  ? "bg-green text-white"
                  : "border border-line bg-card text-muted hover:text-ink"
              }`}
            >
              Totais
            </button>
            <button
              onClick={() => setView("history")}
              className={`rounded-lg px-4 py-2 text-sm transition ${
                view === "history"
                  ? "bg-green text-white"
                  : "border border-line bg-card text-muted hover:text-ink"
              }`}
            >
              Histórico diário
            </button>
          </div>
          <MemberSelector members={members} selected={memberId} onSelect={setMemberId} />
        </div>

        {loading && <p className="text-muted">Carregando...</p>}
        {error && <p className="text-warn">{error}</p>}

        {!loading && !error && (view === "totals" ? <TotalsTable rows={totals} /> : <DailyHistory days={days} />)}
      </div>
    </div>
  );
}
