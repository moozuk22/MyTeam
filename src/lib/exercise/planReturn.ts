import { sectionTitles } from "@/lib/exercise/document";
import { sessionTarget, type SessionTarget } from "@/lib/exercise/trainingSession";

const DOCUMENTS_PATH = "/admin/training-plans/documents";
/** The query keys of a plan document page that the return link keeps. */
const DOCUMENT_KEYS = ["clubId", "coachGroupId", "document", "link", "replace", "cycleId", "rowId", "groupKey", "week"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The plan document that the coach left to create an exercise, and the plan section that gets the exercise. */
export type PlanReturn = {
  /** The plan document page. It is always a local path. */
  href: string;
  section: number;
  /** The training of the plan. The exercise editor then shows the methodist's instructions. */
  target?: SessionTarget;
};

function readSection(value: unknown) {
  return typeof value === "string" && /^\d$/.test(value) && Number(value) < sectionTitles.length ? Number(value) : null;
}

/** Opens the exercise editor for a new exercise. The editor can go back to the plan document `from`. */
export function newExerciseUrl(location: string, from: string, section: number) {
  const params = new URLSearchParams(location);
  params.set("from", from);
  params.set("section", String(section));
  return `/admin/training-plans/new?${params}`;
}

/**
 * Reads the plan document to go back to from the query of the exercise editor.
 * Gives null when the values are missing or not valid, or when the plan is for another club or coach group.
 */
export function readPlanReturn(query: { from?: unknown; section?: unknown }, clubId: string, coachGroupId?: string): PlanReturn | null {
  const section = readSection(query.section);
  const { from } = query;
  if (section === null || typeof from !== "string" || from.length > 2000 || !from.startsWith(`${DOCUMENTS_PATH}?`)) return null;
  const source = new URLSearchParams(from.slice(DOCUMENTS_PATH.length + 1));
  const document = source.get("document");
  if (source.get("clubId") !== clubId || (source.get("coachGroupId") ?? undefined) !== coachGroupId
    || !document || (document !== "new" && !UUID.test(document))) return null;
  // Build the link again from the known keys only, so that it cannot point to another page.
  const params = new URLSearchParams();
  for (const key of DOCUMENT_KEYS) {
    const value = source.get(key);
    if (value !== null) params.set(key, value);
  }
  const target = sessionTarget(Object.fromEntries(params));
  return { href: `${DOCUMENTS_PATH}?${params}`, section, ...(target && { target }) };
}

/** The query of the exercise editor that keeps the way back to the plan document. */
export function planReturnSearch(planReturn: PlanReturn) {
  return new URLSearchParams({ from: planReturn.href, section: String(planReturn.section) });
}

/** The plan document page. With `exercise`, the page puts that exercise in the section. */
export function planReturnUrl(planReturn: PlanReturn, exercise?: string) {
  if (!exercise) return planReturn.href;
  return `${planReturn.href}&${new URLSearchParams({ exercise, section: String(planReturn.section) })}`;
}

/** Reads the exercise that the plan document page gets back from the exercise editor. */
export function readReturnedExercise(query: { exercise?: unknown; section?: unknown }) {
  const section = readSection(query.section);
  return typeof query.exercise === "string" && UUID.test(query.exercise) && section !== null
    ? { exercise: query.exercise.toLowerCase(), section } : undefined;
}
