import type { TrainingImageTx } from "./imageStorage";
import type { PlanContent } from "./document";

/** A training that uses a plan. The numbers come from the microcycle, not from the plan text. */
export type TrainingUsage = {
  cycleId: string; groupKey: string; rowId: string; week: string; group: string;
  microcycle: string;
  /** The position of the training in the microcycle, from 1. It is empty when the training was removed. */
  sessionNumber: string;
};

/** A plan is linked to a small number of trainings. This limit keeps a list request bounded. */
const MAX_USAGES = 500;

type Row = { document_id: string; cycle_id: string; group_key: string; row_id: string; week: string; group_name: string; number: string | null; position: bigint | number | null };

/** Reads the trainings that use each plan, the latest week first. */
export async function documentUsages(db: Pick<TrainingImageTx, "$queryRaw">, clubId: string, documentIds: string[]) {
  const usages = new Map<string, TrainingUsage[]>(documentIds.map(id => [id, []]));
  if (!documentIds.length) return usages;
  const rows = await db.$queryRaw<Row[]>`
    SELECT l.document_id::text AS document_id, l.cycle_id::text AS cycle_id, l.group_key, l.row_id::text AS row_id,
      c.week, c.group_name, c.content->>'number' AS number,
      (SELECT r.n FROM jsonb_array_elements(c.content->'rows') WITH ORDINALITY AS r(item, n) WHERE r.item->>'id' = l.row_id::text LIMIT 1) AS position
    FROM training_session_documents l
    JOIN training_microcycles c ON c.id = l.cycle_id AND c.club_id = l.club_id
    WHERE l.club_id = ${clubId}::uuid AND l.document_id = ANY(${documentIds}::uuid[])
    ORDER BY c.week DESC, position ASC
    LIMIT ${MAX_USAGES}`;
  for (const row of rows) usages.get(row.document_id)?.push({
    cycleId: row.cycle_id, groupKey: row.group_key, rowId: row.row_id, week: row.week, group: row.group_name.slice(0, 100),
    microcycle: (row.number ?? "").slice(0, 40), sessionNumber: row.position === null ? "" : String(row.position),
  });
  return usages;
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
