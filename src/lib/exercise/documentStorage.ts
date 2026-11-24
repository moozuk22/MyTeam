import { prisma } from "@/lib/db";
import type { TrainingImageTx } from "./imageStorage";
import { isV2, validateExercise } from "./model";
import type { DocumentInput, DrawingSnapshot, PlanContent } from "./document";

export async function snapshotDocument(
  clubId: string, input: DocumentInput, previous?: PlanContent, tx: Pick<TrainingImageTx, "trainingPlan"> = prisma,
): Promise<PlanContent | null> {
  const ids = [...new Set(input.sections.flatMap(({ drawing }) => drawing && drawing !== "keep" ? [drawing] : []))];
  const drawings = ids.length ? await tx.trainingPlan.findMany({
    where: { clubId, id: { in: ids } },
    select: { id: true, title: true, layout: true },
  }) : [];
  const snapshots = new Map<string, DrawingSnapshot>();
  for (const { id, title, layout } of drawings) {
    if (!isV2(layout) || validateExercise(layout)) return null;
    snapshots.set(id, { sourceId: id, title, layout });
  }
  if (snapshots.size !== ids.length) return null;
  const sections: PlanContent["sections"] = [];
  for (const [index, section] of input.sections.entries()) {
    const { drawing, ...fields } = section;
    const snapshot = drawing === "keep" ? previous?.sections[index]?.drawing :
      drawing ? snapshots.get(drawing) : null;
    if (snapshot === undefined || (drawing === "keep" && !snapshot)) return null;
    sections.push({ ...fields, drawing: snapshot });
  }
  return { ...input, sections };
}

export const documentDetail = { originKey: true, id: true, content: true, revision: true, updatedAt: true } as const;
