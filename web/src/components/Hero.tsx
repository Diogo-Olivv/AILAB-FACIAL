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

      <div className="relative z-10 max-w-3xl space-y-5">
        {/* Badge Institucional */}
        <div className="inline-flex items-center gap-2 rounded-full border border-green/30 bg-green/10 px-3.5 py-1 text-xs font-extrabold text-green">
          <span className="h-2 w-2 rounded-full bg-green animate-pulse" />
          <span>AiLab Makers · Sistema de Frequência & Visão Computacional</span>
        </div>

        {/* Título Principal */}
        <h1
          id="hero-title"
          className="text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-ink leading-tight"
        >
          Reconhecimento Facial Inteligente com Total Respeito à sua Privacidade
        </h1>

        {/* Subtítulo Claro para Leigos e Especialistas */}
        <p className="text-sm sm:text-base lg:text-lg text-muted leading-relaxed">
          Substitua listas manuais por presença ágil e segura. O sistema analisa marcos faciais,
          compara vetores normalizados de 512 dimensões (InsightFace) e calcula o tempo de
          permanência no laboratório com descarte imediato dos frames fotográficos.
        </p>

        {/* Destaques Técnicos Rápidos */}
        <div className="flex flex-wrap gap-2.5 pt-1 text-xs font-semibold text-ink/80">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-line/80 bg-white/80 px-2.5 py-1 shadow-2xs">
            ✨ MiniFASNetV2 Anti-Spoofing
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-line/80 bg-white/80 px-2.5 py-1 shadow-2xs">
            📐 pgvector HNSW 512-D
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-line/80 bg-white/80 px-2.5 py-1 shadow-2xs">
            🔒 LGPD Art. 11 (Memória Volátil)
          </span>
        </div>

        {/* CTAs de Ação Imediata */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            onClick={onStartAnalysis}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-green px-6 py-3.5 text-sm sm:text-base font-extrabold text-white shadow-sm transition-all hover:bg-green/90 active:scale-95 cursor-pointer min-h-[44px]"
          >
            <span>📷</span>
            <span>Iniciar Análise Facial</span>
          </button>

          <button
            onClick={onViewDashboard}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-navy/20 bg-white px-5 py-3.5 text-sm sm:text-base font-bold text-navy shadow-2xs transition-all hover:bg-navy/5 active:scale-95 cursor-pointer min-h-[44px]"
          >
            <span>📊</span>
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
          <span className="text-base">🛡️</span>
          <span>
            <strong>Privacidade por Design:</strong> As fotos são processadas apenas em memória volátil
            e imediatamente descartadas após a inferência. Nenhuma imagem é gravada no banco de dados.
          </span>
        </div>
      </div>
    </section>
  );
}
