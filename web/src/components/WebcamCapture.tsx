import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, AlertTriangle, Aperture, SwitchCamera } from "lucide-react";

interface WebcamCaptureProps {
  onCapture: (blob: Blob) => void;
  disabled?: boolean;
}

export function WebcamCapture({ onCapture, disabled }: WebcamCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [permissionState, setPermissionState] = useState<"idle" | "requesting" | "granted" | "denied" | "unsupported">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");

  // Iniciar Stream
  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setPermissionState("unsupported");
      setErrorMessage("Seu navegador não oferece suporte à captura de vídeo via WebRTC.");
      return;
    }

    setPermissionState("requesting");
    setErrorMessage("");

    try {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      setStream(mediaStream);
      setPermissionState("granted");

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      setPermissionState("denied");
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setErrorMessage("Permissão da câmera negada no navegador. Clique no ícone de cadeado ao lado da URL para liberar o acesso.");
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        setErrorMessage("Nenhuma câmera foi encontrada conectada ao seu dispositivo.");
      } else {
        setErrorMessage("Não foi possível inicializar a câmera. Verifique se outro aplicativo está utilizando o sensor.");
      }
    }
  }, [facingMode, stream]);

  // Parar Stream
  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
    setPermissionState("idle");
  }, [stream]);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [stream]);

  // Captura do frame para Blob
  const takeSnapshot = useCallback(() => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          onCapture(blob);
        }
      },
      "image/jpeg",
      0.88
    );
  }, [onCapture]);

  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Estado Inicial: Pré-aviso Educativo de Câmera */}
      {permissionState === "idle" && (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line bg-card/60 p-8 text-center max-w-lg w-full gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-navy/10 text-primary">
            <Camera className="h-8 w-8" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-base sm:text-lg font-bold text-ink">
              Permitir Acesso à Câmera
            </h2>
            <p className="text-xs sm:text-sm text-muted max-w-sm">
              Sua câmera será utilizada apenas para capturar um frame para análise facial.
              A imagem é descartada da memória imediatamente após o processamento.
            </p>
          </div>
          <button
            onClick={startCamera}
            disabled={disabled}
            className="inline-flex items-center gap-2 rounded-xl bg-navy px-6 py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-navy-dark active:scale-95 cursor-pointer min-h-[44px]"
          >
            <span>Ativar Câmera</span>
          </button>
        </div>
      )}

      {/* Estado Solicitando Permissão */}
      {permissionState === "requesting" && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-line bg-card p-8 text-center max-w-lg w-full gap-3" role="status">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-navy border-t-transparent" />
          <p className="text-sm font-semibold text-ink">
            Aguardando permissão da câmera no navegador...
          </p>
          <p className="text-xs text-muted">
            Por favor, selecione "Permitir" na caixa de diálogo do seu navegador.
          </p>
        </div>
      )}

      {/* Estado Erro ou Permissão Negada */}
      {(permissionState === "denied" || permissionState === "unsupported") && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-warn/30 bg-warn/10 p-6 text-center max-w-lg w-full gap-3" role="alert">
          <AlertTriangle className="h-8 w-8 text-amber-500" />
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-warn">
              Acesso à Câmera Indisponível
            </h2>
            <p className="text-xs text-ink/80">{errorMessage}</p>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={startCamera}
              className="rounded-xl bg-navy px-4 py-2 text-xs font-bold text-white shadow-2xs hover:bg-navy-dark cursor-pointer min-h-[44px]"
            >
              Tentar Novamente
            </button>
            <button
              onClick={() => setPermissionState("idle")}
              className="rounded-xl border border-line bg-white px-4 py-2 text-xs font-semibold text-ink hover:bg-navy/5 cursor-pointer min-h-[44px]"
            >
              Voltar
            </button>
          </div>
        </div>
      )}

      {/* Estado Câmera Conectada */}
      {permissionState === "granted" && (
        <div className="relative flex flex-col items-center w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-black shadow-md">
          {/* Feed de Vídeo */}
          <div className="relative aspect-4/3 w-full bg-black">
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="h-full w-full object-cover"
            />

            {/* Retículo Oval de Enquadramento */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-60 w-48 rounded-[50%] border-2 border-dashed border-white/60 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
              {/* Linha laser de varredura */}
              <div className="absolute h-0.5 w-44 bg-green shadow-[0_0_8px_#22C55E] animate-scan-laser" />
            </div>

            {/* Banner de instrução sobre o vídeo */}
            <div className="absolute top-3 left-0 right-0 flex justify-center pointer-events-none">
              <span className="rounded-full bg-black/65 backdrop-blur-xs px-3.5 py-1 text-xs font-semibold text-white">
                Posicione o rosto dentro do oval
              </span>
            </div>
          </div>

          {/* Controles da Câmera */}
          <div className="flex flex-wrap items-center justify-between gap-3 w-full bg-card p-4 border-t border-line">
            <button
              onClick={stopCamera}
              className="rounded-xl border border-line bg-white px-3.5 py-2 text-xs font-semibold text-ink hover:bg-navy/5 cursor-pointer min-h-[44px]"
            >
              Desativar
            </button>

            <button
              onClick={takeSnapshot}
              disabled={disabled}
              className="inline-flex items-center gap-2 rounded-xl bg-green px-6 py-2.5 text-sm font-extrabold text-white shadow-sm transition-all hover:bg-green/90 active:scale-95 disabled:opacity-50 cursor-pointer min-h-[44px]"
            >
              <Aperture className="h-4 w-4" />
              <span>Capturar e Analisar</span>
            </button>

            <button
              onClick={toggleFacingMode}
              className="rounded-xl border border-line bg-white p-2.5 text-xs font-semibold text-ink hover:bg-navy/5 cursor-pointer min-h-[44px] flex items-center justify-center"
              title="Alternar Câmera (Frontal / Traseira)"
              aria-label="Alternar Câmera"
            >
              <SwitchCamera className="h-4 w-4 text-slate-700" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
