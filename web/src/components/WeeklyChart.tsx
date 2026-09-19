import { useMemo, useState } from "react";
import { BarChart3, TrendingUp, Clock3, Users, Flame } from "lucide-react";
import type { MemberTotal } from "../lib/aggregate";
import { formatDuration, sessionSeconds } from "../lib/aggregate";
import type { DateRange, SessionRecord } from "../lib/reports";

type ChartMode = "bar" | "trend" | "shifts";

interface Props {
  rows: MemberTotal[];
  range: DateRange;
  sessions?: SessionRecord[];
}

interface DayData {
  date: Date;
  dateStr: string;
  dayLabel: string;
  weekdayLabel: string;
  totalSeconds: number;
  hours: number;
  activeMembers: number;
  sessionCount: number;
  isToday: boolean;
  isWeekend: boolean;
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

const WEEKDAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const WEEKDAY_FULL = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

export function WeeklyChart({ rows, range, sessions = [] }: Props) {
  const [mode, setMode] = useState<ChartMode>("bar");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const daysList = useMemo(() => getDaysBetween(range.from, range.to), [range.from, range.to]);

  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  // Agrupamento detalhado por dia com dados reais
  const dailyData = useMemo<DayData[]>(() => {
    const now = new Date();

    return daysList.map((day) => {
      const dayStart = new Date(day);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(day);
      dayEnd.setHours(23, 59, 59, 999);

      const isToday = day.getTime() === today.getTime();
      const isWeekend = day.getDay() === 0 || day.getDay() === 6;

      if (sessions && sessions.length > 0) {
        // Filtra sessões cuja entrada aconteceu nesse dia
        const daySessions = sessions.filter((s) => {
          if (s.voidedAt) return false;
          const sTime = new Date(s.checkIn).getTime();
          return sTime >= dayStart.getTime() && sTime <= dayEnd.getTime();
        });

        const totalSec = daySessions.reduce((acc, s) => acc + sessionSeconds(s, now), 0);
        const uniqueMembers = new Set(daySessions.map((s) => s.profileId)).size;

        return {
          date: day,
          dateStr: formatDateShort(day),
          dayLabel: `${WEEKDAY_NAMES[day.getDay()]} ${formatDateShort(day)}`,
          weekdayLabel: WEEKDAY_FULL[day.getDay()],
          totalSeconds: totalSec,
          hours: Math.round((totalSec / 3600) * 10) / 10,
          activeMembers: uniqueMembers,
          sessionCount: daySessions.length,
          isToday,
          isWeekend,
        };
      }

      // Fallback inteligente caso sessions ainda esteja carregando
      const totalSec = rows.reduce((s, r) => s + r.totalSeconds / Math.max(daysList.length, 1), 0);
      const activeCount = rows.filter((r) => r.sessionCount > 0).length;

      return {
        date: day,
        dateStr: formatDateShort(day),
        dayLabel: `${WEEKDAY_NAMES[day.getDay()]} ${formatDateShort(day)}`,
        weekdayLabel: WEEKDAY_FULL[day.getDay()],
        totalSeconds: totalSec,
        hours: Math.round((totalSec / 3600) * 10) / 10,
        activeMembers: Math.min(activeCount, Math.round(activeCount / Math.max(daysList.length, 1))),
        sessionCount: rows.reduce((s, r) => s + r.sessionCount, 0),
        isToday,
        isWeekend,
      };
    });
  }, [daysList, sessions, rows, today]);

  // Estatísticas por turnos (Manhã: 08h-12h, Tarde: 12h-18h, Noite: 18h-22h+)
  const shiftStats = useMemo(() => {
    let morningSec = 0;
    let morningCount = 0;
    let afternoonSec = 0;
    let afternoonCount = 0;
    let eveningSec = 0;
    let eveningCount = 0;

    const now = new Date();
    for (const s of sessions) {
      if (s.voidedAt) continue;
      const hour = new Date(s.checkIn).getHours();
      const sec = sessionSeconds(s, now);

      if (hour < 12) {
        morningSec += sec;
        morningCount++;
      } else if (hour < 18) {
        afternoonSec += sec;
        afternoonCount++;
      } else {
        eveningSec += sec;
        eveningCount++;
      }
    }

    const total = morningSec + afternoonSec + eveningSec || 1;
    return {
      morning: {
        seconds: morningSec,
        hours: Math.round((morningSec / 3600) * 10) / 10,
        percent: Math.round((morningSec / total) * 100),
        count: morningCount,
      },
      afternoon: {
        seconds: afternoonSec,
        hours: Math.round((afternoonSec / 3600) * 10) / 10,
        percent: Math.round((afternoonSec / total) * 100),
        count: afternoonCount,
      },
      evening: {
        seconds: eveningSec,
        hours: Math.round((eveningSec / 3600) * 10) / 10,
        percent: Math.round((eveningSec / total) * 100),
        count: eveningCount,
      },
      totalHours: Math.round((total / 3600) * 10) / 10,
    };
  }, [sessions]);

  const maxHours = useMemo(() => {
    const max = Math.max(...dailyData.map((d) => d.hours), 1);
    return Math.ceil(max);
  }, [dailyData]);

  const totalPeriodSeconds = useMemo(() => {
    return dailyData.reduce((acc, d) => acc + d.totalSeconds, 0);
  }, [dailyData]);

  const peakDay = useMemo(() => {
    if (dailyData.length === 0) return null;
    return [...dailyData].sort((a, b) => b.totalSeconds - a.totalSeconds)[0];
  }, [dailyData]);

  if (dailyData.length === 0) return null;

  // Parâmetros do gráfico SVG
  const chartHeight = 110;
  const yAxisWidth = 36;
  const graphWidth = Math.max(dailyData.length * 36, 320);
  const totalSvgWidth = graphWidth + yAxisWidth + 16;

  // Curva de tendência SVG Bezier
  const trendPath = useMemo(() => {
    if (dailyData.length < 2) return "";
    const points = dailyData.map((d, i) => {
      const gap = graphWidth / Math.max(dailyData.length - 1, 1);
      const x = yAxisWidth + i * gap;
      const y = chartHeight - (d.hours / maxHours) * (chartHeight - 16);
      return { x, y };
    });

    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cpX = (p0.x + p1.x) / 2;
      path += ` C ${cpX} ${p0.y}, ${cpX} ${p1.y}, ${p1.x} ${p1.y}`;
    }
    return path;
  }, [dailyData, graphWidth, yAxisWidth, chartHeight, maxHours]);

  const trendAreaPath = useMemo(() => {
    if (!trendPath || dailyData.length < 2) return "";
    const firstX = yAxisWidth;
    const lastX = yAxisWidth + graphWidth;
    return `${trendPath} L ${lastX} ${chartHeight} L ${firstX} ${chartHeight} Z`;
  }, [trendPath, dailyData.length, yAxisWidth, graphWidth, chartHeight]);

  return (
    <div className="rounded-3xl border border-[#E5E2DC] dark:border-slate-800 bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl p-4 sm:p-5 shadow-[0_4px_20px_rgba(23,23,21,0.02)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] transition-all duration-300">
      {/* Cabeçalho com Título, Seletor de Modo e Total */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-[#E5E2DC]/60 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-sans font-semibold text-[#171715] dark:text-slate-100">
              Análise de Presença e Permanência
            </h3>
            {peakDay && peakDay.hours > 0 && (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 dark:bg-amber-950/50 border border-amber-200/80 dark:border-amber-800/60 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                <Flame className="h-3 w-3 text-amber-500" />
                Pico: {peakDay.dateStr} ({peakDay.hours}h)
              </span>
            )}
          </div>
          <p className="text-2xs text-[#706E6A] dark:text-slate-400 font-sans mt-0.5">
            Métricas de horas dedicadas no laboratório com base nas sessões biométricas reais
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Seletor de visualização com 3 modos */}
          <div className="inline-flex rounded-xl bg-[#FAF9F5] dark:bg-slate-800 p-1 border border-[#E5E2DC] dark:border-slate-700">
            <button
              type="button"
              onClick={() => setMode("bar")}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-sans font-medium transition-all ${
                mode === "bar"
                  ? "bg-white dark:bg-slate-900 text-[#171715] dark:text-white shadow-2xs font-semibold"
                  : "text-[#706E6A] dark:text-slate-400 hover:text-[#171715] dark:hover:text-slate-200"
              }`}
              title="Visualização em Barras com Indicadores Diários"
            >
              <BarChart3 className="h-3.5 w-3.5" />
              <span>Barras</span>
            </button>

            <button
              type="button"
              onClick={() => setMode("trend")}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-sans font-medium transition-all ${
                mode === "trend"
                  ? "bg-white dark:bg-slate-900 text-[#171715] dark:text-white shadow-2xs font-semibold"
                  : "text-[#706E6A] dark:text-slate-400 hover:text-[#171715] dark:hover:text-slate-200"
              }`}
              title="Curva Suave de Tendência de Frequência"
            >
              <TrendingUp className="h-3.5 w-3.5" />
              <span>Tendência</span>
            </button>

            <button
              type="button"
              onClick={() => setMode("shifts")}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-sans font-medium transition-all ${
                mode === "shifts"
                  ? "bg-white dark:bg-slate-900 text-[#171715] dark:text-white shadow-2xs font-semibold"
                  : "text-[#706E6A] dark:text-slate-400 hover:text-[#171715] dark:hover:text-slate-200"
              }`}
              title="Distribuição por Turnos (Manhã, Tarde, Noite)"
            >
              <Clock3 className="h-3.5 w-3.5" />
              <span>Turnos</span>
            </button>
          </div>

          <span className="hidden sm:inline-block text-2xs font-mono-data font-semibold text-[#171715] dark:text-slate-200 bg-[#FAF9F5] dark:bg-slate-800 border border-[#E5E2DC] dark:border-slate-700 rounded-lg px-2.5 py-1.5">
            {formatDuration(totalPeriodSeconds)}
          </span>
        </div>
      </div>

      {/* CONTEÚDO MODO 1: BARRAS ELEGANTES */}
      {mode === "bar" && (
        <div className="relative">
          <div className="overflow-x-auto pb-1">
            <svg
              width="100%"
              viewBox={`0 0 ${totalSvgWidth} ${chartHeight + 36}`}
              className="min-w-[320px] select-none"
              role="img"
              aria-label="Gráfico em barras de frequência diária"
            >
              {/* Linhas de Grade e Eixo Y com margem segura */}
              {[0.25, 0.5, 0.75, 1].map((ratio) => {
                const y = chartHeight - ratio * (chartHeight - 16);
                const value = Math.round(ratio * maxHours);
                return (
                  <g key={ratio}>
                    <line
                      x1={yAxisWidth}
                      y1={y}
                      x2={totalSvgWidth - 8}
                      y2={y}
                      stroke="currentColor"
                      strokeWidth={0.6}
                      strokeDasharray="3,3"
                      className="text-[#E5E2DC] dark:text-slate-800"
                    />
                    <text
                      x={yAxisWidth - 6}
                      y={y + 3}
                      textAnchor="end"
                      fontSize={8}
                      fill="currentColor"
                      className="text-[#706E6A] dark:text-slate-500 font-mono-data"
                    >
                      {value}h
                    </text>
                  </g>
                );
              })}

              {/* Barras esguias e elegantes com cantos superiores arredondados */}
              {dailyData.map((d, i) => {
                const barWidth = Math.min(22, Math.max(12, Math.floor(graphWidth / dailyData.length) - 8));
                const gap = graphWidth / Math.max(dailyData.length, 1);
                const x = yAxisWidth + i * gap + (gap - barWidth) / 2;
                const barHeight = maxHours > 0 ? (d.hours / maxHours) * (chartHeight - 16) : 0;
                const y = chartHeight - barHeight;
                const isHovered = hoveredIndex === i;

                return (
                  <g
                    key={d.dateStr}
                    onMouseEnter={() => setHoveredIndex(i)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    className="cursor-pointer transition-transform duration-150"
                  >
                    {/* Track de fundo sutil */}
                    <rect
                      x={x}
                      y={16}
                      width={barWidth}
                      height={chartHeight - 16}
                      rx={5}
                      fill="currentColor"
                      className="text-[#FAF9F5] dark:text-slate-800/60"
                    />

                    {/* Barra de valor com gradiente refinado */}
                    {d.hours > 0 && (
                      <rect
                        x={x}
                        y={y}
                        width={barWidth}
                        height={Math.max(barHeight, 3)}
                        rx={5}
                        fill={
                          d.isToday
                            ? "url(#barTodayGrad)"
                            : d.isWeekend
                            ? "url(#barWeekendGrad)"
                            : "url(#barWorkdayGrad)"
                        }
                        opacity={isHovered ? 1 : 0.88}
                        className="transition-all duration-200"
                      />
                    )}

                    {/* Destaque sutil no hover */}
                    {isHovered && (
                      <rect
                        x={x - 2}
                        y={Math.max(14, y - 2)}
                        width={barWidth + 4}
                        height={barHeight + 4}
                        rx={6}
                        fill="none"
                        stroke="#C15F3D"
                        strokeWidth={1.5}
                        className="dark:stroke-amber-400 animate-fade-in"
                      />
                    )}

                    {/* Valor numérico no topo da barra */}
                    {d.hours > 0 && (
                      <text
                        x={x + barWidth / 2}
                        y={y - 4}
                        textAnchor="middle"
                        fontSize={7.5}
                        fontWeight={600}
                        fill="currentColor"
                        className={`font-mono-data ${
                          d.isToday
                            ? "text-[#C15F3D] dark:text-amber-400 font-bold"
                            : "text-[#706E6A] dark:text-slate-400"
                        }`}
                      >
                        {d.hours}
                      </text>
                    )}

                    {/* Rótulo do Dia no Eixo X */}
                    <text
                      x={x + barWidth / 2}
                      y={chartHeight + 15}
                      textAnchor="middle"
                      fontSize={7.5}
                      fontWeight={d.isToday ? 700 : 500}
                      fill="currentColor"
                      className={`font-sans ${
                        d.isToday
                          ? "text-[#C15F3D] dark:text-amber-400"
                          : d.isWeekend
                          ? "text-slate-400 dark:text-slate-500"
                          : "text-[#706E6A] dark:text-slate-400"
                      }`}
                    >
                      {d.date.getDate()}
                    </text>

                    {/* Ponto indicador de "Hoje" */}
                    {d.isToday && (
                      <circle
                        cx={x + barWidth / 2}
                        cy={chartHeight + 24}
                        r={2.5}
                        fill="#C15F3D"
                        className="dark:fill-amber-400"
                      />
                    )}
                  </g>
                );
              })}

              <defs>
                <linearGradient id="barWorkdayGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#C15F3D" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#C15F3D" stopOpacity="0.45" />
                </linearGradient>
                <linearGradient id="barTodayGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F97316" stopOpacity="1" />
                  <stop offset="100%" stopColor="#C15F3D" stopOpacity="0.75" />
                </linearGradient>
                <linearGradient id="barWeekendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#94A3B8" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#94A3B8" stopOpacity="0.35" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {/* Tooltip Interativo no Hover */}
          {hoveredIndex !== null && dailyData[hoveredIndex] && (
            <div className="mt-2.5 p-2.5 rounded-xl border border-[#E5E2DC] dark:border-slate-800 bg-[#FAF9F5] dark:bg-slate-950/70 flex flex-wrap items-center justify-between gap-3 text-xs animate-fade-in">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[#171715] dark:text-slate-100">
                  {dailyData[hoveredIndex].weekdayLabel}, {dailyData[hoveredIndex].dateStr}
                </span>
                {dailyData[hoveredIndex].isToday && (
                  <span className="text-[10px] font-bold text-[#C15F3D] dark:text-amber-400 uppercase tracking-wide">
                    • Hoje
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 text-2xs font-mono-data">
                <span className="text-[#171715] dark:text-slate-200">
                  <strong className="text-sm font-bold text-[#C15F3D] dark:text-amber-400">
                    {dailyData[hoveredIndex].hours}h
                  </strong>{" "}
                  acumuladas ({formatDuration(dailyData[hoveredIndex].totalSeconds)})
                </span>
                <span className="text-[#706E6A] dark:text-slate-400 flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {dailyData[hoveredIndex].activeMembers} discentes presentes
                </span>
                <span className="text-[#706E6A] dark:text-slate-400">
                  {dailyData[hoveredIndex].sessionCount} registros
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CONTEÚDO MODO 2: TENDÊNCIA / ÁREA CONTÍNUA */}
      {mode === "trend" && (
        <div className="relative">
          <div className="overflow-x-auto pb-1">
            <svg
              width="100%"
              viewBox={`0 0 ${totalSvgWidth} ${chartHeight + 36}`}
              className="min-w-[320px] select-none"
              role="img"
              aria-label="Gráfico de curva de tendência"
            >
              {/* Linhas de Grade e Eixo Y */}
              {[0.25, 0.5, 0.75, 1].map((ratio) => {
                const y = chartHeight - ratio * (chartHeight - 16);
                const value = Math.round(ratio * maxHours);
                return (
                  <g key={ratio}>
                    <line
                      x1={yAxisWidth}
                      y1={y}
                      x2={totalSvgWidth - 8}
                      y2={y}
                      stroke="currentColor"
                      strokeWidth={0.6}
                      strokeDasharray="3,3"
                      className="text-[#E5E2DC] dark:text-slate-800"
                    />
                    <text
                      x={yAxisWidth - 6}
                      y={y + 3}
                      textAnchor="end"
                      fontSize={8}
                      fill="currentColor"
                      className="text-[#706E6A] dark:text-slate-500 font-mono-data"
                    >
                      {value}h
                    </text>
                  </g>
                );
              })}

              {/* Área preenchida com gradiente */}
              {trendAreaPath && (
                <path d={trendAreaPath} fill="url(#trendAreaGrad)" opacity={0.4} />
              )}

              {/* Linha da Curva Bezier */}
              {trendPath && (
                <path
                  d={trendPath}
                  fill="none"
                  stroke="#C15F3D"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  className="dark:stroke-amber-400"
                />
              )}

              {/* Pontos nos Vértices com Interatividade */}
              {dailyData.map((d, i) => {
                const gap = graphWidth / Math.max(dailyData.length - 1, 1);
                const cx = yAxisWidth + i * gap;
                const cy = chartHeight - (d.hours / maxHours) * (chartHeight - 16);
                const isHovered = hoveredIndex === i;

                return (
                  <g
                    key={d.dateStr}
                    onMouseEnter={() => setHoveredIndex(i)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    className="cursor-pointer"
                  >
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isHovered ? 5 : d.isToday ? 4 : 3}
                      fill={d.isToday ? "#F97316" : "#C15F3D"}
                      stroke="white"
                      strokeWidth={1.5}
                      className="dark:stroke-slate-900 transition-all duration-150"
                    />
                    {d.hours > 0 && (
                      <text
                        x={cx}
                        y={cy - 7}
                        textAnchor="middle"
                        fontSize={7.5}
                        fontWeight={600}
                        fill="currentColor"
                        className="font-mono-data text-[#171715] dark:text-slate-200"
                      >
                        {d.hours}
                      </text>
                    )}

                    {/* Label do dia */}
                    <text
                      x={cx}
                      y={chartHeight + 15}
                      textAnchor="middle"
                      fontSize={7.5}
                      fontWeight={d.isToday ? 700 : 500}
                      fill="currentColor"
                      className={`font-sans ${
                        d.isToday
                          ? "text-[#C15F3D] dark:text-amber-400 font-bold"
                          : "text-[#706E6A] dark:text-slate-400"
                      }`}
                    >
                      {d.date.getDate()}
                    </text>
                  </g>
                );
              })}

              <defs>
                <linearGradient id="trendAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#C15F3D" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#C15F3D" stopOpacity="0.02" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {/* Destaque sob hover da tendência */}
          {hoveredIndex !== null && dailyData[hoveredIndex] && (
            <div className="mt-2.5 p-2.5 rounded-xl border border-[#E5E2DC] dark:border-slate-800 bg-[#FAF9F5] dark:bg-slate-950/70 flex items-center justify-between text-xs animate-fade-in">
              <span className="font-semibold text-[#171715] dark:text-slate-100">
                {dailyData[hoveredIndex].weekdayLabel}, {dailyData[hoveredIndex].dateStr}
              </span>
              <span className="font-mono-data text-xs text-[#C15F3D] dark:text-amber-400 font-bold">
                {dailyData[hoveredIndex].hours} horas ({dailyData[hoveredIndex].activeMembers} discentes)
              </span>
            </div>
          )}
        </div>
      )}

      {/* CONTEÚDO MODO 3: DISTRIBUIÇÃO POR TURNOS */}
      {mode === "shifts" && (
        <div className="space-y-4 py-2 animate-fade-in">
          {/* Barra de Distribuição Empilhada 100% */}
          <div>
            <div className="flex items-center justify-between text-2xs font-sans text-[#706E6A] dark:text-slate-400 mb-1.5">
              <span>Densidade de Permanência no Laboratório</span>
              <span className="font-mono-data font-semibold text-[#171715] dark:text-slate-200">
                {shiftStats.totalHours}h no período
              </span>
            </div>
            <div className="h-4 w-full rounded-full overflow-hidden flex bg-slate-100 dark:bg-slate-800 p-0.5 border border-[#E5E2DC] dark:border-slate-700">
              <div
                style={{ width: `${shiftStats.morning.percent}%` }}
                className="h-full bg-amber-400 dark:bg-amber-500 rounded-l-full transition-all duration-500"
                title={`Manhã: ${shiftStats.morning.percent}%`}
              />
              <div
                style={{ width: `${shiftStats.afternoon.percent}%` }}
                className="h-full bg-[#C15F3D] dark:bg-amber-600 transition-all duration-500"
                title={`Tarde: ${shiftStats.afternoon.percent}%`}
              />
              <div
                style={{ width: `${shiftStats.evening.percent}%` }}
                className="h-full bg-indigo-500 dark:bg-indigo-600 rounded-r-full transition-all duration-500"
                title={`Noite: ${shiftStats.evening.percent}%`}
              />
            </div>
          </div>

          {/* Cards dos Turnos */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Manhã */}
            <div className="rounded-2xl border border-[#E5E2DC] dark:border-slate-800 bg-[#FAF9F5]/70 dark:bg-slate-950/40 p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  <span className="text-xs font-semibold text-[#171715] dark:text-slate-200 font-sans">
                    Manhã (08h–12h)
                  </span>
                </div>
                <span className="font-mono-data text-xs font-bold text-amber-600 dark:text-amber-400">
                  {shiftStats.morning.percent}%
                </span>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-xl font-bold font-mono-data text-[#171715] dark:text-slate-100">
                  {shiftStats.morning.hours}h
                </span>
                <span className="text-2xs text-[#706E6A] dark:text-slate-400">
                  {shiftStats.morning.count} check-ins
                </span>
              </div>
            </div>

            {/* Tarde */}
            <div className="rounded-2xl border border-[#E5E2DC] dark:border-slate-800 bg-[#FAF9F5]/70 dark:bg-slate-950/40 p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-[#C15F3D]" />
                  <span className="text-xs font-semibold text-[#171715] dark:text-slate-200 font-sans">
                    Tarde (12h–18h)
                  </span>
                </div>
                <span className="font-mono-data text-xs font-bold text-[#C15F3D] dark:text-orange-400">
                  {shiftStats.afternoon.percent}%
                </span>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-xl font-bold font-mono-data text-[#171715] dark:text-slate-100">
                  {shiftStats.afternoon.hours}h
                </span>
                <span className="text-2xs text-[#706E6A] dark:text-slate-400">
                  {shiftStats.afternoon.count} check-ins
                </span>
              </div>
            </div>

            {/* Noite */}
            <div className="rounded-2xl border border-[#E5E2DC] dark:border-slate-800 bg-[#FAF9F5]/70 dark:bg-slate-950/40 p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
                  <span className="text-xs font-semibold text-[#171715] dark:text-slate-200 font-sans">
                    Noite (18h–22h)
                  </span>
                </div>
                <span className="font-mono-data text-xs font-bold text-indigo-600 dark:text-indigo-400">
                  {shiftStats.evening.percent}%
                </span>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-xl font-bold font-mono-data text-[#171715] dark:text-slate-100">
                  {shiftStats.evening.hours}h
                </span>
                <span className="text-2xs text-[#706E6A] dark:text-slate-400">
                  {shiftStats.evening.count} check-ins
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Legenda de apoio */}
      {mode !== "shifts" && (
        <div className="flex flex-wrap items-center gap-4 mt-3 pt-2.5 border-t border-[#E5E2DC]/60 dark:border-slate-800 text-2xs font-sans text-[#706E6A] dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-[#C15F3D]" />
            <span>Dias úteis</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-slate-400" />
            <span>Fim de semana</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-orange-500 ring-2 ring-orange-200 dark:ring-orange-950" />
            <span className="font-semibold text-[#C15F3D] dark:text-amber-400">Hoje</span>
          </div>
        </div>
      )}
    </div>
  );
}
