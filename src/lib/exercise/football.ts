import {
  TEAM_COLORS,
  type ExerciseObject,
  type ExerciseTool,
} from "./model";

export const FOOTBALL_LABELS: Record<ExerciseTool, string> = {
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
  wall: "Стена",
  marker: "Шапка",
  "marker-orange": "Шапка",
  "marker-blue": "Шапка",
  "marker-yellow": "Шапка",
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
  "team1-player-1": "Състезател",
  "team1-player-2": "Състезател",
  "team1-player-more": "Състезател",
  "team2-coach": "Треньор",
  "team2-goalkeeper": "Вратар",
  "team2-player-1": "Състезател",
  "team2-player-2": "Състезател",
  "team2-player-more": "Състезател",
  "custom-team-coach": "Треньор",
  "custom-team-goalkeeper": "Вратар",
  "custom-team-player": "Състезател",
};
export const FOOTBALL_EQUIPMENT = {
  title: "Пособия",
  showCounts: true,
  types: [
    "cone", "ladder", "flag", "pole", "hurdle", "ring",
    "mannequin", "wall", "marker",
  ] satisfies ExerciseTool[],
};

export const FOOTBALL_TOOLS: {
  title: string;
  types: ExerciseTool[];
  color?: string;
  showCounts?: boolean;
}[] = [
  {
    title: "Движения",
    types: ["run", "dribble", "pass", "shot"],
  },
  {
    title: "Топки и врати",
    showCounts: true,
    types: [
      "ball",
      "goal-small",
      "goal-full",
      "goal-7m",
      "goal-5m",
      "goal-3m",
      "goal-1m",
    ],
  },
  FOOTBALL_EQUIPMENT,
  {
    title: "Линии и полета",
    types: [
      "line",
      "dashed-line",
      "circle",
      "hatched-circle",
      "rectangle",
      "hatched-rectangle",
      "triangle",
      "hatched-triangle",
    ],
  },
  { title: "Текст", types: ["text"] },
  {
    title: "Отбор 1",
    color: TEAM_COLORS[1],
    types: ["team1-coach", "team1-player-1"],
  },
  {
    title: "Отбор 2",
    color: TEAM_COLORS[2],
    types: ["team2-coach", "team2-player-1"],
  },
];

export function countEquipment(objects: readonly ExerciseObject[]) {
  const counts: Partial<Record<ExerciseTool, number>> = {};
  for (const object of objects) {
    if (object.kind !== "equipment" || !object.equipment) continue;
    const type = object.equipment.startsWith("marker-") ? "marker" : object.equipment;
    counts[type] = (counts[type] ?? 0) + 1;
  }
  return counts;
}
const defaultPaths: Partial<
  Record<ExerciseTool, NonNullable<ExerciseObject["path"]>>
> = {
  run: "straight",
  dribble: "straight",
  pass: "straight",
  shot: "straight",
};

// Sport-specific surface geometry; the editor always uses the shared logical board.
export const FOOTBALL = {
  id: "football",
  tools: FOOTBALL_TOOLS,
  customTeamTools: [
    "custom-team-coach", "custom-team-player",
  ] satisfies ExerciseTool[],
  labels: FOOTBALL_LABELS,
  defaultPaths,
  surfaces: [
    { id: "full", label: "Футболно игрище" },
    { id: "blank", label: "Празно поле" },
  ] as const,
  quadrantLabels: {
    "top-left": "Горе вляво",
    "top-right": "Горе вдясно",
    "bottom-left": "Долу вляво",
    "bottom-right": "Долу вдясно",
  },
  actions: {
    run: { dash: [12, 6], arrow: true },
    dribble: { dash: [], arrow: true },
    pass: { dash: [4, 6], arrow: true },
    "long-pass": { dash: [4, 6], arrow: true },
    shot: { dash: [], arrow: true },
    line: { dash: [], arrow: false },
    "dashed-line": { dash: [10, 6], arrow: false },
  },
};
