import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { PlanContent } from "./document";
import { storeDocumentImages, storeDrawingImage, syncDocumentImages, withTrainingImages } from "./imageStorage";

const BATCH_SIZE = 25;

/** Convert one record per transaction. Keep the public revision and update time. */
export async function backfillTrainingImages() {
  const counts = { plans: 0, documents: 0 };
  for (const kind of ["plans", "documents"] as const) {
    let cursor = "00000000-0000-0000-0000-000000000000";
    for (;;) {
      const rows = kind === "plans"
        ? await prisma.$queryRaw<{ id: string; clubId: string }[]>`
            SELECT id, club_id AS "clubId" FROM training_plans
            WHERE id > ${cursor}::uuid AND layout #>> '{background,src}' LIKE 'data:image/jpeg;base64,%'
            ORDER BY id LIMIT ${BATCH_SIZE}`
        : await prisma.$queryRaw<{ id: string; clubId: string }[]>`
            SELECT id, club_id AS "clubId" FROM training_plan_documents
            WHERE id > ${cursor}::uuid AND EXISTS (
              SELECT 1 FROM jsonb_array_elements(content->'sections') AS section
              WHERE section #>> '{drawing,layout,background,src}' LIKE 'data:image/jpeg;base64,%'
            ) ORDER BY id LIMIT ${BATCH_SIZE}`;
      if (!rows.length) break;
      for (const { id, clubId } of rows) {
        const result = await withTrainingImages(clubId, async (tx) => {
          if (kind === "plans") {
            const plan = await tx.trainingPlan.findFirst({ where: { id, clubId }, select: { layout: true, updatedAt: true } });
            if (!plan) return false;
            const stored = await storeDrawingImage(tx, clubId, "", plan.layout, true);
            await tx.trainingPlan.update({ where: { id }, data: { ...stored, updatedAt: plan.updatedAt } });
          } else {
            const document = await tx.trainingPlanDocument.findFirst({ where: { id, clubId }, select: { content: true, ownerId: true, updatedAt: true } });
            if (!document) return false;
            const stored = await storeDocumentImages(tx, clubId, document.ownerId, document.content as PlanContent);
            await tx.trainingPlanDocument.update({ where: { id }, data: { content: stored.content, updatedAt: document.updatedAt } });
            await syncDocumentImages(tx, clubId, id, stored.imageIds);
          }
          return true;
        });
        if (result instanceof NextResponse) throw new Error(`Image backfill failed for ${kind} record ${id} (${result.status}).`);
        if (result) counts[kind]++;
      }
      cursor = rows.at(-1)!.id;
    }
  }
  return counts;
}
