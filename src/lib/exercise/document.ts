import type { Exercise } from "./model";
import { TRAINING_UUID_PATTERN } from "@/lib/trainingPlans";

export const sessionFields = [
  ["title", "Заглавие", 120],
  ["season", "Спортно-състезателен сезон", 100],
  ["halfSeason", "Полусезон", 60],
  ["period", "Период", 100],
  ["microcycle", "Микроцикъл", 40],
  ["sessionNumber", "Тренировка №", 40],
  ["gameMoment", "Момент от играта", 160],
  ["objective", "Цел на тренировката", 500],
  ["tasks", "Задачи", 700],
  ["date", "Дата", 10, "date"],
  ["day", "Ден", 50],
  ["time", "Час", 5, "time"],
  ["playerCount", "Състезатели", 30],
  ["duration", "Времетраене (мин.)", 30],
  ["equipment", "Необходими пособия", 300],
  ["absences", "Отсъстващи", 300],
  ["injuries", "Контузени", 300],
  ["coach", "Треньор", 100],
  ["group", "Група", 100],
] as const;

export const exerciseFields = [
  ["title", "Заглавие на секцията", 120],
  ["organization", "Организация (играчи, пространство, пособия)", 500],
  ["coaching", "Цели / Насоки / Методически изисквания", 700],
  ["repetitions", "Повторения", 60],
  ["duration", "Времетраене (мин.)", 30],
] as const;

type Fields<T extends readonly (readonly [string, string, number, ...string[]])[]> =
  Record<T[number][0], string>;
export type SessionFields = Fields<typeof sessionFields>;
export type SectionFields = Fields<typeof exerciseFields>;
export type CompetitionSeason = Pick<SessionFields, "season" | "halfSeason">;
export type DrawingSnapshot = { sourceId: string; title: string; layout: Exercise };
export type DocumentSection = SectionFields & { drawing: DrawingSnapshot | null };
export type Merge = "none" | "left" | "right";
export type PlanContent = {
  version: 1;
  session: SessionFields;
  sections: DocumentSection[];
  merge: Merge;
};
export type SavedDocument = { id: string; content: PlanContent; revision: number; updatedAt: string };
export type DocumentSummary = { id: string; title: string; updatedAt: string; revision: number };
export type DocumentInput = Omit<PlanContent, "sections"> & {
  sections: (SectionFields & { drawing: string | null })[];
};
export const sectionTitles = [
  "Загрявка",
  "Фаза №1 (РФК)",
  "Фаза №2 · Технико-тактическо упражнение",
  "Фаза №3 · Игрова форма / Позиционна игра / Тактика",
  "Игрова форма / Игра с акцент / Свободна игра",
];

export function currentCompetitionSeason(now = new Date()): CompetitionSeason {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Sofia", year: "numeric", month: "2-digit",
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const firstHalf = month >= 7;
  const startYear = firstHalf ? year : year - 1;
  return {
    season: `${startYear}/${startYear + 1}`,
    halfSeason: firstHalf ? "Първи полусезон" : "Втори полусезон",
  };
}

export function documentBottomGroups(merge: Merge) {
  if (merge === "left") return [[2, 3], [4]];
  if (merge === "right") return [[2], [3, 4]];
  return [[2], [3], [4]];
}

export function blankDocument(group = ""): PlanContent {
  const session = Object.fromEntries(sessionFields.map(([key]) => [key, ""])) as SessionFields;
  session.title = "План за тренировка";
  session.group = group.slice(0, 100);
  return {
    version: 1,
    session,
    merge: "none",
    sections: sectionTitles.map((title) => ({
      title, organization: "", coaching: "", repetitions: "", duration: "", drawing: null,
    })),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function readFields<T extends readonly (readonly [string, string, number, ...string[]])[]>(
  input: unknown, fields: T,
): Fields<T> | null {
  if (!isRecord(input)) return null;
  const values: Record<string, string> = {};
  for (const [key, , max, type] of fields) {
    const value = input[key];
    if (typeof value !== "string" || value.length > max) return null;
    if (value && type === "date") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
      const date = new Date(value);
      if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
    }
    if (value && type === "time" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
    values[key] = value;
  }
  return values as Fields<T>;
}

export function readDocumentInput(input: unknown): DocumentInput | null {
  if (!isRecord(input) || input.version !== 1 ||
      (input.merge !== "none" && input.merge !== "left" && input.merge !== "right") ||
      !Array.isArray(input.sections) || input.sections.length !== sectionTitles.length) return null;
  const session = readFields(input.session, sessionFields);
  if (!session?.title.trim()) return null;
  const sections: DocumentInput["sections"] = [];
  for (const section of input.sections) {
    if (!isRecord(section)) return null;
    const fields = readFields(section, exerciseFields);
    const drawing = section.drawing;
    if (!fields || (drawing !== null && drawing !== "keep" &&
        (typeof drawing !== "string" || !TRAINING_UUID_PATTERN.test(drawing)))) return null;
    sections.push({ ...fields, drawing });
  }
  return { version: 1, session, sections, merge: input.merge };
}
