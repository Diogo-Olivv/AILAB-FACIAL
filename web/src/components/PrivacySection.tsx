import { FileText, Zap, Lock, Scale } from "lucide-react";

interface PrivacySectionProps {
  onOpenFullTerms: () => void;
}

export function PrivacySection({ onOpenFullTerms }: PrivacySectionProps) {
  return (
    <section
      aria-labelledby="privacy-section-title"
      className="rounded-3xl border border-line dark:border-slate-800 bg-card/60 dark:bg-slate-900/60 p-6 sm:p-10 space-y-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line dark:border-slate-800 pb-4">
        <div className="space-y-1">
          <span className="rounded-full bg-emerald-500/15 dark:bg-emerald-500/20 px-2.5 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
            Transparência & Conformidade
          </span>
          <h2 id="privacy-section-title" className="text-xl sm:text-2xl font-extrabold text-ink dark:text-slate-100">
            Privacidade Biométrica e Proteção de Dados (LGPD Art. 11)
          </h2>
          <p className="text-xs sm:text-sm text-muted dark:text-slate-400">
            Entenda como seus dados são protegidos segundo as melhores práticas de privacidade por design.
          </p>
        </div>

        <button
          onClick={onOpenFullTerms}
          className="inline-flex items-center gap-2 rounded-xl border border-[#E5E2DC] dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs sm:text-sm font-bold text-[#171715] dark:text-slate-200 shadow-2xs hover:bg-[#F5F4F0] dark:hover:bg-slate-700 active:scale-95 cursor-pointer min-h-[44px]"
        >
          <FileText className="h-4 w-4 text-[#706E6A] dark:text-slate-400" />
          <span>Ler Termos Completos</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Memória Volátil */}
        <div className="rounded-2xl border border-line dark:border-slate-800 bg-white/80 dark:bg-slate-800/80 p-5 space-y-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
            <Zap className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-extrabold text-ink dark:text-slate-100">
            Descarte Imediato dos Frames
          </h3>
          <p className="text-xs text-muted dark:text-slate-400 leading-relaxed">
            As imagens da câmera são mantidas apenas na memória RAM enquanto o vetor de 512 números é extraído.
            Nenhum frame fotográfico é salvo em disco ou banco de dados.
          </p>
        </div>

        {/* Card 2: Isolamento de Embeddings */}
        <div className="rounded-2xl border border-line dark:border-slate-800 bg-white/80 dark:bg-slate-800/80 p-5 space-y-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <Lock className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-extrabold text-ink dark:text-slate-100">
            Isolamento Criptográfico & RLS
          </h3>
          <p className="text-xs text-muted dark:text-slate-400 leading-relaxed">
            A tabela de representações vetoriais é protegida por Row-Level Security restrito à
            chave de serviço do backend. Visitantes e navegadores não têm acesso aos vetores.
          </p>
        </div>

        {/* Card 3: Revogação e Direitos */}
        <div className="rounded-2xl border border-line dark:border-slate-800 bg-white/80 dark:bg-slate-800/80 p-5 space-y-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
            <Scale className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-extrabold text-ink dark:text-slate-100">
            Finalidade Estrita e Revogação
          </h3>
          <p className="text-xs text-muted dark:text-slate-400 leading-relaxed">
            Uso exclusivamente acadêmico para acompanhamento de presença. O titular pode revogar seu
            consentimento ou solicitar exclusão definitiva do perfil a qualquer momento junto ao tutor.
          </p>
        </div>
      </div>
    </section>
  );
}
