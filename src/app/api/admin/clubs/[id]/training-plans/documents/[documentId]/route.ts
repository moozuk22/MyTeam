import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authorizeTraining, UUID_RE } from "@/lib/exercise/access";
import { currentCompetitionSeason, readDocumentInput, type PlanContent } from "@/lib/exercise/document";
import { documentImageIds, removeUnusedImages, storeDocumentImages, syncDocumentImages, TrainingImageError, withTrainingImages } from "@/lib/exercise/imageStorage";
import { documentDetail, snapshotDocument } from "@/lib/exercise/documentStorage";

type Context = { params: Promise<{ id: string; documentId: string }> };

async function documentScope(request: NextRequest, { params }: Context, requiredAccess: "read" | "save" = "read") {
  const { id: clubId, documentId } = await params;
  const session = await authorizeTraining(request, clubId, requiredAccess);
  if (session instanceof NextResponse) return session;
  if (!UUID_RE.test(documentId))
    return NextResponse.json({ error: "Невалиден план-конспект." }, { status: 400 });
  return { clubId, ownerId: session.sub, id: documentId };
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
  const document = await prisma.trainingPlanDocument.findFirst({ where, select: documentDetail });
  return document ? NextResponse.json({ document }, { headers: { "Cache-Control": "private, no-store" } }) : missing();
}

export async function PUT(request: NextRequest, context: Context) {
  const where = await documentScope(request, context, "save");
  if (where instanceof NextResponse) return where;
  const body = await request.json().catch(() => null);
  const parsedInput = readDocumentInput(body?.content);
  if (!parsedInput || !Number.isSafeInteger(body?.revision) || body.revision < 1)
    return NextResponse.json({ error: "Невалидни полета в план-конспекта." }, { status: 400 });
  const input = { ...parsedInput, session: { ...parsedInput.session, ...currentCompetitionSeason() } };

  return withTrainingImages(where.clubId, async (tx) => {
    const previous = await tx.trainingPlanDocument.findFirst({ where, select: documentDetail });
    if (!previous) return missing();
    if (previous.revision !== body.revision) return conflict();
    const snapshot = await snapshotDocument(where.clubId, input, previous.content as PlanContent, tx);
    if (!snapshot)
      return NextResponse.json({ error: "Изберете налична рисунка от този клуб." }, { status: 400 });
    const { content, imageIds } = await storeDocumentImages(tx, where.clubId, where.ownerId, snapshot);
    const updatedAt = new Date();
    const result = await tx.trainingPlanDocument.updateMany({
      where: { ...where, revision: previous.revision },
      data: { content, title: content.session.title.trim(), revision: { increment: 1 }, updatedAt },
    });
    if (!result.count) throw new TrainingImageError(
      "Има по-нова версия на план-конспекта. Отворете я в нов раздел, за да сравните промените.", 409,
    );
    await syncDocumentImages(tx, where.clubId, where.id, imageIds);
    await removeUnusedImages(tx, where.clubId, documentImageIds(previous.content as PlanContent));
    return NextResponse.json({
      document: { id: where.id, revision: previous.revision + 1, content, updatedAt },
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
