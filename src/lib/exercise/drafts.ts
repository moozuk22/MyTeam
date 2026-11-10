import { validateExercise, type Exercise } from "./model";
export type RecoveryDraft = {
  baseRevision: string;
  layout: Exercise;
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
      !validateExercise(d.layout)
      ? d
      : null;
  } catch {
    return null;
  }
}
export { sameExercise } from "./model";
