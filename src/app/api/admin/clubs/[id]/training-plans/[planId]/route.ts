import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { authorizeTraining, UUID_RE } from "@/lib/exercise/access";
import { isTrainingPlanCategoryAvailable } from "@/lib/exercise/categories";
import { isV2, layoutVersion, validateSavedLayout } from "@/lib/exercise/model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeDescription(raw: unknown) {
  const value = String(raw ?? "").trim();
  return value ? value : null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; planId: string }> },
) {
  const { id, planId } = await params;
  const session = await authorizeTraining(request, id);
  if (session instanceof NextResponse) return session;
  if (!UUID_RE.test(id) || !UUID_RE.test(planId)) {
    return NextResponse.json(
      { error: "Невалиден идентификатор." },
      { status: 400 },
    );
  }

  const plan = await prisma.trainingPlan.findUnique({
    where: { id: planId },
    select: {
      id: true,
      clubId: true,
      title: true,
      description: true,
      categoryId: true,
      layout: true,
      updatedAt: true,
      createdAt: true,
    },
  });
  if (!plan || plan.clubId !== id)
    return NextResponse.json(
      { error: "Планът не е намерен." },
      { status: 404 },
    );

  return NextResponse.json({
    plan: { ...plan, layoutVersion: layoutVersion(plan.layout) },
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; planId: string }> },
) {
  const { id, planId } = await params;
  const session = await authorizeTraining(request, id, "save");
  if (session instanceof NextResponse) return session;
  if (!UUID_RE.test(id) || !UUID_RE.test(planId)) {
    return NextResponse.json(
      { error: "Невалиден идентификатор." },
      { status: 400 },
    );
  }

  const existing = await prisma.trainingPlan.findUnique({
    where: { id: planId },
    select: { id: true, clubId: true, layout: true, updatedAt: true },
  });
  if (!existing || existing.clubId !== id)
    return NextResponse.json(
      { error: "Планът не е намерен." },
      { status: 404 },
    );

  const rawBody: unknown = await request.json().catch(() => null);
  if (!rawBody || typeof rawBody !== "object" || Array.isArray(rawBody))
    return NextResponse.json({ error: "Невалидна заявка." }, { status: 400 });
  const body = rawBody as Record<string, unknown>;
  const data: {
    title?: string;
    description?: string | null;
    categoryId?: string | null;
    layout?: Prisma.InputJsonValue;
    updatedByUserId: string | null;
  } = {
    updatedByUserId: UUID_RE.test(session.sub) ? session.sub : null,
  };

  if (Object.hasOwn(body, "title")) {
    const title = String(body.title ?? "").trim();
    if (!title)
      return NextResponse.json(
        { error: "Името е задължително." },
        { status: 400 },
      );
    if (title.length > 200)
      return NextResponse.json(
        { error: "Името е твърде дълго." },
        { status: 400 },
      );
    data.title = title;
  }

  if (Object.hasOwn(body, "description")) {
    const description = normalizeDescription(body.description);
    if (description && description.length > 1000) {
      return NextResponse.json(
        { error: "Описанието е твърде дълго." },
        { status: 400 },
      );
    }
    data.description = description;
  }

  if (Object.hasOwn(body, "categoryId")) {
    if (body.categoryId !== null && !(await isTrainingPlanCategoryAvailable(id, body.categoryId)))
      return NextResponse.json({ error: "Невалидна категория." }, { status: 400 });
    data.categoryId = body.categoryId as string | null;
  }

  if (Object.hasOwn(body, "layout")) {
    if (layoutVersion(body.layout) !== layoutVersion(existing.layout))
      return NextResponse.json(
        { error: "Използвайте копиране за смяна на редактора." },
        { status: 400 },
      );
    const layoutError = validateSavedLayout(body.layout);
    if (layoutError)
      return NextResponse.json({ error: layoutError }, { status: 400 });
    data.layout = body.layout as Prisma.InputJsonValue;
  }

  const version2 = isV2(existing.layout);
  // V2 metadata updates use the same revision guard as drawing updates.
  if (
    version2 &&
    (typeof body.expectedUpdatedAt !== "string" ||
      !Number.isFinite(Date.parse(body.expectedUpdatedAt)))
  )
    return NextResponse.json(
      { error: "Липсва версията на записа." },
      { status: 400 },
    );
  const plan = await prisma.$transaction(async (tx) => {
    const changed = await tx.trainingPlan.updateMany({
      where: {
        id: planId,
        clubId: id,
        ...(version2
          ? { updatedAt: new Date(body.expectedUpdatedAt as string) }
          : {}),
      },
      data: {
        ...data,
        updatedAt: new Date(
          Math.max(Date.now(), existing.updatedAt.getTime() + 1),
        ),
      },
    });
    if (changed.count !== 1) return null;
    return tx.trainingPlan.findUnique({
      where: { id: planId },
      select: {
        id: true,
        title: true,
        description: true,
        categoryId: true,
        layout: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });
  if (!plan)
    return NextResponse.json(
      {
        error:
          "Планът е променен в друг прозорец. Запазете копие или заредете последния запис.",
      },
      { status: 409 },
    );

  return NextResponse.json({
    plan: { ...plan, layoutVersion: layoutVersion(plan.layout) },
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; planId: string }> },
) {
  const { id, planId } = await params;
  const session = await authorizeTraining(request, id);
  if (session instanceof NextResponse) return session;
  if (!UUID_RE.test(id) || !UUID_RE.test(planId)) {
    return NextResponse.json(
      { error: "Невалиден идентификатор." },
      { status: 400 },
    );
  }

  const existing = await prisma.trainingPlan.findUnique({
    where: { id: planId },
    select: { id: true, clubId: true, layout: true, updatedAt: true },
  });
  if (!existing || existing.clubId !== id)
    return NextResponse.json(
      { error: "Планът не е намерен." },
      { status: 404 },
    );

  await prisma.trainingPlan.delete({ where: { id: planId } });

  return NextResponse.json({ success: true });
}
