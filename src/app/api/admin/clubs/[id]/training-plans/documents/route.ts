import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authorizeTraining, findTrainingPlanCoachGroup, UUID_RE } from "@/lib/exercise/access";
import { currentCompetitionSeason, readDocumentInput, summarizeDocument } from "@/lib/exercise/document";
import { storeDocumentImages, syncDocumentImages, TrainingImageError, withTrainingImages } from "@/lib/exercise/imageStorage";
import type { PlanContent } from "@/lib/exercise/document";
import { documentDetail, snapshotDocument } from "@/lib/exercise/documentStorage";

import { canLinkTraining, linkTrainingDocument, replacedDocument, sessionOrigin, sessionTarget } from "@/lib/exercise/trainingSession";
import { coachAuthor, documentOwnerFilter, trainingReference } from "@/lib/exercise/trainingSessionAccess";
import { documentUsageSummary, usageOf, withoutTrainingNumbers } from "@/lib/exercise/trainingUsage";

/** The training already has another plan. When the plan is the coach's own, the editor offers to replace it. */
function occupiedTraining(error: string, documentId: string | null, extra?: object) {
  return NextResponse.json({ error, ...extra, ...(documentId && { replaceDocumentId: documentId }) }, { status: 409 });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clubId } = await params;
  const session = await authorizeTraining(request, clubId);
  if (session instanceof NextResponse) return session;

  const cursor = request.nextUrl.searchParams.get("cursor");
  const where = { clubId, ownerId: await documentOwnerFilter(clubId, session.sub, request.headers.get("x-coach-group")) };
  if (cursor && (!UUID_RE.test(cursor) || !await prisma.trainingPlanDocument.findFirst({
    where: { ...where, id: cursor }, select: { id: true },
  }))) return NextResponse.json({ error: "Невалидна страница." }, { status: 400 });

  const rows = await prisma.trainingPlanDocument.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    take: 26,
    select: { id: true, title: true, updatedAt: true, revision: true, content: true },
  });
  const page = rows.slice(0, 25);
  const { usages, totals } = await documentUsageSummary(prisma, clubId, page.map(row => row.id));
  const documents = page.map(({ content, ...row }) => ({ ...row, preview: summarizeDocument(content), usages: usages.get(row.id) ?? [], usageCount: totals.get(row.id) ?? 0 }));
  return NextResponse.json({ documents, nextCursor: rows.length > 25 ? documents[24].id : null },
    { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clubId } = await params;
  const session = await authorizeTraining(request, clubId, "save");
  if (session instanceof NextResponse) return session;

  const body = await request.json().catch(() => null);
  const target = sessionTarget(body?.target);
  const coach = request.headers.get("x-coach-group");
  // A coach can replace the plan of a training only while the training still uses that plan.
  const replace = replacedDocument(body?.replaceDocumentId);
  if (replace === undefined || (replace && !target))
    return NextResponse.json({ error: "Невалиден план-конспект за замяна." }, { status: 400 });
  if (body?.linkDocumentId !== undefined) {
    const id = body.linkDocumentId;
    if (!target || typeof id !== "string" || !UUID_RE.test(id))
      return NextResponse.json({ error: "Невалидна тренировка или план-конспект." }, { status: 400 });
    const ownerId = await documentOwnerFilter(clubId, session.sub, coach);
    return withTrainingImages(clubId, async tx => {
      const reference = await trainingReference(tx, clubId, coach, target, true);
      // A training can use only the plans of the coach.
      const source = await tx.trainingPlanDocument.findFirst({ where: { id, clubId, ownerId }, select: { id: true } });
      if (!source) throw new TrainingImageError("План-конспектът не е намерен.", 404);
      if (reference.documentId === source.id)
        return NextResponse.json({ ...source, ...usageOf(await documentUsageSummary(tx, clubId, [source.id]), source.id) });
      if (!canLinkTraining(reference, replace)) return occupiedTraining("За тренировката вече има план-конспект.", reference.documentId);
      await linkTrainingDocument(tx, clubId, target, source.id, reference.occupied);
      return NextResponse.json({ ...source, ...usageOf(await documentUsageSummary(tx, clubId, [source.id]), source.id) }, { status: 201 });
    });
  }
  const forkFrom = body?.forkFrom;
  if (forkFrom !== undefined && (!target || typeof forkFrom !== "string" || !UUID_RE.test(forkFrom) || !Number.isInteger(body.sourceRevision)))
    return NextResponse.json({ error: "Невалиден изходен план-конспект." }, { status: 400 });
  // A copy of an unlinked plan is linked to the training when it is saved.
  const link = body?.link === true;
  if (body?.link !== undefined && (!link || !forkFrom))
    return NextResponse.json({ error: "Невалидна тренировка." }, { status: 400 });
  const parsedInput = readDocumentInput(body?.content);
  if (!parsedInput || typeof body?.id !== "string" || !UUID_RE.test(body.id))
    return NextResponse.json({ error: "Невалидни полета в план-конспекта." }, { status: 400 });
  if (body.target !== undefined && !target) return NextResponse.json({ error: "Невалидна тренировка." }, { status: 400 });

  const privateDraft = !target && body.privateCoachDraft === true;
  // With a coach link, the coach group is the author also of a plan that the coach makes in the library.
  if ((privateDraft || (coach && !target)) && !await findTrainingPlanCoachGroup(clubId, coach))
    return NextResponse.json({ error: "Необходима е група на треньора." }, { status: 403 });
  // The server sets the season. A plan for a training gets the season of the training below.
  const input = { ...parsedInput, session: { ...parsedInput.session, ...currentCompetitionSeason() } };
  const sourceOwner = forkFrom ? await documentOwnerFilter(clubId, session.sub, coach) : undefined;
  return withTrainingImages(clubId, async (tx) => {
    if (target && !coach) throw new TrainingImageError("Необходима е група на треньора.", 403);
    const where = { id: body.id as string, clubId, ownerId: target || privateDraft || coach ? coachAuthor(coach!) : session.sub };
    const existing = await tx.trainingPlanDocument.findFirst({ where, select: documentDetail });
    let previous: PlanContent | undefined;
    let occupied = false;
    if (target) {
      let reference;
      try {
        reference = await trainingReference(tx, clubId, coach, target, true);
      } catch (error) {
        if (error instanceof TrainingImageError && (error.status === 410 || error.status === 403)) {
          const committed = existing?.originKey === sessionOrigin(target);
          return NextResponse.json({ error: error.message, recovery: committed ? "saved" : forkFrom ? undefined : "private",
            documentId: committed ? existing.id : undefined }, { status: error.status });
        }
        throw error;
      }
      if (existing && (existing.originKey !== sessionOrigin(target) || reference.documentId !== existing.id))
        throw new TrainingImageError("Този запис вече съществува в библиотеката.", 409);
      occupied = reference.occupied;
      if (!existing && !forkFrom && !canLinkTraining(reference, replace))
        return occupiedTraining("За тренировката вече има друг план-конспект. Вашият текст е в редактора.", reference.documentId, { recovery: "private" });
      if (forkFrom && !existing) {
        if (reference.documentId !== forkFrom && !link)
          throw new TrainingImageError("Връзката с тренировката е променена. Вашите промени са в редактора.", 409);
        if (reference.documentId !== forkFrom && !canLinkTraining(reference, replace))
          return occupiedTraining("За тренировката вече има план-конспект. Вашите промени са в редактора.", reference.documentId);
        const source = await tx.trainingPlanDocument.findFirst({ where: { id: forkFrom, clubId, ownerId: sourceOwner }, select: documentDetail });
        if (!source || source.revision !== body.sourceRevision)
          throw new TrainingImageError("Изходният план-конспект е променен. Вашите промени са в редактора.", 409);
        previous = source.content as unknown as PlanContent;
      }
      // A copy also gets the group and season of its training, not the values that the browser sent.
      Object.assign(input.session, { group: reference.group, season: reference.season, halfSeason: reference.halfSeason });
      // Each training gives its own numbers, so a linked plan does not store them.
      Object.assign(input.session, withoutTrainingNumbers(input).session);
    }
    if (existing) return NextResponse.json({ document: existing, alreadyCreated: true });
    if (!await tx.club.findUnique({ where: { id: clubId }, select: { id: true } }))
      return NextResponse.json({ error: "Клубът не е намерен." }, { status: 404 });
    const snapshot = await snapshotDocument(clubId, input, previous, tx);
    if (!snapshot)
      return NextResponse.json({ error: "Изберете налично упражнение от този клуб." }, { status: 400 });
    const { content, imageIds } = await storeDocumentImages(tx, clubId, where.ownerId, snapshot);
    const inserted = await tx.trainingPlanDocument.createMany({
      data: { ...where, ...(target ? { originKey: sessionOrigin(target) } : privateDraft ? { originKey: "private" } : {}), title: content.session.title.trim(), content }, skipDuplicates: true,
    });
    const document = await tx.trainingPlanDocument.findFirst({ where, select: documentDetail });
    if (!document) throw new TrainingImageError("План-конспектът не може да бъде създаден.", 409);
    if (target) {
      if (!inserted.count) throw new TrainingImageError("Записът е в конфликт. Опитайте отново.", 409);
      await linkTrainingDocument(tx, clubId, target, document.id, occupied);
    }
    if (inserted.count) await syncDocumentImages(tx, clubId, document.id, imageIds);
    const usages = target ? usageOf(await documentUsageSummary(tx, clubId, [document.id]), document.id) : { usages: [], usageCount: 0 };
    return NextResponse.json({ document: { ...document, ...usages }, alreadyCreated: !inserted.count }, { status: inserted.count ? 201 : 200 });
  });
}
