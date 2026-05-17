/**
 * Fixed palette for custom training group colors (club_custom_training_groups).
 * Each coach scope (club + coachGroupId) may use a color at most once.
 */
export const CUSTOM_TRAINING_GROUP_COLOR_PALETTE = [
  "#E53935",
  "#1E88E5",
  "#43A047",
  "#FB8C00",
  "#8E24AA",
  "#00838F",
  "#C0CA33",
  "#6D4C41",
  "#3949AB",
  "#D81B60",
  "#00796B",
  "#F9A825",
  "#5E35B1",
  "#546E7A",
  "#00ACC1",
  "#212121",
  "#FAFAFA",
] as const;

export type CustomTrainingGroupPaletteColor = (typeof CUSTOM_TRAINING_GROUP_COLOR_PALETTE)[number];

const PALETTE_SET = new Set<string>(CUSTOM_TRAINING_GROUP_COLOR_PALETTE);

export function isCustomTrainingGroupPaletteColor(value: string | null | undefined): value is CustomTrainingGroupPaletteColor {
  return typeof value === "string" && PALETTE_SET.has(value);
}

export function parseCustomTrainingGroupColorFromBody(raw: unknown): CustomTrainingGroupPaletteColor {
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  if (!isCustomTrainingGroupPaletteColor(trimmed)) {
    throw new Error("Невалиден или липсващ цвят. Изберете цвят от палитрата.");
  }
  return trimmed;
}

const HEX6 = /^#([0-9a-f]{6})$/i;

/** rgba() from a palette hex for backgrounds/borders (UI only). */
export function customTrainingGroupAccentRgba(hex: string, alpha: number): string {
  const m = HEX6.exec(hex.trim());
  if (!m) return `rgba(50, 205, 50, ${alpha})`;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Text on solid accent fill (badge). */
export function customTrainingGroupReadableOnAccent(hex: string): string {
  const m = HEX6.exec(hex.trim());
  if (!m) return "#0a160a";
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return y > 170 ? "#141414" : "#fafafa";
}
