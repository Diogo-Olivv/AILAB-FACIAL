import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { captureBlob } from "../lib/camera";
import { recognizeFrame, type RecognizeResult } from "../lib/api";
import { supabase } from "../lib/supabase";

type Feedback = { kind: "ok" | "warn" | "err"; text: string };

const FEEDBACK_MS = 4000;

async function fetchName(profileId: string): Promise<string> {
  const { data } = await supabase.from("profiles").select("name").eq("id", profileId).single();
  return data?.name ?? "Integrante";
}

function describe(result: RecognizeResult, name: string): Feedback {
  const action = result.event?.action;
  if (action === "check_in") return { kind: "ok", text: `Entrada registrada. Bem-vindo(a), ${name}.` };
  if (action === "check_out") {
    const min = result.event?.duration_minutes;
    const extra = min != null ? ` Permanencia de ${min} min.` : "";
    return { kind: "ok", text: `Saida registrada. Ate logo, ${name}.${extra}` };
  }
  return { kind: "warn", text: `${name}, aguarde alguns segundos antes de registrar de novo.` };
}

export function Kiosk() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [camError, setCamError] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user" } })
      .then((s) => {
        stream = s;
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch(() => setCamError("Nao foi possivel acessar a camera."));
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, []);

  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), FEEDBACK_MS);
    return () => clearTimeout(t);
  }, [feedback]);

  const register = useCallback(async () => {
    if (!videoRef.current || busy) return;
    setBusy(true);
    setFeedback(null);
    try {
      const frame = await captureBlob(videoRef.current);
      if (!frame) throw new Error("Falha ao capturar a imagem.");
      const result = await recognizeFrame(frame);
      if (!result.recognized || !result.profile_id) {
        setFeedback({ kind: "err", text: "Rosto nao reconhecido. Tente novamente." });
        return;
      }
      const name = await fetchName(result.profile_id);
      setFeedback(describe(result, name));
    } catch (err) {
      setFeedback({ kind: "err", text: err instanceof Error ? err.message : "Falha no reconhecimento." });
    } finally {
      setBusy(false);
    }
  }, [busy]);

  const feedbackColor =
    feedback?.kind === "ok"
      ? "text-green-400"
      : feedback?.kind === "warn"
        ? "text-amber-400"
        : "text-red-400";

  return (
    <div className="grid min-h-screen place-items-center bg-base px-4 py-8">
      <div className="w-full max-w-md space-y-6 text-center">
        <h1 className="text-2xl font-semibold text-white">Registro de presenca</h1>

        <div className="overflow-hidden rounded-2xl bg-black">
          <video ref={videoRef} autoPlay playsInline muted className="h-72 w-full object-cover" />
        </div>
        {camError && <p className="text-sm text-red-400">{camError}</p>}

        <button
          type="button"
          onClick={register}
          disabled={busy || !!camError}
          className="w-full rounded-xl bg-accent py-5 text-lg font-semibold text-white disabled:opacity-40"
        >
          {busy ? "Reconhecendo..." : "Registrar presenca"}
        </button>

        <p className={`min-h-6 text-base font-medium ${feedback ? feedbackColor : "text-transparent"}`}>
          {feedback?.text ?? "."}
        </p>

        <Link to="/dashboard" className="text-sm text-accent hover:underline">
          Voltar ao painel
        </Link>
      </div>
    </div>
  );
}
