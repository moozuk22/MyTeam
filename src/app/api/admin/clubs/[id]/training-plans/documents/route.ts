import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authorizeTraining, UUID_RE } from "@/lib/exercise/access";
import { currentCompetitionSeason, readDocumentInput, summarizeDocument } from "@/lib/exercise/document";
import { storeDocumentImages, syncDocumentImages, TrainingImageError, withTrainingImages } from "@/lib/exercise/imageStorage";
import { documentDetail, snapshotDocument } from "@/lib/exercise/documentStorage";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clubId } = await params;
  const session = await authorizeTraining(request, clubId);
  if (session instanceof NextResponse) return session;

  const cursor = request.nextUrl.searchParams.get("cursor");
  const where = { clubId, ownerId: session.sub };
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
  const documents = rows.slice(0, 25).map(({ content, ...row }) => ({ ...row, preview: summarizeDocument(content) }));
  return NextResponse.json({ documents, nextCursor: rows.length > 25 ? documents[24].id : null },
    { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clubId } = await params;
  const session = await authorizeTraining(request, clubId, "save");
  if (session instanceof NextResponse) return session;

  const body = await request.json().catch(() => null);
  const parsedInput = readDocumentInput(body?.content);
  if (!parsedInput || typeof body?.id !== "string" || !UUID_RE.test(body.id))
    return NextResponse.json({ error: "Невалидни полета в план-конспекта." }, { status: 400 });
  const input = { ...parsedInput, session: { ...parsedInput.session, ...currentCompetitionSeason() } };

  return withTrainingImages(clubId, async (tx) => {
    const where = { id: body.id as string, clubId, ownerId: session.sub };
    const existing = await tx.trainingPlanDocument.findFirst({ where, select: documentDetail });
    if (existing) return NextResponse.json({ document: existing, alreadyCreated: true });
    if (!await tx.club.findUnique({ where: { id: clubId }, select: { id: true } }))
      return NextResponse.json({ error: "Клубът не е намерен." }, { status: 404 });
    const snapshot = await snapshotDocument(clubId, input, undefined, tx);
    if (!snapshot)
      return NextResponse.json({ error: "Изберете налична рисунка от този клуб." }, { status: 400 });
    const { content, imageIds } = await storeDocumentImages(tx, clubId, session.sub, snapshot);
    const inserted = await tx.trainingPlanDocument.createMany({
      data: { ...where, title: content.session.title.trim(), content }, skipDuplicates: true,
    });
    const document = await tx.trainingPlanDocument.findFirst({ where, select: documentDetail });
    if (!document) throw new TrainingImageError("План-конспектът не може да бъде създаден.", 409);
    if (inserted.count) await syncDocumentImages(tx, clubId, document.id, imageIds);
    return NextResponse.json({ document, alreadyCreated: !inserted.count }, { status: inserted.count ? 201 : 200 });
  });
}
