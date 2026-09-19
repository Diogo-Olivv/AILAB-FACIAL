import {
  CheckCircle2,
  ShieldAlert,
  UserX,
  Focus,
  ScanFace,
  AlertCircle,
  LogIn,
  LogOut,
  Info,
  Cpu,
  Maximize2,
  RefreshCw,
  BarChart3,
} from "lucide-react";
import type { RecognitionAnalysisResult } from "../lib/recognitionService";

interface ResultPanelProps {
  result: RecognitionAnalysisResult;
  onReset: () => void;
  onViewDashboard?: () => void;
}

export function ResultPanel({ result, onReset, onViewDashboard }: ResultPanelProps) {
  const isSuccess = result.recognized && result.status === "ok";
  const isSpoof = result.status === "spoof_detected";
  const isUnknown = result.status === "not_recognized";
  const isBlur = result.status === "blur_detected";
  const isNoFace = result.status === "no_face";

  const confidencePct = (result.confidence * 100).toFixed(1);

  return (
    <div
      className="flex flex-col items-center gap-6 w-full max-w-xl animate-fade-in"
      aria-labelledby="result-title"
    >
      {/* Banner Principal de Status */}
      <div
        className={`flex flex-col items-center text-center p-6 sm:p-8 rounded-3xl border w-full gap-3 shadow-xs ${
          isSuccess
            ? "border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-950/30 dark:border-emerald-500/30"
            : isSpoof
            ? "border-destructive/30 bg-destructive/10 dark:bg-destructive/20"
            : isUnknown
            ? "border-amber-500/30 bg-amber-500/10 dark:bg-amber-950/30"
            : "border-[#E5E2DC] dark:border-slate-800 bg-card dark:bg-slate-900"
        }`}
      >
        <div className="flex items-center justify-center">
          {isSuccess ? (
            <CheckCircle2 className="h-12 w-12 text-emerald-500 animate-scale-up" />
          ) : isSpoof ? (
            <ShieldAlert className="h-12 w-12 text-destructive animate-scale-up" />
          ) : isUnknown ? (
            <UserX className="h-12 w-12 text-amber-600 dark:text-amber-400 animate-scale-up" />
          ) : isBlur ? (
            <Focus className="h-12 w-12 text-slate-500 dark:text-slate-400 animate-scale-up" />
          ) : isNoFace ? (
            <ScanFace className="h-12 w-12 text-slate-500 dark:text-slate-400 animate-scale-up" />
          ) : (
            <AlertCircle className="h-12 w-12 text-amber-500 animate-scale-up" />
          )}
        </div>

        <div className="space-y-1">
          <h2
            id="result-title"
            className={`text-xl sm:text-2xl font-extrabold ${
              isSuccess
                ? "text-emerald-600 dark:text-emerald-400"
                : isSpoof
                ? "text-destructive"
                : isUnknown
                ? "text-amber-700 dark:text-amber-400"
                : "text-slate-900 dark:text-slate-100"
            }`}
          >
            {isSuccess
              ? "Identificação Biométrica Confirmada"
              : isSpoof
              ? "Falha de Vivacidade (Anti-Spoofing)"
              : isUnknown
              ? "Rosto Não Cadastrado na Base"
              : isBlur
              ? "Imagem Borrada ou com Pouca Luz"
              : "Rosto Não Detectado"}
          </h2>
          <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 max-w-md">{result.message}</p>
        </div>

        {/* Cartão do Integrante Reconhecido */}
        {isSuccess && result.name && (
          <div className="mt-3 flex items-center gap-3.5 rounded-2xl border border-emerald-500/20 bg-white/90 dark:bg-slate-800/90 px-5 py-3 shadow-2xs w-full max-w-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 dark:bg-slate-700 text-white font-extrabold text-base">
              {result.name
                .split(" ")
                .map((w) => w[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div className="text-left flex-1">
              <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100 block leading-tight">
                {result.name}
              </span>
              <span className="text-xs text-muted-foreground block">
                {result.matricula ? `Matrícula: ${result.matricula}` : "Integrante Ativo"}
              </span>
            </div>
            <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
              Presente
            </span>
          </div>
        )}

        {/* Registro de Evento de Presença */}
        {result.event && (
          <div className="inline-flex items-center gap-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3.5 py-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100 mt-1">
            {result.event.action === "check_in" ? (
              <>
                <LogIn className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Entrada computada no sistema</span>
              </>
            ) : result.event.action === "check_out" ? (
              <>
                <LogOut className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span>Saída registrada ({result.event.durationMinutes ?? 0} min)</span>
              </>
            ) : (
              <>
                <Info className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Presença já ativa</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Métricas Técnicas Explicadas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
        {/* 1. Similaridade Cosseno */}
        <div className="flex flex-col justify-between rounded-2xl border border-line dark:border-slate-800 bg-card dark:bg-slate-900 p-4">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Similaridade Cosseno
            </span>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
              {confidencePct}%
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  result.confidence >= 0.62 ? "bg-emerald-500" : "bg-amber-500"
                }`}
                style={{ width: `${Math.min(100, result.confidence * 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground leading-tight">
              Limiar de corte seguro: &ge; 62%
            </p>
          </div>
        </div>

        {/* 2. Distância Euclidiana L2 */}
        <div className="flex flex-col justify-between rounded-2xl border border-line dark:border-slate-800 bg-card dark:bg-slate-900 p-4">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Distância L2
            </span>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
              {result.distance.toFixed(3)}
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground leading-tight mt-3">
            Espaço métrico 512-D. Valores menores indicam maior proximidade do vetor.
          </p>
        </div>

        {/* 3. Anti-Spoofing Vivacidade */}
        <div className="flex flex-col justify-between rounded-2xl border border-line dark:border-slate-800 bg-card dark:bg-slate-900 p-4">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Score Vivacidade
            </span>
            <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
              {(result.livenessScore * 100).toFixed(0)}%
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground leading-tight mt-3">
            MiniFASNetV2. Detecção de ataque de apresentação (fotos/telas).
          </p>
        </div>
      </div>

      {/* Indicador de Transparência e Origem */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground w-full px-2">
        <span className="flex items-center gap-1.5">
          <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
          <span>
            Motor: {result.source === "cloud_run_api" ? "Cloud Run ArcFace API" : "Sandbox Local Calibrado"}
          </span>
        </span>

        <span className="flex items-center gap-1.5">
          <Maximize2 className="h-3.5 w-3.5 text-muted-foreground" />
          <span>
            Óptica: {result.opticalMetrics.width}x{result.opticalMetrics.height} · Nitidez {result.opticalMetrics.sharpnessScore}%
          </span>
        </span>
      </div>

      {/* Botões de Ação Final */}
      <div className="flex flex-wrap items-center justify-center gap-3 pt-2 w-full">
        <button
          onClick={onReset}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 px-6 py-3.5 text-sm font-bold text-white shadow-sm active:scale-95 cursor-pointer min-h-[44px] transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Realizar Nova Análise</span>
        </button>

        {onViewDashboard && (
          <button
            onClick={onViewDashboard}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-line dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-3.5 text-sm font-bold text-slate-900 dark:text-slate-100 shadow-2xs hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-95 cursor-pointer min-h-[44px] transition-colors"
          >
            <BarChart3 className="h-4 w-4" />
            <span>Ver no Painel de Horas</span>
          </button>
        )}
      </div>
    </div>
  );
}
