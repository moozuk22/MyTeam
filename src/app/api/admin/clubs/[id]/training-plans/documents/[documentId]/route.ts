import { canLinkTraining, linkTrainingDocument, replacedDocument, sessionTarget } from "@/lib/exercise/trainingSession";
import { documentOwnerFilter, trainingReference } from "@/lib/exercise/trainingSessionAccess";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authorizeTraining, UUID_RE } from "@/lib/exercise/access";
import { currentCompetitionSeason, readDocumentInput, type PlanContent } from "@/lib/exercise/document";
import { documentImageIds, removeUnusedImages, storeDocumentImages, syncDocumentImages, TrainingImageError, withTrainingImages } from "@/lib/exercise/imageStorage";
import { documentDetail, snapshotDocument } from "@/lib/exercise/documentStorage";
import { documentUsageSummary, hasTrainingLinks, linkedInOtherGroup, usageOf, withoutTrainingNumbers } from "@/lib/exercise/trainingUsage";

type Context = { params: Promise<{ id: string; documentId: string }> };

async function documentScope(request: NextRequest, { params }: Context, requiredAccess: "read" | "save" = "read") {
  const { id: clubId, documentId } = await params;
  const session = await authorizeTraining(request, clubId, requiredAccess);
  if (session instanceof NextResponse) return session;
  if (!UUID_RE.test(documentId))
    return NextResponse.json({ error: "Невалиден план-конспект." }, { status: 400 });
  return { clubId, ownerId: await documentOwnerFilter(clubId, session.sub, request.headers.get("x-coach-group")), id: documentId };
}

function missing() {
  return NextResponse.json({ error: "План-конспектът не е намерен." }, { status: 404 });
}

function conflict() {
  return NextResponse.json({
    error: "Има по-нова версия на план-конспекта. Отворете я в нов раздел, за да сравните промените.",
  }, { status: 409 });
}

export async function GET(request: NextRequest, context: Context) {
  const where = await documentScope(request, context);
  if (where instanceof NextResponse) return where;
  // A user can see only the plans of their author: the coach group, or the admin account.
  const document = await prisma.trainingPlanDocument.findFirst({ where, select: documentDetail });
  if (!document) return missing();
  // The detail gives at most 100 trainings and the exact number, which the overwrite confirmation shows.
  const usages = usageOf(await documentUsageSummary(prisma, where.clubId, [document.id]), document.id);
  return NextResponse.json({ document: { ...document, ...usages } }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PUT(request: NextRequest, context: Context) {
  const where = await documentScope(request, context, "save");
  if (where instanceof NextResponse) return where;
  const body = await request.json().catch(() => null);
  const parsedInput = readDocumentInput(body?.content);
  if (!parsedInput || !Number.isSafeInteger(body?.revision) || body.revision < 1)
    return NextResponse.json({ error: "Невалидни полета в план-конспекта." }, { status: 400 });
  const target = sessionTarget(body.target);
  if (body.target !== undefined && !target)
    return NextResponse.json({ error: "Невалидна тренировка." }, { status: 400 });
  // A coach can edit an unlinked plan for a training. The save then links the plan to that training.
  const link = body.link === true;
  if (body.link !== undefined && (!link || !target))
    return NextResponse.json({ error: "Невалидна тренировка." }, { status: 400 });
  const replace = replacedDocument(body.replaceDocumentId);
  if (replace === undefined || (replace && !link))
    return NextResponse.json({ error: "Невалиден план-конспект за замяна." }, { status: 400 });
  const input = { ...parsedInput, session: { ...parsedInput.session, ...currentCompetitionSeason() } };

  return withTrainingImages(where.clubId, async (tx) => {
    const previous = await tx.trainingPlanDocument.findFirst({ where, select: { ...documentDetail, ownerId: true } });
    if (!previous) return missing();
    let linkTarget = false;
    let occupied = false;
    if (target) {
      const reference = await trainingReference(tx, where.clubId, request.headers.get("x-coach-group"), target, true);
      // The group comes from the training, as it does when the plan is created from a training.
      // A plan that trainings of other groups also use keeps its stored group, so one group cannot change it for all.
      input.session.group = await linkedInOtherGroup(tx, where.clubId, where.id, target.groupKey)
        ? (previous.content as PlanContent).session.group : reference.group;
      linkTarget = link && reference.documentId !== where.id;
      occupied = reference.occupied;
      if (linkTarget && !canLinkTraining(reference, replace))
        return NextResponse.json({ error: "За тренировката вече има план-конспект. Вашите промени са в редактора.",
          ...(reference.documentId && { replaceDocumentId: reference.documentId }) }, { status: 409 });
      if (!linkTarget && reference.documentId !== where.id)
        throw new TrainingImageError("Връзката с тренировката е променена.", 409);
    }
    if (previous.revision !== body.revision) return conflict();
    // Each training gives its own numbers, so a linked plan does not store them.
    if (target || await hasTrainingLinks(tx, where.clubId, where.id)) Object.assign(input.session, withoutTrainingNumbers(input).session);
    if (target || previous.originKey) {
      const { season, halfSeason } = (previous.content as PlanContent).session;
      Object.assign(input.session, { season, halfSeason });
    }
    const snapshot = await snapshotDocument(where.clubId, input, previous.content as PlanContent, tx);
    if (!snapshot)
      return NextResponse.json({ error: "Изберете налично упражнение от този клуб." }, { status: 400 });
    const { content, imageIds } = await storeDocumentImages(tx, where.clubId, previous.ownerId, snapshot);
    const updatedAt = new Date();
    const result = await tx.trainingPlanDocument.updateMany({
      where: { ...where, revision: previous.revision },
      data: { content, title: content.session.title.trim(), revision: { increment: 1 }, updatedAt },
    });
    if (!result.count) throw new TrainingImageError(
      "Има по-нова версия на план-конспекта. Отворете я в нов раздел, за да сравните промените.", 409,
    );
    if (target && linkTarget) await linkTrainingDocument(tx, where.clubId, target, where.id, occupied);
    await syncDocumentImages(tx, where.clubId, where.id, imageIds);
    await removeUnusedImages(tx, where.clubId, documentImageIds(previous.content as PlanContent));
    const usages = usageOf(await documentUsageSummary(tx, where.clubId, [where.id]), where.id);
    return NextResponse.json({
      document: { id: where.id, revision: previous.revision + 1, content, updatedAt, ...usages },
    });
  });
}

export async function DELETE(request: NextRequest, context: Context) {
  const where = await documentScope(request, context);
  if (where instanceof NextResponse) return where;
  const revision = Number(request.nextUrl.searchParams.get("revision"));
  if (!Number.isSafeInteger(revision) || revision < 1)
    return NextResponse.json({ error: "Невалидна версия на план-конспекта." }, { status: 400 });
  return withTrainingImages(where.clubId, async (tx) => {
    const previous = await tx.trainingPlanDocument.findFirst({ where, select: documentDetail });
    if (!previous) return missing();
    if (previous.revision !== revision) return conflict();
    const result = await tx.trainingPlanDocument.deleteMany({ where: { ...where, revision } });
    if (!result.count) return conflict();
    await removeUnusedImages(tx, where.clubId, documentImageIds(previous.content as PlanContent));
    return new NextResponse(null, { status: 204 });
  });
}
