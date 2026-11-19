import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isV2, validateSavedLayout, type Exercise } from "./model";
import type { PlanContent } from "./document";
import { INLINE_IMAGE_PREFIX, readTrainingImageSource, trainingImageSource } from "./imageSource";

export type TrainingImageTx = Omit<typeof prisma, "$extends" | "$transaction" | "$connect" | "$disconnect" | "$on" | "$use">;

export class TrainingImageError extends Error {
  constructor(message = "Изображението не е налично. Отворете рисунката отново.", public status = 400) {
    super(message);
  }
}

export async function withTrainingImages<T>(clubId: string, operation: (tx: TrainingImageTx) => Promise<T>) {
  try {
    return await prisma.$transaction(async (tx) => {
      // Use the same lock for saves, copies, deletion, and the backfill.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`training-images:${clubId}`}, 0))`;
      return operation(tx);
    });
  } catch (error) {
    if (error instanceof TrainingImageError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}

export async function storeDrawingImage(
  tx: TrainingImageTx, clubId: string, ownerId: string, layout: unknown,
  trusted = false,
): Promise<{ layout: Prisma.InputJsonValue; backgroundImageId: string | null }> {
  const error = validateSavedLayout(layout);
  if (error) throw new TrainingImageError(error);
  if (!isV2(layout) || !layout.background)
    return { layout: layout as Prisma.InputJsonValue, backgroundImageId: null };
  let imageId: string;
  const source = layout.background.src;
  const reference = readTrainingImageSource(source);
  if (reference) {
    if (reference.clubId !== clubId) throw new TrainingImageError();
    const image = await tx.trainingImage.findFirst({
      where: {
        id: reference.imageId, clubId,
        ...(!trusted ? { OR: [
          { plans: { some: {} } },
          { documents: { some: { document: { ownerId } } } },
        ] } : {}),
      },
      select: { id: true },
    });
    if (!image) throw new TrainingImageError();
    imageId = image.id;
  } else {
    const bytes = Buffer.from(source.slice(INLINE_IMAGE_PREFIX.length), "base64");
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    // The club lock prevents concurrent create/find races. Do not update shared rows.
    const existing = await tx.trainingImage.findUnique({ where: { clubId_sha256: { clubId, sha256 } }, select: { id: true } });
    const image = existing ?? await tx.trainingImage.create({ data: { clubId, sha256, bytes }, select: { id: true } });
    imageId = image.id;
  }
  return {
    layout: { ...layout, background: { ...layout.background, src: trainingImageSource(clubId, imageId) } },
    backgroundImageId: imageId,
  };
}

export async function storeDocumentImages(
  tx: TrainingImageTx, clubId: string, ownerId: string, content: PlanContent,
) {
  const images = new Set<string>();
  const sections: PlanContent["sections"] = [];
  // A document has five sections. Reuse each source within the transaction.
  const drawings = new Map<Exercise, Awaited<ReturnType<typeof storeDrawingImage>>>();
  for (const section of content.sections) {
    if (!section.drawing) { sections.push(section); continue; }
    const source = section.drawing.layout;
    let saved = drawings.get(source);
    if (!saved) {
      saved = await storeDrawingImage(tx, clubId, ownerId, source, true);
      drawings.set(source, saved);
    }
    if (saved.backgroundImageId) images.add(saved.backgroundImageId);
    sections.push({ ...section, drawing: { ...section.drawing, layout: saved.layout as unknown as Exercise } });
  }
  return { content: { ...content, sections }, imageIds: [...images] };
}

export async function syncDocumentImages(tx: TrainingImageTx, clubId: string, documentId: string, imageIds: string[]) {
  await tx.trainingDocumentImage.deleteMany({ where: { documentId, clubId } });
  if (imageIds.length) await tx.trainingDocumentImage.createMany({
    data: imageIds.map((imageId) => ({ clubId, documentId, imageId })),
  });
}

/** Call only with the club lock held and after all new references are saved. */
export async function removeUnusedImages(tx: TrainingImageTx, clubId: string, imageIds: string[]) {
  if (!imageIds.length) return;
  await tx.trainingImage.deleteMany({
    where: { clubId, id: { in: [...new Set(imageIds)] }, plans: { none: {} }, documents: { none: {} } },
  });
}

export function documentImageIds(content: PlanContent) {
  return content.sections.flatMap(({ drawing }) => {
    const reference = drawing?.layout.background && readTrainingImageSource(drawing.layout.background.src);
    return reference ? [reference.imageId] : [];
  });
}

/** Keep open editor history and local drafts independent of saved image lifetimes. */
async function inlineDrawingImage<T>(tx: TrainingImageTx, clubId: string, layout: T): Promise<T> {
  if (!isV2(layout) || !layout.background) return layout;
  const reference = readTrainingImageSource(layout.background.src);
  if (!reference) return layout;
  if (reference.clubId !== clubId) throw new TrainingImageError();
  const image = await tx.trainingImage.findFirst({ where: { id: reference.imageId, clubId }, select: { bytes: true } });
  if (!image) throw new TrainingImageError();
  return { ...layout, background: { ...layout.background, src: `${INLINE_IMAGE_PREFIX}${Buffer.from(image.bytes).toString("base64")}` } };
}

/** Read the plan and its image from one snapshot, even if a writer removes them. */
export async function readEditableTrainingPlan(clubId: string, planId: string) {
  return prisma.$transaction(async (tx) => {
    const plan = await tx.trainingPlan.findFirst({
      where: { id: planId, clubId },
      select: {
        id: true, clubId: true, title: true, description: true, categoryId: true,
        layout: true, updatedAt: true, createdAt: true,
      },
    });
    if (!plan) return null;
    return { ...plan, layout: await inlineDrawingImage(tx, clubId, plan.layout) };
  }, { isolationLevel: "RepeatableRead" });
}
