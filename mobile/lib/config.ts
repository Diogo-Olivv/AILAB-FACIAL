export const ENROLL_PHOTO_COUNT = 5;
export const ENROLL_CAPTURE_INTERVAL_MS = 500;
export const MATRICULA_LENGTH = 9;

export const AVATAR_COLORS = [
  { bg: "#3B82F6", text: "#FFFFFF" }, // Blue
  { bg: "#8B5CF6", text: "#FFFFFF" }, // Violet
  { bg: "#10B981", text: "#FFFFFF" }, // Emerald
  { bg: "#F59E0B", text: "#FFFFFF" }, // Amber
  { bg: "#EC4899", text: "#FFFFFF" }, // Pink
  { bg: "#06B6D4", text: "#FFFFFF" }, // Cyan
  { bg: "#6366F1", text: "#FFFFFF" }, // Indigo
  { bg: "#14B8A6", text: "#FFFFFF" }, // Teal
];

export function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
