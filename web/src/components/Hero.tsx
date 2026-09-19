import { Sparkles, Binary, ShieldCheck, Camera, BarChart3, Shield } from "lucide-react";

interface HeroProps {
  onStartAnalysis: () => void;
  onViewDashboard: () => void;
  onOpenHowItWorks: () => void;
}

export function Hero({ onStartAnalysis, onViewDashboard, onOpenHowItWorks }: HeroProps) {
  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-card via-card to-cream p-6 sm:p-10 shadow-xs"
      aria-labelledby="hero-title"
    >
      {/* Luz decorativa de fundo suave (sem comprometer contraste) */}
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-green/5 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -left-20 -bottom-20 h-80 w-80 rounded-full bg-navy/5 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative z-10 max-w-2xl space-y-4">
        {/* Badge Institucional */}
        <div className="inline-flex items-center gap-2 rounded-full border border-green/30 bg-green/10 px-3.5 py-1 text-2xs sm:text-xs font-bold text-green tracking-wide">
          <span className="flex h-2 w-2 rounded-full bg-green animate-pulse" />
          IA & BIOMETRIA FACIAL · AILAB MAKERS
        </div>

        {/* Título Principal de Alto Impacto */}
        <h1
          id="hero-title"
          className="font-serif text-3xl sm:text-4xl md:text-5xl font-black text-ink tracking-tight leading-tight"
        >
          Reconhecimento Biométrico & Controle de Presença
        </h1>

        {/* Descrição Concisa */}
        <p className="text-sm sm:text-base text-muted leading-relaxed">
          Substitua listas manuais por presença ágil e segura. O sistema analisa marcos faciais,
          compara vetores normalizados de 512 dimensões (InsightFace) e calcula o tempo de
          permanência no laboratório com descarte imediato dos frames fotográficos.
        </p>

        {/* Destaques Técnicos Rápidos */}
        <div className="flex flex-wrap gap-2.5 pt-1 text-xs font-semibold text-ink/80">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-line/80 bg-white/80 px-2.5 py-1 shadow-2xs">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span>MiniFASNetV2 Anti-Spoofing</span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-line/80 bg-white/80 px-2.5 py-1 shadow-2xs">
            <Binary className="h-3.5 w-3.5 text-indigo-500" />
            <span>pgvector HNSW 512-D</span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-line/80 bg-white/80 px-2.5 py-1 shadow-2xs">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            <span>LGPD Art. 11 (Memória Volátil)</span>
          </span>
        </div>

        {/* CTAs de Ação Imediata */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            onClick={onStartAnalysis}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-green px-6 py-3.5 text-sm sm:text-base font-extrabold text-white shadow-sm transition-all hover:bg-green/90 active:scale-95 cursor-pointer min-h-[44px]"
          >
            <Camera className="h-4 w-4" />
            <span>Iniciar Análise Facial</span>
          </button>

          <button
            onClick={onViewDashboard}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-navy/20 bg-white px-5 py-3.5 text-sm sm:text-base font-bold text-navy shadow-2xs transition-all hover:bg-navy/5 active:scale-95 cursor-pointer min-h-[44px]"
          >
            <BarChart3 className="h-4 w-4" />
            <span>Ver Horas de Permanência</span>
          </button>

          <button
            onClick={onOpenHowItWorks}
            className="inline-flex items-center justify-center gap-1.5 rounded-2xl px-3.5 py-2 text-xs font-bold text-navy hover:underline cursor-pointer min-h-[44px]"
          >
            <span>Como funciona a IA? →</span>
          </button>
        </div>

        {/* Aviso de Confiança e Privacidade */}
        <div className="flex items-center gap-2.5 rounded-xl border border-line/60 bg-cream/60 px-4 py-2.5 text-xs text-muted">
          <Shield className="h-4 w-4 text-[#C15F3D] shrink-0" />
          <span>
            <strong>Privacidade por Design:</strong> As fotos são processadas apenas em memória volátil
            e imediatamente descartadas após a inferência. Nenhuma imagem é gravada no banco de dados.
          </span>
        </div>
      </div>
    </section>
  );
}
