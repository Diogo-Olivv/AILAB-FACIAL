import type { Member, SessionRecord } from "../lib/reports";
import { formatDuration, formatTime } from "../lib/aggregate";

interface Props {
  member: Member | null;
  sessions: SessionRecord[];
  isOpen: boolean;
  isPresent: boolean;
  totalSeconds: number;
  onClose: () => void;
}

export function MemberDetailDrawer({
  member,
  sessions,
  isOpen,
  isPresent,
  totalSeconds,
  onClose,
}: Props) {
  if (!isOpen || !member) return null;

  const memberSessions = sessions
    .filter((s) => s.profileId === member.id)
    .sort((a, b) => new Date(b.checkIn).getTime() - new Date(a.checkIn).getTime());

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-end bg-ink/50 backdrop-blur-xs transition-opacity animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-member-name"
    >
      <div
        className="h-full w-full max-w-md bg-card border-l border-line shadow-2xl flex flex-col overflow-hidden animate-slide-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-line bg-cream p-5">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-muted">
              Ficha do Integrante
            </span>
            <h2 id="drawer-member-name" className="text-xl font-bold text-ink">
              {member.name}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted">
                Matrícula: <strong>{member.matricula ?? "Não informada"}</strong>
              </span>
              <span>•</span>
              {isPresent ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-green/15 px-2 py-0.5 text-xs font-semibold text-green">
                  <span className="h-1.5 w-1.5 rounded-full bg-green animate-pulse" />
                  No laboratório agora
                </span>
              ) : (
                <span className="text-xs text-muted">Fora do laboratório</span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar detalhes do integrante"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-white text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-navy cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Total stats card */}
        <div className="p-5 border-b border-line bg-white grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-line bg-cream/50 p-3">
            <span className="text-xs font-semibold text-muted block">Total de Permanência</span>
            <span className="text-xl font-bold text-navy mt-1 block">
              {formatDuration(totalSeconds)}
            </span>
          </div>
          <div className="rounded-xl border border-line bg-cream/50 p-3">
            <span className="text-xs font-semibold text-muted block">Sessões Registradas</span>
            <span className="text-xl font-bold text-ink mt-1 block">
              {memberSessions.length}
            </span>
          </div>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
            Histórico de Sessões no Período
          </h3>

          {memberSessions.length === 0 ? (
            <div className="rounded-2xl border border-line bg-white p-8 text-center text-muted text-sm">
              Nenhuma sessão registrada para este integrante nas datas selecionadas.
            </div>
          ) : (
            <div className="space-y-2.5">
              {memberSessions.map((s, idx) => {
                const checkInDate = new Date(s.checkIn);
                const dateLabel = checkInDate.toLocaleDateString("pt-BR", {
                  weekday: "short",
                  day: "2-digit",
                  month: "short",
                });
                const isOpenSession = s.checkOut === null;
                const isVoided = Boolean(s.voidedAt);

                return (
                  <div
                    key={idx}
                    className="rounded-xl border border-line bg-white p-3.5 shadow-2xs space-y-1.5 transition-colors hover:border-navy/30"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-ink capitalize">{dateLabel}</span>
                      {isVoided ? (
                        <span className="rounded bg-warn/10 px-2 py-0.5 font-medium text-warn text-2xs">
                          ⚠️ Saída esquecida
                        </span>
                      ) : isOpenSession ? (
                        <span className="rounded-full bg-green/15 px-2 py-0.5 font-bold text-green text-2xs animate-pulse">
                          ● Em andamento
                        </span>
                      ) : (
                        <span className="font-bold text-navy">
                          {s.durationS ? formatDuration(s.durationS) : "0 min"}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted">
                      <span>
                        Entrada: <strong className="text-ink">{formatTime(s.checkIn)}</strong>
                      </span>
                      <span>
                        Saída:{" "}
                        <strong className="text-ink">
                          {isOpenSession ? "—" : formatTime(s.checkOut!)}
                        </strong>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="border-t border-line bg-cream p-4">
          <button
            onClick={onClose}
            className="w-full rounded-xl bg-navy py-2.5 text-sm font-bold text-white transition-all hover:bg-navy/90 active:scale-95 cursor-pointer"
          >
            Fechar Detalhes
          </button>
        </div>
      </div>
    </div>
  );
}
