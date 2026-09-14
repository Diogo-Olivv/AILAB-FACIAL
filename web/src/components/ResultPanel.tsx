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
            ? "border-green/30 bg-green/10"
            : isSpoof
            ? "border-warn/30 bg-warn/10"
            : isUnknown
            ? "border-amber-500/30 bg-amber-500/10"
            : "border-line bg-card"
        }`}
      >
        <span className="text-4xl sm:text-5xl">
          {isSuccess
            ? "✅"
            : isSpoof
            ? "🚫"
            : isUnknown
            ? "👤"
            : isBlur
            ? "🔍"
            : isNoFace
            ? "❓"
            : "⚠️"}
        </span>

        <div className="space-y-1">
          <h2
            id="result-title"
            className={`text-xl sm:text-2xl font-extrabold ${
              isSuccess
                ? "text-green"
                : isSpoof
                ? "text-warn"
                : isUnknown
                ? "text-amber-800"
                : "text-ink"
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
          <p className="text-xs sm:text-sm text-ink/80 max-w-md">{result.message}</p>
        </div>

        {/* Cartão do Integrante Reconhecido */}
        {isSuccess && result.name && (
          <div className="mt-3 flex items-center gap-3.5 rounded-2xl border border-green/20 bg-white/90 px-5 py-3 shadow-2xs w-full max-w-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-navy text-white font-extrabold text-base">
              {result.name
                .split(" ")
                .map((w) => w[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div className="text-left flex-1">
              <span className="text-sm font-extrabold text-ink block leading-tight">
                {result.name}
              </span>
              <span className="text-xs text-muted block">
                {result.matricula ? `Matrícula: ${result.matricula}` : "Integrante Ativo"}
              </span>
            </div>
            <span className="rounded-full bg-green/15 px-2.5 py-0.5 text-[11px] font-bold text-green">
              Presente
            </span>
          </div>
        )}

        {/* Registro de Evento de Presença */}
        {result.event && (
          <div className="inline-flex items-center gap-2 rounded-xl bg-navy/10 px-3.5 py-1.5 text-xs font-bold text-navy mt-1">
            <span>
              {result.event.action === "check_in"
                ? "🟢 Entrada computada no sistema"
                : result.event.action === "check_out"
                ? `🔵 Saída registrada (${result.event.durationMinutes ?? 0} min)`
                : "ℹ️ Presença já ativa"}
            </span>
          </div>
        )}
      </div>

      {/* Métricas Técnicas Explicadas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
        {/* 1. Similaridade Cosseno */}
        <div className="flex flex-col justify-between rounded-2xl border border-line bg-card p-4">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
              Similaridade Cosseno
            </span>
            <div className="text-2xl font-extrabold text-navy">
              {confidencePct}%
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            <div className="h-2 w-full rounded-full bg-navy/10 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  result.confidence >= 0.62 ? "bg-green" : "bg-amber-500"
                }`}
                style={{ width: `${Math.min(100, result.confidence * 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-muted leading-tight">
              Limiar de corte seguro: &ge; 62%
            </p>
          </div>
        </div>

        {/* 2. Distância Euclidiana L2 */}
        <div className="flex flex-col justify-between rounded-2xl border border-line bg-card p-4">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
              Distância L2
            </span>
            <div className="text-2xl font-extrabold text-navy">
              {result.distance.toFixed(3)}
            </div>
          </div>
          <p className="text-[10px] text-muted leading-tight mt-3">
            Espaço métrico 512-D. Valores menores indicam maior proximidade do vetor.
          </p>
        </div>

        {/* 3. Anti-Spoofing Vivacidade */}
        <div className="flex flex-col justify-between rounded-2xl border border-line bg-card p-4">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
              Score Vivacidade
            </span>
            <div className="text-2xl font-extrabold text-green">
              {(result.livenessScore * 100).toFixed(0)}%
            </div>
          </div>
          <p className="text-[10px] text-muted leading-tight mt-3">
            MiniFASNetV2. Detecção de ataque de apresentação (fotos/telas).
          </p>
        </div>
      </div>

      {/* Indicador de Transparência e Origem */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted w-full px-2">
        <span className="flex items-center gap-1.5">
          <span>⚙️</span>
          <span>
            Motor: {result.source === "cloud_run_api" ? "Cloud Run ArcFace API" : "Sandbox Local Calibrado"}
          </span>
        </span>

        <span className="flex items-center gap-1.5">
          <span>📏</span>
          <span>
            Óptica: {result.opticalMetrics.width}x{result.opticalMetrics.height} · Nitidez {result.opticalMetrics.sharpnessScore}%
          </span>
        </span>
      </div>

      {/* Botões de Ação Final */}
      <div className="flex flex-wrap items-center justify-center gap-3 pt-2 w-full">
        <button
          onClick={onReset}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-green px-6 py-3.5 text-sm font-bold text-white shadow-sm hover:bg-green/90 active:scale-95 cursor-pointer min-h-[44px]"
        >
          <span>🔄</span>
          <span>Realizar Nova Análise</span>
        </button>

        {onViewDashboard && (
          <button
            onClick={onViewDashboard}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-line bg-white px-5 py-3.5 text-sm font-bold text-navy shadow-2xs hover:bg-navy/5 active:scale-95 cursor-pointer min-h-[44px]"
          >
            <span>📊</span>
            <span>Ver no Painel de Horas</span>
          </button>
        )}
      </div>
    </div>
  );
}
