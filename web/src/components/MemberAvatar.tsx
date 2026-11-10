import { useEffect, useState } from "react";

const AVATAR_GRADIENTS = [
  "from-blue-600 to-indigo-700 text-white",
  "from-violet-600 to-purple-700 text-white",
  "from-emerald-600 to-teal-700 text-white",
  "from-orange-500 to-amber-600 text-white",
  "from-rose-600 to-pink-700 text-white",
  "from-cyan-600 to-blue-700 text-white",
  "from-indigo-600 to-violet-700 text-white",
  "from-teal-600 to-emerald-700 text-white",
];

export function getAvatarStyle(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

const SIZE_CLASSES: Record<AvatarSize, string> = {
  xs: "w-8 h-8 min-w-[2rem] min-h-[2rem] text-2xs",
  sm: "w-9 h-9 min-w-[2.25rem] min-h-[2.25rem] text-xs",
  md: "w-10 h-10 min-w-[2.5rem] min-h-[2.5rem] text-xs",
  lg: "w-11 h-11 min-w-[2.75rem] min-h-[2.75rem] text-sm",
  xl: "w-14 h-14 min-w-[3.5rem] min-h-[3.5rem] text-lg",
};

interface MemberAvatarProps {
  name: string;
  src?: string | null;
  size?: AvatarSize;
  /** Destaca o avatar com anel laranja/âmbar institucional (tutores). */
  highlight?: boolean;
  /** Exibe ponto verde acoplado no canto inferior direito quando presente. */
  present?: boolean;
  rounded?: "full" | "xl";
  className?: string;
}

export function MemberAvatar({
  name,
  src,
  size = "md",
  highlight = false,
  present = false,
  rounded = "full",
  className = "",
}: MemberAvatarProps) {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [src]);

  const shape = rounded === "full" ? "rounded-full" : "rounded-xl";
  const ring = highlight
    ? "ring-2 ring-orange-500/80 dark:ring-amber-400/80 shadow-sm"
    : "ring-2 ring-white dark:ring-[#0F1623] shadow-sm";
  const base = `${SIZE_CLASSES[size]} ${shape} ${ring} aspect-square shrink-0 object-cover select-none`;
  const showImage = Boolean(src) && !imgError;

  return (
    <span className={`relative inline-flex shrink-0 ${className}`}>
      {showImage ? (
        <img
          src={src ?? undefined}
          alt={name}
          loading="lazy"
          decoding="async"
          onError={() => setImgError(true)}
          className={`${base} bg-slate-100 dark:bg-[#161F30]`}
        />
      ) : (
        <span
          aria-label={name}
          role="img"
          className={`${base} inline-flex items-center justify-center bg-gradient-to-br ${getAvatarStyle(name)} font-bold tracking-tight`}
        >
          {initialsOf(name)}
        </span>
      )}
      {present && (
        <span
          title="Presente no laboratório agora"
          className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-white dark:ring-[#0F1623] bg-emerald-500"
        />
      )}
    </span>
  );
}
