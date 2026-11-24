import { TRAINING_UUID_PATTERN as uuid } from "@/lib/trainingPlans";
import { monday } from "./microcycle";
import type { TrainingImageTx } from "./imageStorage";

export type SessionTarget = { cycleId: string; rowId: string; week: string; groupKey: string };
export type TrainingReference = {
  cells: string[]; group: string; microcycle: string; season: string; halfSeason: string; sessionNumber: string;
  documentId: string | null; occupied: boolean;
};

export function sessionTarget(value: unknown): SessionTarget | null {
  const target = groupTarget(value);
  if (!target) return null;
  const { cycleId, rowId } = value as Record<string, unknown>;
  if (typeof cycleId !== "string" || !uuid.test(cycleId) || typeof rowId !== "string" || !uuid.test(rowId)) return null;
  return { cycleId: cycleId.toLowerCase(), rowId: rowId.toLowerCase(), ...target };
}
/** Reads the group and week of a microcycle link, for example from a coach notification. */
export function groupTarget(value: unknown): { groupKey: string; week: string } | null {
  if (!value || typeof value !== "object") return null;
  const { groupKey, week } = value as Record<string, unknown>;
  if (typeof groupKey !== "string" || !/^(custom|training):/.test(groupKey) || !uuid.test(groupKey.substring(groupKey.indexOf(":") + 1)) ||
      typeof week !== "string") return null;
  try {
    if (monday(week) !== week) return null;
  } catch { return null; }
  return { groupKey, week };
}
export function sessionOrigin(target: SessionTarget) {
  return [target.cycleId, target.groupKey, target.rowId].join("/");
}
export function sessionUrl(path: "documents" | "microcycles", location: string, target: SessionTarget, document?: string) {
  const params = new URLSearchParams(location);
  for (const [key, value] of Object.entries(target)) params.set(key, value);
  if (document) params.set("document", document);
  return `/admin/training-plans/${path}?${params}`;
}

/** Reads the optional plan that a coach replaces in a training. Undefined means that the value is not valid. */
export function replacedDocument(value: unknown): string | null | undefined {
  if (value === undefined) return null;
  return typeof value === "string" && uuid.test(value) ? value : undefined;
}

/** True when the training has no plan, or it still uses the plan that the coach chose to replace. */
export function canLinkTraining(reference: Pick<TrainingReference, "documentId" | "occupied">, replace: string | null) {
  return !reference.occupied || (replace !== null && reference.documentId === replace);
}

/** Links the plan to the training. It replaces the current link when the training already has a plan. */
export function linkTrainingDocument(tx: TrainingImageTx, clubId: string, target: SessionTarget, documentId: string, occupied: boolean) {
  const key = { cycleId: target.cycleId, groupKey: target.groupKey, rowId: target.rowId };
  return occupied
    ? tx.trainingSessionDocument.update({ where: { cycleId_groupKey_rowId: key }, data: { documentId } })
    : tx.trainingSessionDocument.create({ data: { clubId, ...key, documentId } });
}
