import { useState } from "react";
import { Camera, FolderOpen, AlertCircle } from "lucide-react";
import { WebcamCapture } from "./WebcamCapture";
import { ImageUploader } from "./ImageUploader";
import { AnalysisProgress } from "./AnalysisProgress";
import { ResultPanel } from "./ResultPanel";
import { executeFacialAnalysis, type RecognitionAnalysisResult } from "../lib/recognitionService";
import type { Member } from "../lib/reports";

interface AnalysisWorkflowProps {
  members: Member[];
  onAnalysisSuccess?: (result: RecognitionAnalysisResult) => void;
  onViewDashboard?: () => void;
}

export function AnalysisWorkflow({
  members,
  onAnalysisSuccess,
  onViewDashboard,
}: AnalysisWorkflowProps) {
  const [sourceMode, setSourceMode] = useState<"camera" | "upload">("camera");
  const [action, setAction] = useState<"auto" | "check_in" | "check_out">("auto");
  const [isProcessing, setIsProcessing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<RecognitionAnalysisResult | null>(null);
  const [errorAlert, setErrorAlert] = useState<string | null>(null);

  const runAnalysis = async (fileOrBlob: Blob | File) => {
    setIsProcessing(true);
    setErrorAlert(null);
    setAnalysisResult(null);

    try {
      const result = await executeFacialAnalysis(fileOrBlob, action, members);
      setAnalysisResult(result);
      if (result.recognized && onAnalysisSuccess) {
        onAnalysisSuccess(result);
      }
    } catch (err: any) {
      setErrorAlert(err?.message || "Não foi possível concluir a análise facial. Tente novamente.");
    } finally {
      setIsProcessing(false);
    }
  };

  const resetAnalysis = () => {
    setAnalysisResult(null);
    setErrorAlert(null);
    setIsProcessing(false);
  };

  return (
    <section
      id="analise-facial"
      className="flex flex-col items-center rounded-3xl border border-line bg-card/80 p-6 sm:p-10 shadow-xs space-y-6"
      aria-labelledby="analysis-section-title"
    >
      {/* Cabeçalho do Módulo */}
      <div className="text-center max-w-xl space-y-2">
        <span className="rounded-full bg-navy/10 px-3 py-1 text-xs font-extrabold text-navy uppercase tracking-wider">
          Módulo de Verificação
        </span>
        <h2
          id="analysis-section-title"
          className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink"
        >
          Análise Facial e Check-in com IA
        </h2>
        <p className="text-xs sm:text-sm text-muted">
          Utilize sua webcam ou envie uma foto recente. O modelo InsightFace calcula o vetor biométrico
          e verifica a similaridade cosseno em tempo real.
        </p>
      </div>

      {/* Se não houver resultado nem processamento: Exibe os Controles de Entrada */}
      {!isProcessing && !analysisResult && (
        <div className="flex flex-col items-center w-full max-w-lg space-y-5">
          {/* Seletor de Origem (Abas Câmera vs Upload) */}
          <div
            role="tablist"
            aria-label="Escolha a origem da foto"
            className="flex items-center gap-1 rounded-2xl border border-line/80 bg-cream/70 p-1.5 w-full max-w-xs justify-center"
          >
            <button
              role="tab"
              aria-selected={sourceMode === "camera"}
              onClick={() => setSourceMode("camera")}
              className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2 px-3 text-xs sm:text-sm font-bold transition-all cursor-pointer min-h-[44px] ${
                sourceMode === "camera"
                  ? "bg-navy text-white shadow-xs"
                  : "text-ink/80 hover:text-ink hover:bg-navy/5"
              }`}
            >
              <Camera className="h-4 w-4" />
              <span>Câmera</span>
            </button>

            <button
              role="tab"
              aria-selected={sourceMode === "upload"}
              onClick={() => setSourceMode("upload")}
              className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2 px-3 text-xs sm:text-sm font-bold transition-all cursor-pointer min-h-[44px] ${
                sourceMode === "upload"
                  ? "bg-navy text-white shadow-xs"
                  : "text-ink/80 hover:text-ink hover:bg-navy/5"
              }`}
            >
              <FolderOpen className="h-4 w-4" />
              <span>Upload</span>
            </button>
          </div>

          {/* Seletor de Ação de Presença */}
          <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-semibold">
            <span className="text-muted">Ação desejada:</span>
            <div className="inline-flex rounded-xl border border-line bg-white p-1">
              <button
                onClick={() => setAction("auto")}
                className={`rounded-lg px-3 py-1.5 transition-all cursor-pointer ${
                  action === "auto" ? "bg-navy text-white font-bold" : "text-ink hover:bg-navy/5"
                }`}
              >
                Automática
              </button>
              <button
                onClick={() => setAction("check_in")}
                className={`rounded-lg px-3 py-1.5 transition-all cursor-pointer ${
                  action === "check_in" ? "bg-green text-white font-bold" : "text-ink hover:bg-navy/5"
                }`}
              >
                Entrada
              </button>
              <button
                onClick={() => setAction("check_out")}
                className={`rounded-lg px-3 py-1.5 transition-all cursor-pointer ${
                  action === "check_out" ? "bg-navy text-white font-bold" : "text-ink hover:bg-navy/5"
                }`}
              >
                Saída
              </button>
            </div>
          </div>

          {/* Área Interativa de Captura */}
          <div className="w-full">
            {sourceMode === "camera" ? (
              <WebcamCapture onCapture={runAnalysis} />
            ) : (
              <ImageUploader onFileSelected={runAnalysis} />
            )}
          </div>
        </div>
      )}

      {/* Em Processamento */}
      {isProcessing && (
        <AnalysisProgress onCancel={() => setIsProcessing(false)} />
      )}

      {/* Resultados da Análise */}
      {analysisResult && (
        <ResultPanel
          result={analysisResult}
          onReset={resetAnalysis}
          onViewDashboard={onViewDashboard}
        />
      )}

      {/* Alerta de Erro */}
      {errorAlert && (
        <div
          role="alert"
          className="flex items-center justify-between rounded-2xl border border-warn/30 bg-warn/10 p-4 text-xs sm:text-sm text-warn w-full max-w-lg"
        >
          <span className="flex items-center gap-1.5"><AlertCircle className="h-4 w-4 shrink-0" />{errorAlert}</span>
          <button
            onClick={resetAnalysis}
            className="font-bold underline hover:text-warn/80 cursor-pointer min-h-[44px] px-2"
          >
            Tentar de novo
          </button>
        </div>
      )}
    </section>
  );
}
