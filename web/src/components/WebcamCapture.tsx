import { useCallback, useEffect, useRef, useState } from "react";
import { ENROLL_PHOTO_COUNT } from "../lib/config";

interface Props {
  photos: Blob[];
  onChange: (photos: Blob[]) => void;
}

function captureBlob(video: HTMLVideoElement): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d")?.drawImage(video, 0, 0);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
}

export function WebcamCapture({ photos, onChange }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let stream: MediaStream | null = null;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user" } })
      .then((s) => {
        stream = s;
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch(() => setError("Nao foi possivel acessar a camera."));
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, []);

  const shoot = useCallback(async () => {
    if (!videoRef.current) return;
    const blob = await captureBlob(videoRef.current);
    if (blob) onChange([...photos, blob]);
  }, [photos, onChange]);

  const remaining = ENROLL_PHOTO_COUNT - photos.length;

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl bg-black">
        <video ref={videoRef} autoPlay playsInline muted className="h-64 w-full object-cover" />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={shoot}
          disabled={remaining <= 0}
          className="rounded-lg bg-accent px-4 py-2 font-medium text-white disabled:opacity-40"
        >
          Capturar foto
        </button>
        <span className="text-sm text-white/60">
          {photos.length}/{ENROLL_PHOTO_COUNT} fotos
        </span>
      </div>
      {photos.length > 0 && (
        <div className="flex gap-2">
          {photos.map((photo, i) => (
            <div key={i} className="relative">
              <img
                src={URL.createObjectURL(photo)}
                className="h-14 w-14 rounded-lg object-cover"
                alt=""
              />
              <button
                type="button"
                onClick={() => onChange(photos.filter((_, j) => j !== i))}
                className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-red-500 text-xs text-white"
              >
                x
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
