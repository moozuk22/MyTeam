import { MAX_PLAN_DESCRIPTION_LENGTH, MAX_PLAN_TITLE_LENGTH, TRAINING_UUID_PATTERN } from "@/lib/trainingPlans";
import { sameExercise, validateExercise, type Exercise } from "./model";
export type RecoveryDraft = {
  baseRevision: string;
  layout: Exercise;
  title?: string;
  description?: string;
  categoryId?: string | null;
  savedAt: number;
};
export function draftKey(userId: string, clubId: string, planId: string) {
  return `myteam:exercise:v2:${userId}:${clubId}:${planId}`;
}
export function readDraft(value: string | null): RecoveryDraft | null {
  if (!value) return null;
  try {
    const d = JSON.parse(value);
    return typeof d.baseRevision === "string" &&
      Number.isFinite(Date.parse(d.baseRevision)) &&
      typeof d.savedAt === "number" &&
      (d.title === undefined ||
        (typeof d.title === "string" && d.title.length <= MAX_PLAN_TITLE_LENGTH)) &&
      (d.description === undefined ||
        (typeof d.description === "string" && d.description.length <= MAX_PLAN_DESCRIPTION_LENGTH)) &&
      (d.categoryId === undefined || d.categoryId === null ||
        (typeof d.categoryId === "string" && TRAINING_UUID_PATTERN.test(d.categoryId))) &&
      !validateExercise(d.layout)
      ? d
      : null;
  } catch {
    return null;
  }
}
export function matchesDraft(
  draft: RecoveryDraft,
  layout: Exercise,
  title: string,
  description = "",
  categoryId: string | null = null,
) {
  return (draft.title === undefined || draft.title.trim() === title.trim()) &&
    (draft.description === undefined || draft.description.trim() === description.trim()) &&
    (draft.categoryId === undefined || draft.categoryId === categoryId) &&
    sameExercise(draft.layout, layout);
}
export { sameExercise };
