import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchMemberHours, formatHours, type MemberHours } from "../lib/dashboard";
import { useAuth } from "../auth/useAuth";

export function Dashboard() {
  const { isOwner, signOut } = useAuth();
  const [members, setMembers] = useState<MemberHours[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMemberHours()
      .then(setMembers)
      .catch((e) => setError(e instanceof Error ? e.message : "Falha ao carregar."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-base px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-white">Horas no laboratorio</h1>
          <div className="flex items-center gap-4 text-sm">
            {isOwner && (
              <>
                <Link to="/cadastro" className="text-accent hover:underline">Cadastro</Link>
                <Link to="/kiosk" className="text-accent hover:underline">Kiosk</Link>
              </>
            )}
            <button onClick={signOut} className="text-white/60 hover:text-white">Sair</button>
          </div>
        </header>

        {loading && <p className="text-white/60">Carregando...</p>}
        {error && <p className="text-red-400">{error}</p>}

        {!loading && !error && (
          <div className="overflow-hidden rounded-2xl bg-surface">
            <table className="w-full text-left text-sm text-white">
              <thead className="bg-black/20 text-white/60">
                <tr>
                  <th className="px-4 py-3">Integrante</th>
                  <th className="px-4 py-3">Matricula</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="border-t border-white/5">
                    <td className="px-4 py-3">{m.name}</td>
                    <td className="px-4 py-3 text-white/60">{m.matricula ?? "-"}</td>
                    <td className="px-4 py-3">{formatHours(m.totalSeconds)}</td>
                    <td className="px-4 py-3">
                      {m.present ? (
                        <span className="rounded-full bg-green-500/20 px-2 py-1 text-xs text-green-400">
                          No lab
                        </span>
                      ) : (
                        <span className="text-xs text-white/40">Fora</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
