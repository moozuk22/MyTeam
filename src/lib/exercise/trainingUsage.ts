import type { TrainingImageTx } from "./imageStorage";
import type { PlanContent } from "./document";

/** A training that uses a plan. The numbers come from the microcycle, not from the plan text. */
export type TrainingUsage = {
  cycleId: string; groupKey: string; rowId: string; week: string; group: string;
  microcycle: string;
  /** The position of the training in the microcycle, from 1. It is empty when the training was removed. */
  sessionNumber: string;
};

/** The examples of trainings for each plan. A plan with more trainings gives the total in `totals`. */
const MAX_USAGES_PER_DOCUMENT = 100;

type Row = { document_id: string; cycle_id: string; group_key: string; row_id: string; week: string; group_name: string; number: string | null; position: bigint | number | null; total: bigint | number };

/**
 * Reads the trainings that use each plan, the latest week first. The limit applies to each plan separately,
 * so a plan with many trainings does not hide the trainings of other plans. `totals` gives the exact number for each plan.
 */
export async function documentUsageSummary(db: Pick<TrainingImageTx, "$queryRaw">, clubId: string, documentIds: string[]) {
  const usages = new Map<string, TrainingUsage[]>(documentIds.map(id => [id, []]));
  const totals = new Map<string, number>(documentIds.map(id => [id, 0]));
  if (!documentIds.length) return { usages, totals };
  const rows = await db.$queryRaw<Row[]>`
    WITH links AS (
      SELECT l.document_id, l.cycle_id::text AS cycle_id, l.group_key, l.row_id::text AS row_id,
        c.week, g.group_name, c.content->>'number' AS number,
        (SELECT r.n FROM jsonb_array_elements(c.content->'rows') WITH ORDINALITY AS r(item, n) WHERE r.item->>'id' = l.row_id::text LIMIT 1) AS position
      FROM training_session_documents l
      JOIN training_microcycles c ON c.id = l.cycle_id AND c.club_id = l.club_id
      JOIN training_microcycle_groups g ON g.cycle_id = l.cycle_id AND g.group_key = l.group_key
      WHERE l.club_id = ${clubId}::uuid AND l.document_id = ANY(${documentIds}::uuid[])
    ), ranked AS (
      SELECT links.*, ROW_NUMBER() OVER (PARTITION BY document_id ORDER BY week DESC, position ASC NULLS LAST, cycle_id, row_id) AS n,
        COUNT(*) OVER (PARTITION BY document_id) AS total
      FROM links
    )
    SELECT document_id::text AS document_id, cycle_id, group_key, row_id, week, group_name, number, position, total
    FROM ranked WHERE n <= ${MAX_USAGES_PER_DOCUMENT}
    ORDER BY document_id, n`;
  for (const row of rows) {
    totals.set(row.document_id, Number(row.total));
    usages.get(row.document_id)?.push({
      cycleId: row.cycle_id, groupKey: row.group_key, rowId: row.row_id, week: row.week, group: row.group_name.slice(0, 100),
      microcycle: (row.number ?? "").slice(0, 40), sessionNumber: row.position === null ? "" : String(row.position),
    });
  }
  return { usages, totals };
}

/** The trainings of one plan from a summary: at most 100 examples and the exact number. */
export function usageOf(summary: Awaited<ReturnType<typeof documentUsageSummary>>, documentId: string) {
  return { usages: summary.usages.get(documentId) ?? [], usageCount: summary.totals.get(documentId) ?? 0 };
}

/** Reads the trainings that use each plan, the latest week first, at most 100 for each plan. */
export async function documentUsages(db: Pick<TrainingImageTx, "$queryRaw">, clubId: string, documentIds: string[]) {
  return (await documentUsageSummary(db, clubId, documentIds)).usages;
}

/** True when at least one training uses the plan. */
export async function hasTrainingLinks(db: Pick<TrainingImageTx, "trainingSessionDocument">, clubId: string, documentId: string) {
  return !!await db.trainingSessionDocument.findFirst({ where: { clubId, documentId }, select: { documentId: true } });
}

/** A linked plan does not store "Микроцикъл" and "Тренировка №". Each training gives its own numbers. */
export function withoutTrainingNumbers<T extends Pick<PlanContent, "session">>(content: T): T {
  return { ...content, session: { ...content.session, microcycle: "", sessionNumber: "" } };
}

/** For example "Микроцикъл 3, тренировка №2". */
export function usageLabel(usage: Pick<TrainingUsage, "microcycle" | "sessionNumber">) {
  return `Микроцикъл ${usage.microcycle || "—"}, тренировка №${usage.sessionNumber || "—"}`;
}
