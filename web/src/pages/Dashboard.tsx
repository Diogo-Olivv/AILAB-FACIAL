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

  useEffect(() => {
    const range = rangeFor(period, customFrom, customTo);
    setLoading(true);
    setError("");
    Promise.all([fetchSessions(range), fetchPresentIds()])
      .then(([nextSessions, nextPresent]) => {
        setSessions(nextSessions);
        setPresentIds(nextPresent);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Falha ao carregar sessoes."))
      .finally(() => setLoading(false));
  }, [period, customFrom, customTo]);

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
    <div className="min-h-screen bg-base px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Tempo de permanencia</h1>
            <p className="text-sm text-white/50">Painel de acompanhamento do laboratorio.</p>
          </div>
          <button onClick={signOut} className="text-sm text-white/60 hover:text-white">
            Sair
          </button>
        </header>

        <PeriodSelector
          period={period}
          customFrom={customFrom}
          customTo={customTo}
          onPeriod={setPeriod}
          onCustomFrom={setCustomFrom}
          onCustomTo={setCustomTo}
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <button
              onClick={() => setView("totals")}
              className={`rounded-lg px-4 py-2 text-sm ${
                view === "totals" ? "bg-accent text-white" : "bg-surface text-white/60 hover:text-white"
              }`}
            >
              Totais
            </button>
            <button
              onClick={() => setView("history")}
              className={`rounded-lg px-4 py-2 text-sm ${
                view === "history" ? "bg-accent text-white" : "bg-surface text-white/60 hover:text-white"
              }`}
            >
              Historico diario
            </button>
          </div>
          <MemberSelector members={members} selected={memberId} onSelect={setMemberId} />
        </div>

        {loading && <p className="text-white/60">Carregando...</p>}
        {error && <p className="text-red-400">{error}</p>}

        {!loading && !error && (view === "totals" ? <TotalsTable rows={totals} /> : <DailyHistory days={days} />)}
      </div>
    </div>
  );
}
