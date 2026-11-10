import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { authorizeTraining, UUID_RE } from "@/lib/exercise/access";
import {
  convertLegacy,
  EMPTY_EXERCISE,
  isV2,
  layoutVersion,
  validateSavedLayout,
} from "@/lib/exercise/model";
import { listTrainingPlans } from "@/lib/exercise/queries";
import type { PlanLayout } from "@/lib/trainingPlans";
import { DEFAULT_LAYOUT } from "@/lib/trainingPlans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeTitle(raw: unknown) {
  return String(raw ?? "").trim();
}

function normalizeDescription(raw: unknown) {
  const value = String(raw ?? "").trim();
  return value ? value : null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await authorizeTraining(request, id);
  if (session instanceof NextResponse) return session;
  if (!UUID_RE.test(id))
    return NextResponse.json({ error: "Невалиден клуб." }, { status: 400 });

  const cursor = request.nextUrl.searchParams.get("cursor");
  if (cursor && !UUID_RE.test(cursor))
    return NextResponse.json({ error: "Невалидна страница." }, { status: 400 });
  return NextResponse.json(await listTrainingPlans(id, cursor));
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await authorizeTraining(request, id);
  if (session instanceof NextResponse) return session;
  if (!UUID_RE.test(id))
    return NextResponse.json({ error: "Невалиден клуб." }, { status: 400 });

  const club = await prisma.club.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!club)
    return NextResponse.json(
      { error: "Клубът не е намерен." },
      { status: 404 },
    );

  const rawBody: unknown = await request.json().catch(() => null);
  if (!rawBody || typeof rawBody !== "object" || Array.isArray(rawBody))
    return NextResponse.json({ error: "Невалидна заявка." }, { status: 400 });
  const body = rawBody as Record<string, unknown>;
  const title = normalizeTitle(body.title);
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

  const description = normalizeDescription(body.description);
  if (description && description.length > 1000) {
    return NextResponse.json(
      { error: "Описанието е твърде дълго." },
      { status: 400 },
    );
  }

  let layout = Object.hasOwn(body, "layout")
    ? body.layout
    : body.editorVersion === 2
      ? EMPTY_EXERCISE
      : DEFAULT_LAYOUT;
  if (body.sourcePlanId !== undefined) {
    if (
      typeof body.sourcePlanId !== "string" ||
      !UUID_RE.test(body.sourcePlanId)
    )
      return NextResponse.json(
        { error: "Невалиден източник." },
        { status: 400 },
      );
    const source = await prisma.trainingPlan.findFirst({
      where: { id: body.sourcePlanId, clubId: id },
      select: { layout: true },
    });
    if (!source)
      return NextResponse.json(
        { error: "Изходният план не е намерен." },
        { status: 404 },
      );
    const sourceError = validateSavedLayout(source.layout);
    if (sourceError)
      return NextResponse.json({ error: sourceError }, { status: 400 });
    try {
      layout =
        body.editorVersion === 2 && !isV2(source.layout)
          ? convertLegacy(source.layout as unknown as PlanLayout)
          : source.layout;
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Грешка при преобразуване.",
        },
        { status: 400 },
      );
    }
  }
  const layoutError = validateSavedLayout(layout);
  if (layoutError)
    return NextResponse.json({ error: layoutError }, { status: 400 });

  const plan = await prisma.trainingPlan.create({
    data: {
      clubId: id,
      title,
      description,
      layout: layout as Prisma.InputJsonValue,
      createdByUserId: session.sub,
      updatedByUserId: session.sub,
    },
    select: {
      id: true,
      title: true,
      description: true,
      updatedAt: true,
      createdAt: true,
      layout: true,
    },
  });

  const { layout: savedLayout, ...summary } = plan;
  return NextResponse.json(
    { plan: { ...summary, layoutVersion: layoutVersion(savedLayout) } },
    { status: 201 },
  );
}
