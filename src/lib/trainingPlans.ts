export const ALLOWED_EQUIPMENT_TYPES = [
  "cone",
  "ball",
  "balls",
  "goal-small",
  "goal-full",
  "goal-7m",
  "goal-5m",
  "goal-3m",
  "goal-1m",
  "mannequin",
  "marker",
  "marker-orange",
  "marker-blue",
  "marker-yellow",
  "pole",
  "ladder",
  "flag",
  "hurdle",
  "ring",
  "run",
  "run-free",
  "dribble",
  "dribble-free",
  "pass",
  "long-pass",
  "shot",
  "line",
  "dashed-line",
  "circle",
  "hatched-circle",
  "rectangle",
  "hatched-rectangle",
  "triangle",
  "hatched-triangle",
  "text",
  "team1-coach",
  "team1-goalkeeper",
  "team1-player-1",
  "team1-player-2",
  "team1-player-more",
  "team2-coach",
  "team2-goalkeeper",
  "team2-player-1",
  "team2-player-2",
  "team2-player-more",
] as const;

export type EquipmentType = (typeof ALLOWED_EQUIPMENT_TYPES)[number];

export interface PlanItem {
  id: string;
  type: EquipmentType;
  x: number;
  y: number;
  endX?: number;
  endY?: number;
  points?: Array<{ x: number; y: number }>;
  rotation: number;
  scale: number;
  fill?: string;
  text?: string;
}

export interface PlanLayout {
  version: 1;
  pitch: { type: "football-full"; aspectRatio: 1.5 };
  items: PlanItem[];
}

export const MAX_ITEMS = 200;

export const DEFAULT_LAYOUT: PlanLayout = {
  version: 1,
  pitch: { type: "football-full", aspectRatio: 1.5 },
  items: [],
};

export function validateLayout(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return "Invalid layout";
  const l = raw as Record<string, unknown>;
  if (l.version !== 1) return "Unsupported layout version";
  const pitch = l.pitch as Record<string, unknown> | undefined;
  if (!pitch || pitch.type !== "football-full") return "Invalid pitch type";
  if (pitch.aspectRatio !== 1.5) return "Invalid pitch aspect ratio";
  if (!Array.isArray(l.items)) return "Items must be an array";
  if (l.items.length > MAX_ITEMS) return `Too many items (max ${MAX_ITEMS})`;

  for (const item of l.items as unknown[]) {
    if (!item || typeof item !== "object") return "Invalid item";
    const i = item as Record<string, unknown>;
    if (typeof i.id !== "string" || !i.id) return "Item missing id";
    if (!ALLOWED_EQUIPMENT_TYPES.includes(i.type as EquipmentType)) return `Unknown type: ${i.type}`;
    if (typeof i.x !== "number" || i.x < 0 || i.x > 1) return "Item x out of range";
    if (typeof i.y !== "number" || i.y < 0 || i.y > 1) return "Item y out of range";
    if (Object.hasOwn(i, "endX") && (typeof i.endX !== "number" || i.endX < 0 || i.endX > 1)) {
      return "Item endX out of range";
    }
    if (Object.hasOwn(i, "endY") && (typeof i.endY !== "number" || i.endY < 0 || i.endY > 1)) {
      return "Item endY out of range";
    }
    if (Object.hasOwn(i, "points")) {
      if (!Array.isArray(i.points)) return "Item points must be an array";
      if (i.points.length > 300) return "Item has too many points";
      for (const point of i.points as unknown[]) {
        if (!point || typeof point !== "object") return "Invalid point";
        const p = point as Record<string, unknown>;
        if (typeof p.x !== "number" || p.x < 0 || p.x > 1) return "Point x out of range";
        if (typeof p.y !== "number" || p.y < 0 || p.y > 1) return "Point y out of range";
      }
    }
    if (typeof i.rotation !== "number" || i.rotation < -360 || i.rotation > 360) {
      return "Item rotation out of range";
    }
    if (typeof i.scale !== "number" || i.scale < 0.5 || i.scale > 3) return "Item scale out of range";
    if (Object.hasOwn(i, "fill") && typeof i.fill !== "string") return "Item fill must be a string";
    if (Object.hasOwn(i, "text") && typeof i.text !== "string") return "Item text must be a string";
    if (typeof i.fill === "string" && i.fill.length > 40) return "Item fill is too long";
    if (typeof i.text === "string" && i.text.length > 40) return "Item text is too long";
  }

  return null;
}
