import { useEffect, useState, type ComponentType } from "react";
import { Shield, Sparkles, Binary, Search, Cpu, CheckCheck } from "lucide-react";

interface AnalysisProgressProps {
  onCancel?: () => void;
}

interface StepItem {
  id: number;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

const STEPS: StepItem[] = [
  { id: 1, label: "Emitindo desafio temporal anti-injeção", icon: Shield },
  { id: 2, label: "Avaliando vivacidade óptica (Anti-Spoofing)", icon: Sparkles },
  { id: 3, label: "Extraindo embedding vetorial ArcFace 512-D", icon: Binary },
  { id: 4, label: "Comparando distância no pgvector HNSW", icon: Search },
];

export function AnalysisProgress({ onCancel }: AnalysisProgressProps) {
  const [currentStep, setCurrentStep] = useState(1);

  useEffect(() => {
    const t1 = setTimeout(() => setCurrentStep(2), 250);
    const t2 = setTimeout(() => setCurrentStep(3), 600);
    const t3 = setTimeout(() => setCurrentStep(4), 950);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  return (
    <div
      className="flex flex-col items-center justify-center rounded-3xl border border-line bg-card p-8 sm:p-10 shadow-sm max-w-lg w-full gap-6 animate-fade-in"
      role="status"
      aria-live="polite"
      aria-label="Processamento biométrico em andamento"
    >
      {/* Spinner Circular com Pulso */}
      <div className="relative flex items-center justify-center">
        <div className="h-16 w-16 rounded-full border-4 border-navy/15 border-t-green animate-spin" />
        <span className="absolute flex items-center justify-center text-primary">
          <Cpu className="h-6 w-6 text-[#C15F3D] dark:text-amber-400" />
        </span>
      </div>

      <div className="text-center space-y-1">
        <h2 className="text-base sm:text-lg font-bold text-ink">
          Processando Análise Facial
        </h2>
        <p className="text-xs sm:text-sm text-muted">
          A inferência neural está sendo executada com descarte imediato do frame fotográfico.
        </p>
      </div>

      {/* Lista de Etapas Dinâmicas */}
      <div className="w-full space-y-2.5 bg-cream/60 dark:bg-slate-800/60 rounded-2xl p-4 border border-line/50">
        {STEPS.map((step) => {
          const isDone = currentStep > step.id;
          const isCurrent = currentStep === step.id;
          const IconComp = step.icon;

          return (
            <div
              key={step.id}
              className={`flex items-center gap-3 text-xs sm:text-sm transition-all ${
                isCurrent
                  ? "font-bold text-navy scale-[1.01]"
                  : isDone
                  ? "text-green font-semibold"
                  : "text-muted/60"
              }`}
            >
              <span className="flex items-center justify-center h-5 w-5 shrink-0">
                {isDone ? (
                  <CheckCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <IconComp className="h-4 w-4 text-[#706E6A] dark:text-slate-400" />
                )}
              </span>
              <span className="flex-1">{step.label}</span>
              {isCurrent && (
                <span className="relative flex h-2 w-2 items-center justify-center shrink-0">
                  <span className="absolute h-1.5 w-1.5 rounded-full bg-green opacity-75 animate-live-ping" />
                  <span className="relative h-1.5 w-1.5 rounded-full bg-green" />
                </span>
              )}
            </div>
          );
        })}
      </div>

      {onCancel && (
        <button
          onClick={onCancel}
          className="text-xs font-semibold text-muted hover:text-warn hover:underline cursor-pointer min-h-[44px] px-4"
        >
          Cancelar Análise
        </button>
      )}
    </div>
  );
}
