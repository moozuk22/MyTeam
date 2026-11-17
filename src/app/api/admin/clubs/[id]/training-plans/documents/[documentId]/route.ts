import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authorizeTraining, UUID_RE } from "@/lib/exercise/access";
import { readDocumentInput, type PlanContent } from "@/lib/exercise/document";
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
  const input = readDocumentInput(body?.content);
  if (!input || !Number.isSafeInteger(body?.revision) || body.revision < 1)
    return NextResponse.json({ error: "Невалидни полета в план-конспекта." }, { status: 400 });

  const previous = await prisma.trainingPlanDocument.findFirst({ where, select: documentDetail });
  if (!previous) return missing();
  if (previous.revision !== body.revision) return conflict();
  const content = await snapshotDocument(where.clubId, input, previous.content as PlanContent);
  if (!content)
    return NextResponse.json({ error: "Изберете налична рисунка от този клуб." }, { status: 400 });

  const updatedAt = new Date();
  const result = await prisma.trainingPlanDocument.updateMany({
    where: { ...where, revision: previous.revision },
    data: { content, title: content.session.title.trim(), revision: { increment: 1 }, updatedAt },
  });
  if (!result.count) return conflict();
  return NextResponse.json({
    document: { id: where.id, revision: previous.revision + 1, content, updatedAt },
  });
}

export async function DELETE(request: NextRequest, context: Context) {
  const where = await documentScope(request, context);
  if (where instanceof NextResponse) return where;
  const revision = Number(request.nextUrl.searchParams.get("revision"));
  if (!Number.isSafeInteger(revision) || revision < 1)
    return NextResponse.json({ error: "Невалидна версия на план-конспекта." }, { status: 400 });
  const result = await prisma.trainingPlanDocument.deleteMany({ where: { ...where, revision } });
  if (result.count) return new NextResponse(null, { status: 204 });
  return await prisma.trainingPlanDocument.findFirst({ where, select: { id: true } }) ? conflict() : missing();
}
