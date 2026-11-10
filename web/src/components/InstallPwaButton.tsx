import { useEffect, useState } from "react";
import { CheckCircle2, Smartphone } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function InstallPwaButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    // Verifica se já está rodando em modo standalone
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      // Verifica se é iOS para exibir dica de instalação
      const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;
      if (isIos) {
        setShowIosGuide(true);
      }
    }
  };

  if (isInstalled) {
    return (
      <span className="hidden lg:inline-flex items-center gap-1 text-2xs font-sans font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 px-2.5 py-1 rounded-full">
        <CheckCircle2 className="h-3 w-3" />
        App Instalado
      </span>
    );
  }

  // O botão só aparece quando existe uma ação real: prompt nativo disponível
  // ou iOS (onde a instalação é manual e o clique mostra as instruções).
  const isIosDevice =
    typeof navigator !== "undefined" &&
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !(window as unknown as { MSStream?: unknown }).MSStream;
  if (!deferredPrompt && !isIosDevice) {
    return null;
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={handleInstallClick}
        aria-label="Baixar App (PWA) - Instalar no dispositivo"
        className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-orange-200 dark:border-amber-500/30 bg-orange-50 dark:bg-amber-500/10 px-2.5 lg:px-3 text-xs font-sans font-semibold text-[#8F371B] dark:text-amber-200 hover:bg-orange-100 dark:hover:bg-amber-500/20 transition-colors cursor-pointer"
      >
        <Smartphone className="h-3.5 w-3.5" />
        <span className="hidden lg:inline">Baixar App</span>
      </button>

      {showIosGuide && (
        <div
          role="dialog"
          aria-label="Instruções de instalação para iOS"
          className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 shadow-card-hover z-50 text-xs text-slate-900 dark:text-slate-200 animate-fade-in"
        >
          <p className="font-semibold text-xs mb-1">Como instalar no iPhone/iPad:</p>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-[11px] leading-relaxed">
            <li>Toque no botão <strong>Compartilhar</strong> no Safari.</li>
            <li>Role para baixo e selecione <strong>Adicionar à Tela de Início</strong>.</li>
          </ol>
          <button
            type="button"
            onClick={() => setShowIosGuide(false)}
            className="mt-2 w-full text-center text-[10px] text-muted-foreground hover:text-foreground underline"
          >
            Entendido
          </button>
        </div>
      )}
    </div>
  );
}
