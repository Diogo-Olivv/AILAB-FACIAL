import { useCallback, useRef, useState } from "react";

interface ImageUploaderProps {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
}

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/jpg"];

export function ImageUploader({ onFileSelected, disabled }: ImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const validateAndHandleFile = useCallback(
    (file: File) => {
      setValidationError(null);

      if (!ALLOWED_TYPES.includes(file.type)) {
        setValidationError("Formato inválido. Por favor, envie uma foto em JPEG, PNG ou WebP.");
        return;
      }

      if (file.size > MAX_SIZE_BYTES) {
        setValidationError("Arquivo muito pesado. O tamanho máximo permitido é de 5MB.");
        return;
      }

      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    },
    []
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndHandleFile(e.dataTransfer.files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndHandleFile(e.target.files[0]);
    }
  };

  const clearSelection = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setValidationError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const confirmUpload = () => {
    if (selectedFile) {
      onFileSelected(selectedFile);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-lg">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleInputChange}
        className="sr-only"
        id="facial-image-input"
        aria-describedby="upload-instructions"
      />

      {!selectedFile ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !disabled && fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && !disabled) {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          tabIndex={disabled ? -1 : 0}
          role="button"
          aria-label="Área de envio de imagem facial. Pressione Enter para selecionar um arquivo."
          className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center w-full transition-all cursor-pointer select-none ${
            isDragging
              ? "border-green bg-green/10 scale-[1.01]"
              : "border-line bg-card/60 hover:bg-card hover:border-navy/40"
          } ${disabled ? "opacity-50 pointer-events-none" : ""}`}
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-navy/10 text-3xl mb-3">
            📁
          </div>
          <div className="space-y-1">
            <p className="text-sm sm:text-base font-bold text-ink">
              Arraste sua foto para cá ou clique para selecionar
            </p>
            <p id="upload-instructions" className="text-xs text-muted">
              Formatos aceitos: JPG, PNG ou WebP (até 5MB)
            </p>
          </div>
          <span className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-4 py-2 text-xs font-bold text-navy shadow-2xs">
            Escolher Arquivo
          </span>
        </div>
      ) : (
        <div className="flex flex-col items-center w-full rounded-2xl border border-line bg-card p-4 shadow-sm gap-4">
          <div className="relative aspect-4/3 w-full overflow-hidden rounded-xl bg-black/5 flex items-center justify-center">
            {previewUrl && (
              <img
                src={previewUrl}
                alt="Pré-visualização da imagem selecionada para análise facial"
                className="h-full w-full object-contain rounded-xl"
              />
            )}
            <div className="absolute bottom-2 left-2 rounded-lg bg-black/70 backdrop-blur-xs px-2.5 py-1 text-[11px] font-semibold text-white">
              {selectedFile.name} ({(selectedFile.size / 1024).toFixed(0)} KB)
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 w-full pt-1">
            <button
              onClick={clearSelection}
              className="rounded-xl border border-line bg-white px-3.5 py-2 text-xs font-semibold text-ink hover:bg-navy/5 cursor-pointer min-h-[44px]"
            >
              Trocar Imagem
            </button>

            <button
              onClick={confirmUpload}
              disabled={disabled}
              className="inline-flex items-center gap-2 rounded-xl bg-green px-6 py-2.5 text-sm font-extrabold text-white shadow-sm transition-all hover:bg-green/90 active:scale-95 disabled:opacity-50 cursor-pointer min-h-[44px]"
            >
              <span>🔬</span>
              <span>Analisar Foto</span>
            </button>
          </div>
        </div>
      )}

      {validationError && (
        <div className="flex items-center gap-2 rounded-xl border border-warn/30 bg-warn/10 p-3 text-xs text-warn w-full" role="alert">
          <span>⚠️</span>
          <span>{validationError}</span>
        </div>
      )}
    </div>
  );
}
