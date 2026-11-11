import { Link } from "react-router-dom";
import { SunMedium, MoonStar, Scale, KeyRound, RefreshCw, LogOut, Cpu, ShieldCheck } from "lucide-react";
import logo from "../ailab_makers.jpeg";
import { useTheme } from "../lib/useTheme";
import { InstallPwaButton } from "./InstallPwaButton";

export type SyncState = "connected" | "updating" | "delayed" | "error";

interface HeaderProps {
  user: any;
  signOut: () => Promise<void>;
  onOpenTerms: () => void;
  onOpenHowItWorks?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  presentCount?: number;
  lastRefreshed?: Date;
  syncState?: SyncState;
}

export function Header({
  user,
  signOut,
  onOpenTerms,
  onOpenHowItWorks,
  onRefresh,
  isRefreshing = false,
  presentCount,
  lastRefreshed,
  syncState = "connected",
}: HeaderProps) {
  const { isDark, toggleTheme } = useTheme();
  const showLive = typeof presentCount === "number";
  const syncTime = lastRefreshed
    ? lastRefreshed.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : null;

  const effectiveSyncState: SyncState = isRefreshing ? "updating" : syncState;

  const syncConfig = {
    connected: {
      badge: "bg-emerald-500/10 ring-emerald-500/20 text-emerald-800 dark:text-emerald-300",
      dot: "bg-emerald-500",
      label: "Atualizado",
      ping: false,
    },
    updating: {
      badge: "bg-amber-500/10 ring-amber-500/20 text-amber-800 dark:text-amber-300",
      dot: "bg-amber-500",
      label: "Atualizando...",
      ping: true,
    },
    delayed: {
      badge: "bg-amber-500/10 ring-amber-500/20 text-amber-800 dark:text-amber-300",
      dot: "bg-amber-500",
      label: "Atrasado",
      ping: false,
    },
    error: {
      badge: "bg-rose-500/10 ring-rose-500/20 text-rose-800 dark:text-rose-300",
      dot: "bg-rose-500",
      label: "Falha de conexão",
      ping: false,
    },
  }[effectiveSyncState];

  return (
    <header
      className="sticky top-0 z-40 h-16 border-b border-slate-200/90 dark:border-white/[0.1] bg-white/85 dark:bg-[#0F1623]/80 backdrop-blur-xl transition-colors"
      role="banner"
    >
      <div className="mx-auto max-w-7xl px-3.5 sm:px-6 lg:px-8 h-full flex items-center justify-between gap-2 sm:gap-4">
        {/* Esquerda: Identidade Institucional + Badge de Sincronização Ao Vivo (H1) */}
        <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
          <img
            src={logo}
            alt="AILAB Makers"
            className="w-9 h-9 min-w-[2.25rem] min-h-[2.25rem] aspect-square rounded-lg object-cover ring-1 ring-black/10 dark:ring-white/10 shrink-0 shadow-2xs"
          />
          <div className="min-w-0 flex items-center gap-2.5">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm sm:text-base font-bold tracking-tight text-slate-900 dark:text-white leading-none truncate">
                  AILAB <span className="text-orange-600 dark:text-amber-400">Makers</span>
                </span>
              </div>
              <p className="hidden lg:block text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-none mt-1 truncate">
                Telemetria Biométrica & Permanência Acadêmica
              </p>
            </div>

            {/* Badge de Status do Sistema (H1 — Visibilidade do Status) */}
            {showLive && (
              <div
                className={`hidden sm:inline-flex items-center gap-2 rounded-full ring-1 px-2.5 py-1 text-xs ${syncConfig.badge}`}
                aria-live="polite"
                title={
                  lastRefreshed
                    ? `${syncConfig.label} · Última resposta às ${lastRefreshed.toLocaleTimeString("pt-BR")} · ${presentCount} presente(s)`
                    : `${syncConfig.label} · ${presentCount} presente(s)`
                }
              >
                <span className="relative flex h-2 w-2 items-center justify-center shrink-0">
                  {syncConfig.ping && (
                    <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${syncConfig.dot}`} />
                  )}
                  <span className={`relative inline-flex h-2 w-2 rounded-full ${syncConfig.dot}`} />
                </span>
                <span className="font-semibold tabular-nums whitespace-nowrap">
                  {syncConfig.label}
                  {syncTime && effectiveSyncState === "connected" && (
                    <span className="hidden xl:inline font-mono-data text-[11px] opacity-80 ml-1">
                      · {syncTime}
                    </span>
                  )}
                </span>
                <span className="h-3 w-px bg-current opacity-25" aria-hidden="true" />
                <span className="font-mono-data font-bold tabular-nums whitespace-nowrap">
                  {presentCount} {presentCount === 1 ? "presente" : "presentes"}
                </span>
                {onRefresh && (
                  <button
                    type="button"
                    onClick={onRefresh}
                    disabled={isRefreshing}
                    className="ml-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full opacity-80 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50 cursor-pointer"
                    title="Atualizar dados agora"
                    aria-label="Atualizar dados agora"
                  >
                    <RefreshCw className={`h-3 w-3 ${isRefreshing ? "animate-spin" : ""}`} />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Centro/Direita: Controles Secundários + Divisor Vertical + Ação Primária */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Em mobile (< 640px): botão compacto de sincronização com ponto verde ao vivo */}
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="icon-btn sm:hidden relative"
              title={
                showLive
                  ? `Sincronizar agora (${presentCount} no laboratório)`
                  : "Sincronizar agora"
              }
              aria-label="Sincronizar dados agora"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin text-orange-500" : ""}`} />
              {showLive && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#161F30]" />
              )}
            </button>
          )}

          {/* Como Funciona (H10 — Ajuda e Documentação) */}
          {onOpenHowItWorks && (
            <button
              type="button"
              onClick={onOpenHowItWorks}
              className="hidden xl:inline-flex btn-secondary !min-h-[38px] !px-3"
              title="Entenda o pipeline biométrico InsightFace ArcFace 512-D"
              aria-label="Como funciona o reconhecimento facial"
            >
              <Cpu className="h-3.5 w-3.5 text-orange-500 dark:text-amber-400 shrink-0" />
              <span>Como Funciona</span>
            </button>
          )}

          {/* Termos LGPD */}
          <button
            type="button"
            onClick={onOpenTerms}
            className="hidden xl:inline-flex btn-secondary !min-h-[38px] !px-3"
            title="Políticas de Privacidade Biométrica (LGPD Art. 11)"
            aria-label="Políticas de Privacidade Biométrica LGPD"
          >
            <Scale className="h-3.5 w-3.5 text-orange-500 dark:text-amber-400 shrink-0" />
            <span>Termos LGPD</span>
          </button>

          {/* Instalação PWA */}
          <InstallPwaButton />

          {/* Alternador de Tema Claro/Escuro */}
          <button
            type="button"
            onClick={toggleTheme}
            className="icon-btn"
            title={isDark ? "Mudar para Modo Claro" : "Mudar para Modo Escuro"}
            aria-label={isDark ? "Mudar para Modo Claro" : "Mudar para Modo Escuro"}
          >
            {isDark ? (
              <SunMedium className="h-4 w-4 text-amber-400" />
            ) : (
              <MoonStar className="h-4 w-4 text-slate-700" />
            )}
          </button>

          {/* Divisor Vertical (Desktop) */}
          <div className="hidden md:block h-5 w-px bg-slate-200 dark:bg-white/10 mx-0.5" aria-hidden="true" />

          {/* Ação Primária: Acesso Tutor ou Sessão Ativa do Tutor */}
          {user ? (
            <div className="flex items-center gap-1.5">
              <span className="hidden xl:inline-flex items-center gap-1.5 rounded-xl bg-orange-500/10 dark:bg-orange-500/15 ring-1 ring-orange-500/25 px-2.5 py-1.5 text-2xs font-mono-data font-semibold text-orange-700 dark:text-orange-300">
                <ShieldCheck className="h-3.5 w-3.5 text-orange-500 dark:text-amber-400 shrink-0" />
                <span>{user.email ? user.email.replace(/@ailab\.com$/i, "") : "Tutor"}</span>
              </span>
              <button
                type="button"
                onClick={signOut}
                className="inline-flex min-h-[44px] sm:min-h-[38px] items-center justify-center gap-1.5 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-500/20 active:scale-[0.98] transition-all cursor-pointer"
                title="Encerrar sessão de tutor"
                aria-label="Encerrar sessão de tutor"
              >
                <LogOut className="h-3.5 w-3.5 shrink-0" />
                <span>Sair</span>
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="btn-primary !px-3.5"
              title="Área administrativa de tutores e coordenadores"
              aria-label="Acessar área administrativa de tutores"
            >
              <KeyRound className="h-3.5 w-3.5 shrink-0" />
              <span className="sm:hidden">Tutor</span>
              <span className="hidden sm:inline">Acesso Tutor</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
