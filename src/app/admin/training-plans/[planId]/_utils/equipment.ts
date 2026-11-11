import { ALLOWED_EQUIPMENT_TYPES, EquipmentType } from "@/lib/trainingPlans";

export const EQUIPMENT_LABELS: Record<EquipmentType, string> = {
  cone: "Конус",
  ball: "Топка",
  balls: "Топки",
  "goal-small": "Малка врата",
  "goal-full": "Голяма врата",
  "goal-7m": "Врата 7м",
  "goal-5m": "Врата 5м",
  "goal-3m": "Врата 3м",
  "goal-1m": "Врата 1м",
  mannequin: "Манекен",
  marker: "Шапка червена",
  "marker-orange": "Шапка оранжева",
  "marker-blue": "Шапка синя",
  "marker-yellow": "Шапка жълта",
  pole: "Пилон",
  ladder: "Стълба",
  flag: "Колче",
  hurdle: "Препятствие",
  ring: "Обръч",
  run: "Бягане",
  "run-free": "Бягане свободно",
  dribble: "Дрибъл",
  "dribble-free": "Дрибъл свободно",
  pass: "Пас",
  "long-pass": "Дълъг пас",
  shot: "Удар",
  line: "Линия",
  "dashed-line": "Прекъсната линия",
  circle: "Кръг",
  "hatched-circle": "Кръгла зона",
  rectangle: "Правоъгълник",
  "hatched-rectangle": "Правоъгълна зона",
  triangle: "Триъгълник",
  "hatched-triangle": "Триъгълна зона",
  text: "Добави текст",
  "team1-coach": "Треньор",
  "team1-goalkeeper": "Вратар",
  "team1-player-1": "състезател 1",
  "team1-player-2": "състезател 2",
  "team1-player-more": "състезател 3-11",
  "team2-coach": "Треньор",
  "team2-goalkeeper": "Вратар",
  "team2-player-1": "състезател 1",
  "team2-player-2": "състезател 2",
  "team2-player-more": "състезател 3-11",
};

export const TACTICAL_TYPES = new Set<EquipmentType>([
  "run",
  "run-free",
  "dribble",
  "dribble-free",
  "pass",
  "long-pass",
  "shot",
]);

const SHAPE_TYPES = new Set<EquipmentType>([
  "line",
  "dashed-line",
  "circle",
  "hatched-circle",
  "rectangle",
  "hatched-rectangle",
  "triangle",
  "hatched-triangle",
]);

export const PLAYER_TYPES = new Set<EquipmentType>([
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
]);

export const FREEHAND_TYPES = new Set<EquipmentType>(["run-free", "dribble-free"]);

const BALL_GOAL_TYPES: EquipmentType[] = ["ball", "balls", "goal-7m", "goal-5m", "goal-3m", "goal-1m"];

const AID_TYPES: EquipmentType[] = [
  "cone",
  "ladder",
  "flag",
  "hurdle",
  "ring",
  "mannequin",
  "marker",
  "marker-orange",
  "marker-blue",
  "marker-yellow",
];

export const TOOLBAR_GROUPS: Array<{
  title: string;
  shortLabel?: string;
  icon: "movement" | "ball" | "aids" | "shapes" | "text" | "team1" | "team2";
  types: EquipmentType[];
}> = [
  {
    title: "Движения",
    icon: "movement",
    types: ALLOWED_EQUIPMENT_TYPES.filter((type) => TACTICAL_TYPES.has(type)),
  },
  {
    title: "Топки и врати",
    icon: "ball",
    types: BALL_GOAL_TYPES,
  },
  {
    title: "Пособия",
    icon: "aids",
    types: AID_TYPES,
  },
  {
    title: "Линии и полета",
    icon: "shapes",
    types: ALLOWED_EQUIPMENT_TYPES.filter((type) => SHAPE_TYPES.has(type)),
  },
  {
    title: "Текст",
    icon: "text",
    types: ["text"],
  },
  {
    title: "Отбор 1",
    shortLabel: "T1",
    icon: "team1",
    types: ["team1-coach", "team1-goalkeeper", "team1-player-1", "team1-player-2", "team1-player-more"],
  },
  {
    title: "Отбор 2",
    shortLabel: "T2",
    icon: "team2",
    types: ["team2-coach", "team2-goalkeeper", "team2-player-1", "team2-player-2", "team2-player-more"],
  },
];

function isTeam2Type(type: EquipmentType) {
  return type.startsWith("team2-");
}

function getPlayerText(type: EquipmentType) {
  if (type.endsWith("-coach")) return "Т";
  if (type.endsWith("-goalkeeper")) return "В";
  if (type.endsWith("-player-1")) return "1";
  if (type.endsWith("-player-2")) return "2";
  if (type.endsWith("-player-more")) return "...";
  return "";
}

export function getDefaultFill(type: EquipmentType) {
  if (type === "marker-orange") return "#e38501";
  if (type === "marker-blue") return "#5084b4";
  if (type === "marker-yellow") return "#f9cb15";
  if (type === "marker") return "#ce0000";
  if (isTeam2Type(type)) return "#00C";
  if (PLAYER_TYPES.has(type)) return "#C00";
  return undefined;
}

export function getDefaultText(type: EquipmentType) {
  if (type === "text") return "Текст";
  if (PLAYER_TYPES.has(type)) return getPlayerText(type);
  return undefined;
}
