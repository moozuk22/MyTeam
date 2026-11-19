import { readTrainingImageSource } from "./imageSource";
import {
  ALLOWED_EQUIPMENT_TYPES,
  MAX_ITEMS,
  type EquipmentType,
  type PlanLayout,
  validateLayout,
} from "@/lib/trainingPlans";

export const WIDTH = 1050;
export const HEIGHT = 700;
export type Point = { x: number; y: number };
export const PITCH_ROTATIONS = [0, 90, 180, 270] as const;
export type PitchRotation = (typeof PITCH_ROTATIONS)[number];
export const PITCH_QUADRANTS = ["top-left", "top-right", "bottom-left", "bottom-right"] as const;
export type PitchQuadrant = (typeof PITCH_QUADRANTS)[number];
export const PITCH_QUADRANT_BOUNDS = {
  "top-left": { x: 0, y: 0 },
  "top-right": { x: WIDTH / 2, y: 0 },
  "bottom-left": { x: 0, y: HEIGHT / 2 },
  "bottom-right": { x: WIDTH / 2, y: HEIGHT / 2 },
} satisfies Record<PitchQuadrant, Point>;

export function isInPitchQuadrants(point: Point, quadrants: readonly PitchQuadrant[]) {
  return quadrants.some((quadrant) => {
    const { x, y } = PITCH_QUADRANT_BOUNDS[quadrant];
    return point.x >= x && point.x <= x + WIDTH / 2 &&
      point.y >= y && point.y <= y + HEIGHT / 2;
  });
}
export const ACTIONS = [
  "run",
  "dribble",
  "pass",
  "long-pass",
  "shot",
  "line",
  "dashed-line",
] as const;
export type Action = (typeof ACTIONS)[number];
export type ExerciseTool =
  | EquipmentType
  | "wall"
  | "custom-team-coach"
  | "custom-team-goalkeeper"
  | "custom-team-player";
export const TEAM_COLORS = { 1: "#3b82f6", 2: "#ef4444" };
export const CUSTOM_TEAM_COLOR_ERROR =
  "Изберете цвят, различен от цветовете на отбори 1 и 2.";

export function isCustomTeamColor(color: unknown): color is string {
  return (
    typeof color === "string" &&
    /^#[0-9a-f]{6}$/i.test(color) &&
    !Object.values(TEAM_COLORS).includes(color.toLowerCase())
  );
}
export const SHAPES = ["circle", "rectangle", "triangle"] as const;
export type ExerciseObject = {
  id: string;
  kind: "equipment" | "player" | "movement" | "zone" | "text";
  x: number;
  y: number;
  rotation: number;
  width: number;
  height: number;
  color: string;
  equipment?: ExerciseTool;
  team?: number;
  role?: "player" | "coach" | "goalkeeper";
  label?: string;
  fontSize?: number;
  action?: Action;
  arrowhead?: boolean;
  path?: "straight" | "curve" | "freehand";
  points?: Point[];
  shape?: (typeof SHAPES)[number];
  hatched?: boolean;
};
export const MAX_TEXT_FONT_SIZE = Math.ceil(HEIGHT * 3 * 0.7);

export function textFontSize(object: ExerciseObject): number {
  return object.fontSize ?? object.height * 0.7;
}

export const MAX_BACKGROUND_IMAGE_LENGTH = 256 * 1024;

export type ExerciseBackground = {
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: PitchRotation;
};

export type Exercise = {
  version: 2;
  sport: "football";
  surface: "full" | "half" | "blank";
  pitchRotation?: PitchRotation;
  background?: ExerciseBackground;
  quadrants?: PitchQuadrant[];
  customTeamColors?: (string | null)[];
  thirdTeamColor?: string;
  objects: ExerciseObject[];
};

export function getPitchQuadrants(layout: Exercise): readonly PitchQuadrant[] {
  return layout.surface === "full" ? layout.quadrants ?? PITCH_QUADRANTS : PITCH_QUADRANTS;
}

const EMPTY_TEAM_COLORS: readonly (string | null)[] = [];

export function getCustomTeamColors(layout: Exercise): readonly (string | null)[] {
  return layout.customTeamColors ??
    (layout.thirdTeamColor ? [layout.thirdTeamColor] : EMPTY_TEAM_COLORS);
}

export function addCustomTeam(layout: Exercise, color: string): Exercise {
  const { thirdTeamColor, ...current } = layout;
  const colors = current.customTeamColors ?? (thirdTeamColor ? [thirdTeamColor] : []);
  return { ...current, customTeamColors: [...colors, color] };
}

export function removeCustomTeam(layout: Exercise, team: number): Exercise {
  const colors = getCustomTeamColors(layout);
  const index = team - 3;
  if (!colors[index]) return layout;

  const next = {
    ...layout,
    // Keep other team numbers stable by reserving the deleted team's slot.
    customTeamColors: colors.map((color, i) => i === index ? null : color),
    objects: layout.objects.filter((object) => object.team !== team),
  };
  delete next.thirdTeamColor;
  return next;
}
export const EMPTY_EXERCISE: Exercise = {
  version: 2,
  sport: "football",
  surface: "full",
  objects: [],
};
export const isV2 = (raw: unknown): raw is Exercise =>
  !!raw &&
  typeof raw === "object" &&
  (raw as { version?: unknown }).version === 2;
const finite = (n: unknown, min: number, max: number): n is number =>
  typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
export const isMovementType = (type: string) =>
  [...ACTIONS, "run-free", "dribble-free"].includes(type as Action);
export const isLineType = (type: unknown) =>
  type === "line" || type === "dashed-line";
export const isZoneType = (type: string) =>
  SHAPES.some((s) => type === s || type === `hatched-${s}`);
export const isEquipmentType = (type: string) =>
  type === "wall" ||
  (ALLOWED_EQUIPMENT_TYPES.includes(type as EquipmentType) &&
    !isMovementType(type) &&
    !isZoneType(type) &&
    !type.startsWith("team") &&
    type !== "text");

function validBackground(value: unknown): value is ExerciseBackground {
  if (
    !record(value) ||
    Object.keys(value).length !== 6 ||
    typeof value.src !== "string" ||
    value.src.length > MAX_BACKGROUND_IMAGE_LENGTH ||
    (!readTrainingImageSource(value.src) && (
      !/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(value.src) ||
      (value.src.length - "data:image/jpeg;base64,".length) % 4 !== 0
    )) ||
    !PITCH_ROTATIONS.includes(value.rotation as PitchRotation)
  ) return false;
  const { x, y, width, height, rotation } = value;
  if (
    typeof x !== "number" || !Number.isFinite(x) ||
    typeof y !== "number" || !Number.isFinite(y) ||
    typeof width !== "number" || !Number.isFinite(width) || width <= 0 ||
    typeof height !== "number" || !Number.isFinite(height) || height <= 0
  ) return false;
  const sideways = rotation === 90 || rotation === 270;
  const halfWidth = (sideways ? height : width) / 2;
  const halfHeight = (sideways ? width : height) / 2;
  return x - halfWidth >= 0 && x + halfWidth <= WIDTH &&
    y - halfHeight >= 0 && y + halfHeight <= HEIGHT;
}

export function validateExercise(raw: unknown): string | null {
  if (
    !record(raw) ||
    raw.version !== 2 ||
    raw.sport !== "football" ||
    !["full", "half", "blank"].includes(String(raw.surface))
  )
    return "Неподдържан формат на упражнението.";
  if (!Array.isArray(raw.objects) || raw.objects.length > MAX_ITEMS)
    return "Позволени са до 200 обекта.";
  if (
    Object.keys(raw).some(
      (key) =>
        !["version", "sport", "surface", "pitchRotation", "background", "quadrants", "objects", "customTeamColors", "thirdTeamColor"].includes(key),
    )
  )
    return "Непознато поле във формата на упражнението.";
  if (raw.pitchRotation !== undefined && !PITCH_ROTATIONS.includes(raw.pitchRotation as PitchRotation))
    return "Изберете валидно завъртане на игрището.";
  if (raw.background !== undefined && !validBackground(raw.background))
    return "Невалидно изображение за упражнението.";
  if (raw.quadrants !== undefined &&
    (raw.surface === "half" ||
      !Array.isArray(raw.quadrants) ||
      raw.quadrants.length === 0 ||
      raw.quadrants.length > PITCH_QUADRANTS.length ||
      !raw.quadrants.every((quadrant) => PITCH_QUADRANTS.includes(quadrant)) ||
      new Set(raw.quadrants).size !== raw.quadrants.length)
  ) return "Изберете валидни части от игрището.";
  let customTeamColors = EMPTY_TEAM_COLORS;
  if (raw.customTeamColors !== undefined) {
    if (
      raw.thirdTeamColor !== undefined ||
      !Array.isArray(raw.customTeamColors) ||
      !raw.customTeamColors.every((color) => color === null || isCustomTeamColor(color))
    ) return CUSTOM_TEAM_COLOR_ERROR;
    customTeamColors = raw.customTeamColors;
  } else if (raw.thirdTeamColor !== undefined) {
    if (!isCustomTeamColor(raw.thirdTeamColor)) return CUSTOM_TEAM_COLOR_ERROR;
    customTeamColors = [raw.thirdTeamColor];
  }
  const kindFields: Record<string, string[]> = {
    equipment: ["equipment"],
    player: ["team", "role"],
    text: ["fontSize"],
    zone: ["shape", "hatched"],
    movement: ["action", "path", "points", "arrowhead"],
  };
  const commonFields = [
    "id",
    "kind",
    "x",
    "y",
    "rotation",
    "width",
    "height",
    "color",
    "label",
  ];
  const ids = new Set<string>();
  for (const o of raw.objects) {
    if (
      !record(o) ||
      typeof o.id !== "string" ||
      !o.id ||
      o.id.length > 100 ||
      ids.has(o.id)
    )
      return "Невалиден или повторен идентификатор.";
    ids.add(o.id);
    const allowedFields = [
      ...commonFields,
      ...(kindFields[String(o.kind)] ?? []),
    ];
    if (
      Object.keys(o).some(
        (key) => o[key] !== undefined && !allowedFields.includes(key),
      )
    )
      return "Непознато поле в обекта.";
    if (
      !finite(o.x, 0, WIDTH) ||
      !finite(o.y, 0, HEIGHT) ||
      !finite(o.width, 2, WIDTH * 3) ||
      !finite(o.height, 2, HEIGHT * 3) ||
      !finite(o.rotation, -360, 360)
    )
      return "Невалидни размери или координати.";
    if (typeof o.color !== "string" || !/^#[0-9a-f]{6}$/i.test(o.color))
      return "Невалиден цвят.";
    if (
      o.label !== undefined &&
      (typeof o.label !== "string" || o.label.length > 40)
    )
      return "Текстът трябва да е до 40 символа.";
    switch (o.kind) {
      case "equipment":
        if (typeof o.equipment !== "string" || !isEquipmentType(o.equipment))
          return "Непознато пособие.";
        break;
      case "player":
        if (
          !finite(o.team, 1, customTeamColors.length + 2) ||
          !Number.isInteger(o.team) ||
          (o.team > 2 && !customTeamColors[o.team - 3]) ||
          !["player", "coach", "goalkeeper"].includes(String(o.role))
        )
          return "Невалиден състезател.";
        break;
      case "text":
        if (typeof o.label !== "string" || !o.label.trim())
          return "Въведете текст.";
        if (o.fontSize !== undefined && !finite(o.fontSize, 1, MAX_TEXT_FONT_SIZE))
          return "Невалиден размер на шрифта.";
        break;
      case "zone":
        if (
          !SHAPES.includes(o.shape as (typeof SHAPES)[number]) ||
          typeof o.hatched !== "boolean"
        )
          return "Невалидна зона.";
        break;
      case "movement": {
        if (
          !ACTIONS.includes(o.action as Action) ||
          !["straight", "curve", "freehand"].includes(String(o.path)) ||
          !Array.isArray(o.points)
        )
          return "Невалидно движение.";
        if (o.arrowhead !== undefined &&
          (typeof o.arrowhead !== "boolean" || !isLineType(o.action)))
          return "Невалиден връх на стрелка.";
        const n = o.points.length;
        if (
          (o.path === "straight" && n !== 2) ||
          (o.path === "curve" && n !== 3) ||
          n < 2 ||
          n > 300
        )
          return "Невалиден брой точки.";
        if (
          o.points.some(
            (p) =>
              !record(p) ||
              Object.keys(p).some((key) => key !== "x" && key !== "y") ||
              !finite(p.x, -WIDTH * 3, WIDTH * 3) ||
              !finite(p.y, -HEIGHT * 3, HEIGHT * 3),
          )
        )
          return "Невалидна точка.";
        const first = o.points[0] as Point;
        if (
          !o.points.some((p) => Math.hypot(p.x - first.x, p.y - first.y) >= 2)
        )
          return "Движението е твърде кратко.";
        break;
      }
      default:
        return "Непознат обект.";
    }
  }
  return null;
}
export function validateSavedLayout(raw: unknown) {
  return isV2(raw) ? validateExercise(raw) : validateLayout(raw);
}
export function layoutVersion(raw: unknown) {
  return isV2(raw) ? 2 : 1;
}

export function createObject(
  type: ExerciseTool,
  point: Point,
  id: string,
  customTeam?: { number: number; color: string },
): ExerciseObject {
  const base: ExerciseObject = {
    id,
    kind: "equipment",
    ...point,
    width: 32,
    height: 32,
    rotation: 0,
    color: "#f59e0b",
    equipment: type,
  };
  if (type.startsWith("team") || type.startsWith("custom-team-")) {
    const team = type.startsWith("team2") ? 2 : 1;
    return {
      ...base,
      equipment: undefined,
      kind: "player",
      team: customTeam?.number ?? team,
      role: type.endsWith("coach")
        ? "coach"
        : type.endsWith("goalkeeper")
          ? "goalkeeper"
          : "player",
      label: type.endsWith("coach")
        ? "Т"
        : type.endsWith("goalkeeper")
          ? "В"
          : type.endsWith("-2")
            ? "2"
            : "1",
      color: type.endsWith("coach") ? "#000000" : customTeam?.color ?? TEAM_COLORS[team],
    };
  }
  if (type === "text")
    return {
      ...base,
      equipment: undefined,
      kind: "text",
      label: "Текст",
      width: 100,
      color: "#ffffff",
    };
  if (isZoneType(type))
    return {
      ...base,
      equipment: undefined,
      kind: "zone",
      shape: type.replace("hatched-", "") as ExerciseObject["shape"],
      hatched: type.startsWith("hatched"),
      width: 100,
      height: 70,
      color: "#ffffff",
    };
  if (isMovementType(type))
    return {
      ...base,
      equipment: undefined,
      kind: "movement",
      action: type.replace("-free", "") as Action,
      path: type.endsWith("-free")
        ? "freehand"
        : type === "long-pass"
          ? "curve"
          : "straight",
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      color: "#ffffff",
    };
  if (type.startsWith("goal"))
    return {
      ...base,
      width:
        type === "goal-1m"
          ? 32
          : type === "goal-3m" || type === "goal-small"
            ? 48
            : type === "goal-5m"
              ? 64
              : 85,
      height: 30,
      color: "#ffffff",
    };
  if (type === "ladder") return { ...base, width: 32, height: 88 };
  if (type === "pole") return { ...base, width: 15, height: 55 };
  if (type === "flag") return { ...base, width: 35, height: 55 };
  if (type === "hurdle") return { ...base, width: 50, height: 28 };
  if (type === "mannequin") return { ...base, width: 30, height: 58 };
  if (type === "wall") return { ...base, width: 98, height: 58 };
  if (type.startsWith("marker"))
    return {
      ...base,
      height: 16,
      color:
        type === "marker-blue"
          ? "#3b82f6"
          : type === "marker-yellow"
            ? "#facc15"
            : type === "marker-orange"
              ? "#f59e0b"
              : "#ef4444",
    };
  if (type === "ball" || type === "balls")
    return { ...base, width: 22, height: 22, color: "#ffffff" };
  return base;
}

export function nextPlayerLabel(
  objects: readonly ExerciseObject[],
  team: ExerciseObject["team"],
): string {
  const teammates = objects.filter(
    (object) =>
      object.kind === "player" &&
      object.role === "player" &&
      object.team === team,
  );
  const usedLabels = new Set(teammates.map((object) => object.label?.trim()));
  let number = 1;
  while (usedLabels.has(String(number))) number++;
  return String(number);
}

const LEGACY_DIMENSIONS: Partial<Record<EquipmentType, [number, number]>> = {
  cone: [28, 28],
  ball: [28, 28],
  balls: [36, 28],
  "goal-small": [32, 20],
  "goal-full": [46, 26],
  "goal-7m": [54, 28],
  "goal-5m": [44, 24],
  "goal-3m": [34, 22],
  "goal-1m": [22, 18],
  pole: [10, 34],
  ladder: [24, 38],
  flag: [10, 36],
  hurdle: [34, 24],
  ring: [32, 32],
  circle: [48, 48],
  "hatched-circle": [48, 48],
  rectangle: [56, 40],
  "hatched-rectangle": [56, 40],
  triangle: [56, 40],
  "hatched-triangle": [56, 40],
};
export function convertLegacy(layout: PlanLayout): Exercise {
  const error = validateLayout(layout);
  if (error) throw new Error(error);
  const result: Exercise = {
    ...EMPTY_EXERCISE,
    objects: layout.items.map((i) => {
      const o = createObject(i.type, { x: i.x * WIDTH, y: i.y * HEIGHT }, i.id);
      const dimensions =
        LEGACY_DIMENSIONS[i.type] ??
        (o.kind === "player" ? [34, 34] : [o.width, o.height]);
      o.rotation = i.rotation;
      o.width = dimensions[0] * i.scale;
      o.height = dimensions[1] * i.scale;
      if (i.fill) {
        const c = i.fill;
        o.color = /^#[a-f0-9]{6}$/i.test(c)
          ? c
          : /^#[a-f0-9]{3}$/i.test(c)
            ? `#${c
                .slice(1)
                .split("")
                .map((x) => x + x)
                .join("")}`
            : o.color;
        if (!/^#[a-f0-9]{3}([a-f0-9]{3})?$/i.test(c))
          throw new Error("Цветът на обект не може да се преобразува.");
      } else if (o.kind === "player") {
        // Legacy plans without an explicit fill use the original team colors.
        o.color = o.team === 2 ? "#3b82f6" : "#ef4444";
      }
      if (i.text !== undefined) o.label = i.text;
      if (o.kind === "movement") {
        if (i.type === "line" || i.type === "dashed-line") {
          o.path = "straight";
          o.points = [
            { x: -34 * i.scale, y: 0 },
            { x: 34 * i.scale, y: 0 },
          ];
        } else if (i.points && i.points.length >= 2) {
          o.path = "freehand";
          o.points = i.points.map((p) => ({
            x: (p.x - i.x) * WIDTH,
            y: (p.y - i.y) * HEIGHT,
          }));
        } else if (i.endX !== undefined && i.endY !== undefined) {
          const end = { x: (i.endX - i.x) * WIDTH, y: (i.endY - i.y) * HEIGHT };
          o.points =
            o.path === "curve"
              ? [
                  { x: 0, y: 0 },
                  { x: end.x / 2 + end.y * 0.15, y: end.y / 2 - end.x * 0.15 },
                  end,
                ]
              : [{ x: 0, y: 0 }, end];
        } else
          throw new Error(
            "Движение без крайна точка не може да се преобразува.",
          );
        // The legacy SVG paths ignored rotation/scale; preserve their visible geometry.
        if (i.type !== "line" && i.type !== "dashed-line") o.rotation = 0;
      }
      return o;
    }),
  };
  const convertedError = validateExercise(result);
  if (convertedError) throw new Error(convertedError);
  return result;
}

export function sameExercise(a: Exercise, b: Exercise): boolean {
  if (a === b) return true;
  const backgroundA = a.background;
  const backgroundB = b.background;
  const teamsA = getCustomTeamColors(a);
  const teamsB = getCustomTeamColors(b);
  const quadrantsA = a.quadrants ?? PITCH_QUADRANTS;
  const quadrantsB = b.quadrants ?? PITCH_QUADRANTS;
  return (
    a.version === b.version &&
    a.sport === b.sport &&
    a.surface === b.surface &&
    (a.pitchRotation ?? 0) === (b.pitchRotation ?? 0) &&
    (backgroundA === backgroundB || (
      backgroundA !== undefined && backgroundB !== undefined &&
      backgroundA.src === backgroundB.src && backgroundA.x === backgroundB.x &&
      backgroundA.y === backgroundB.y && backgroundA.width === backgroundB.width &&
      backgroundA.height === backgroundB.height && backgroundA.rotation === backgroundB.rotation
    )) &&
    (quadrantsA === quadrantsB ||
      (quadrantsA.length === quadrantsB.length && quadrantsA.every((part) => quadrantsB.includes(part)))) &&
    (teamsA === teamsB ||
      (teamsA.length === teamsB.length && teamsA.every((color, i) => color === teamsB[i]))) &&
    a.objects.length === b.objects.length &&
    a.objects.every(
      (o, i) =>
        o === b.objects[i] ||
        JSON.stringify(o) === JSON.stringify(b.objects[i]),
    )
  );
}
