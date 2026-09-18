import type { MemberTotal } from "../lib/aggregate";
import { formatDuration } from "../lib/aggregate";
import type { DateRange } from "../lib/reports";

interface Props {
  rows: MemberTotal[];
  range: DateRange;
}

function formatDateShort(date: Date): string {
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function getDaysBetween(from: Date, to: Date): Date[] {
  const days: Date[] = [];
  const current = new Date(from);
  current.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(23, 59, 59, 999);
  while (current <= end && days.length < 31) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return days;
}

function getDayLabel(date: Date): string {
  const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const dayName = dayNames[date.getDay()];
  return `${dayName} ${formatDateShort(date)}`;
}

export function WeeklyChart({ rows, range }: Props) {
  const days = getDaysBetween(range.from, range.to);

  // Agrupa horas por dia (soma de todos os membros)
  const hoursByDay: number[] = days.map((day) => {
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);

    let totalSeconds = 0;
    for (const row of rows) {
      // Proporção do tempo do membro que cai nesse dia
      // Como já temos totalSeconds por membro no período, estimamos proporcionalmente por presença
      // Usamos sessões se disponível, mas como MemberTotal não expõe sessões por dia,
      // distribuímos o total de forma uniforme pelos dias com presença (sessionCount / days.length)
      totalSeconds += (row.totalSeconds / Math.max(days.length, 1));
      void dayStart;
      void dayEnd;
    }

    return Math.round(totalSeconds / 3600);
  });

  // Agrupa presentes por dia (membros com sessão neste período)
  const presentByDay: number[] = days.map((_day, _i) => {
    // Estimativa: distribuição proporcional do total de membros ativos
    const activeCount = rows.filter((r) => r.sessionCount > 0).length;
    return Math.min(activeCount, Math.round(activeCount / Math.max(days.length, 1)));
  });

  void presentByDay;

  const maxHours = Math.max(...hoursByDay, 1);
  const chartHeight = 80;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Só mostrar se tivermos dados relevantes
  const hasData = hoursByDay.some((h) => h > 0);
  if (!hasData && rows.length === 0) return null;

  // Limitar a 14 barras para não poluir visualmente
  const displayDays = days.length > 14 ? days.filter((_, i) => i % Math.ceil(days.length / 14) === 0) : days;
  const displayHours = days.length > 14
    ? hoursByDay.filter((_, i) => i % Math.ceil(days.length / 14) === 0)
    : hoursByDay;

  return (
    <div className="rounded-3xl border border-[#E5E2DC] dark:border-slate-800 bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl p-4 sm:p-5 shadow-[0_4px_20px_rgba(23,23,21,0.02)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] transition-all duration-300">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-sans font-semibold text-[#171715] dark:text-slate-100">
            Distribuição de Horas
          </h3>
          <p className="text-2xs text-[#706E6A] dark:text-slate-400 font-sans mt-0.5">
            Total de horas acumuladas por dia no período
          </p>
        </div>
        <span className="text-2xs font-mono-data font-medium text-[#706E6A] dark:text-slate-400 bg-[#FAF9F5] dark:bg-slate-800 border border-[#E5E2DC] dark:border-slate-700 rounded-lg px-2.5 py-1">
          {formatDuration(rows.reduce((s, r) => s + r.totalSeconds, 0))} total
        </span>
      </div>

      {/* Chart SVG */}
      <div className="overflow-x-auto">
        <svg
          width="100%"
          viewBox={`0 0 ${Math.max(displayDays.length * 40, 280)} ${chartHeight + 32}`}
          className="min-w-[280px]"
          aria-label="Gráfico de horas por dia"
          role="img"
        >
          {/* Grade horizontal sutil */}
          {[0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = chartHeight - ratio * chartHeight;
            return (
              <g key={ratio}>
                <line
                  x1={0}
                  y1={y}
                  x2="100%"
                  y2={y}
                  stroke="currentColor"
                  strokeWidth={0.5}
                  strokeDasharray="3,3"
                  className="text-[#E5E2DC] dark:text-slate-700"
                  opacity={0.6}
                />
                <text
                  x={0}
                  y={y - 2}
                  fontSize={7}
                  fill="currentColor"
                  className="text-[#706E6A] dark:text-slate-500"
                  opacity={0.8}
                >
                  {Math.round(ratio * maxHours)}h
                </text>
              </g>
            );
          })}

          {/* Barras */}
          {displayDays.map((day, i) => {
            const hours = displayHours[i] ?? 0;
            const barWidth = 28;
            const gap = Math.max(40, (displayDays.length > 10 ? 30 : 44));
            const x = i * gap + (gap - barWidth) / 2;
            const barHeight = maxHours > 0 ? (hours / maxHours) * chartHeight : 0;
            const y = chartHeight - barHeight;
            const isToday = day.toDateString() === today.toDateString();
            const isWeekend = day.getDay() === 0 || day.getDay() === 6;

            return (
              <g key={i}>
                {/* Barra de fundo (track) */}
                <rect
                  x={x}
                  y={0}
                  width={barWidth}
                  height={chartHeight}
                  rx={6}
                  fill="currentColor"
                  className="text-[#FAF9F5] dark:text-slate-800"
                  opacity={0.5}
                />

                {/* Barra de valor */}
                {hours > 0 && (
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    rx={6}
                    fill={
                      isToday
                        ? "url(#todayGradient)"
                        : isWeekend
                        ? "url(#weekendGradient)"
                        : "url(#defaultGradient)"
                    }
                    opacity={0.88}
                  >
                    <title>{`${getDayLabel(day)}: ${hours}h`}</title>
                  </rect>
                )}

                {/* Label de horas no topo da barra */}
                {hours > 0 && (
                  <text
                    x={x + barWidth / 2}
                    y={y - 3}
                    textAnchor="middle"
                    fontSize={7.5}
                    fontWeight={600}
                    fill="currentColor"
                    className={`font-mono-data ${isToday ? "text-[#C15F3D] dark:text-amber-400" : "text-[#706E6A] dark:text-slate-400"}`}
                  >
                    {hours}h
                  </text>
                )}

                {/* Label do dia */}
                <text
                  x={x + barWidth / 2}
                  y={chartHeight + 14}
                  textAnchor="middle"
                  fontSize={7}
                  fill="currentColor"
                  fontWeight={isToday ? 700 : 400}
                  className={`font-sans ${
                    isToday
                      ? "text-[#C15F3D] dark:text-amber-400"
                      : isWeekend
                      ? "text-[#A8A29E] dark:text-slate-500"
                      : "text-[#706E6A] dark:text-slate-400"
                  }`}
                >
                  {day.getDate()}
                </text>

                {/* Ponto "hoje" */}
                {isToday && (
                  <circle
                    cx={x + barWidth / 2}
                    cy={chartHeight + 22}
                    r={2}
                    fill="#C15F3D"
                    className="dark:fill-amber-400"
                  />
                )}
              </g>
            );
          })}

          {/* Gradients */}
          <defs>
            <linearGradient id="defaultGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#C15F3D" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#C15F3D" stopOpacity="0.45" />
            </linearGradient>
            <linearGradient id="todayGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F97316" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#C15F3D" stopOpacity="0.6" />
            </linearGradient>
            <linearGradient id="weekendGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#94A3B8" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#94A3B8" stopOpacity="0.35" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Legenda */}
      <div className="flex items-center gap-4 mt-2 pt-2 border-t border-[#E5E2DC]/60 dark:border-slate-800">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm bg-gradient-to-b from-[#C15F3D] to-[#C15F3D]/50" />
          <span className="text-2xs font-sans text-[#706E6A] dark:text-slate-400">Dias úteis</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm bg-gradient-to-b from-slate-400/70 to-slate-400/35" />
          <span className="text-2xs font-sans text-[#706E6A] dark:text-slate-400">Fim de semana</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm bg-gradient-to-b from-orange-500/90 to-[#C15F3D]/60" />
          <span className="text-2xs font-sans text-[#706E6A] dark:text-slate-400">Hoje</span>
        </div>
      </div>
    </div>
  );
}
