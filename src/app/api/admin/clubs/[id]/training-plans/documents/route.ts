import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authorizeTraining, UUID_RE } from "@/lib/exercise/access";
import { readDocumentInput } from "@/lib/exercise/document";
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
    select: { id: true, title: true, updatedAt: true, revision: true },
  });
  const documents = rows.slice(0, 25);
  return NextResponse.json({ documents, nextCursor: rows.length > 25 ? documents[24].id : null },
    { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clubId } = await params;
  const session = await authorizeTraining(request, clubId, "save");
  if (session instanceof NextResponse) return session;

  const body = await request.json().catch(() => null);
  const input = readDocumentInput(body?.content);
  if (!input || typeof body?.id !== "string" || !UUID_RE.test(body.id))
    return NextResponse.json({ error: "Невалидни полета в план-конспекта." }, { status: 400 });

  const where = { id: body.id as string, clubId, ownerId: session.sub };
  const existing = await prisma.trainingPlanDocument.findFirst({ where, select: documentDetail });
  if (existing) return NextResponse.json({ document: existing, alreadyCreated: true });
  if (!await prisma.club.findUnique({ where: { id: clubId }, select: { id: true } }))
    return NextResponse.json({ error: "Клубът не е намерен." }, { status: 404 });
  const content = await snapshotDocument(clubId, input);
  if (!content)
    return NextResponse.json({ error: "Изберете налична рисунка от този клуб." }, { status: 400 });

  const inserted = await prisma.trainingPlanDocument.createMany({
    data: { ...where, title: content.session.title.trim(), content },
    skipDuplicates: true,
  });
  const document = await prisma.trainingPlanDocument.findFirst({ where, select: documentDetail });
  if (!document)
    return NextResponse.json({ error: "План-конспектът не може да бъде създаден." }, { status: 409 });
  return NextResponse.json({ document, alreadyCreated: !inserted.count }, { status: inserted.count ? 201 : 200 });
}
