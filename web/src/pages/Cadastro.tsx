import { useState } from "react";
import { WebcamCapture } from "../components/WebcamCapture";
import { enroll } from "../lib/api";
import { useAuth } from "../auth/useAuth";

export function Cadastro() {
  const { signOut } = useAuth();
  const [name, setName] = useState("");
  const [matricula, setMatricula] = useState("");
  const [consent, setConsent] = useState(false);
  const [photos, setPhotos] = useState<Blob[]>([]);
  const [status, setStatus] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const canSubmit = name.trim() && consent && photos.length > 0 && !busy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      const result = await enroll(name, matricula, consent, photos);
      setStatus({ kind: "ok", text: `${result.name} cadastrado (${result.photos_used} fotos).` });
      setName("");
      setMatricula("");
      setConsent(false);
      setPhotos([]);
    } catch (err) {
      setStatus({ kind: "err", text: err instanceof Error ? err.message : "Falha no cadastro." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-base px-4 py-8">
      <div className="mx-auto max-w-lg space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-white">Cadastro de integrante</h1>
          <button onClick={signOut} className="text-sm text-white/60 hover:text-white">
            Sair
          </button>
        </header>

        <form onSubmit={submit} className="space-y-5 rounded-2xl bg-surface p-6">
          <input
            type="text"
            placeholder="Nome completo"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded-lg bg-black/30 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-accent"
          />
          <input
            type="text"
            placeholder="Matricula (opcional)"
            value={matricula}
            onChange={(e) => setMatricula(e.target.value)}
            className="w-full rounded-lg bg-black/30 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-accent"
          />

          <WebcamCapture photos={photos} onChange={setPhotos} />

          <label className="flex items-start gap-3 text-sm text-white/70">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1"
            />
            <span>
              Autorizo o uso da minha imagem facial para controle de presenca no
              laboratorio, conforme a LGPD.
            </span>
          </label>

          {status && (
            <p className={status.kind === "ok" ? "text-sm text-green-400" : "text-sm text-red-400"}>
              {status.text}
            </p>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-lg bg-accent py-3 font-medium text-white disabled:opacity-40"
          >
            {busy ? "Cadastrando..." : "Cadastrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
