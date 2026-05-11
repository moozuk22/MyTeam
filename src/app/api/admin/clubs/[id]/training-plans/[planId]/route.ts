import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { verifyAdminToken } from "@/lib/adminAuth";
import { validateLayout } from "@/lib/trainingPlans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function verifySession(request: NextRequest) {
  const token = request.cookies.get("admin_session")?.value;
  return token ? await verifyAdminToken(token) : null;
}

function normalizeDescription(raw: unknown) {
  const value = String(raw ?? "").trim();
  return value ? value : null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; planId: string }> },
) {
  const session = await verifySession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, planId } = await params;
  if (!UUID_RE.test(id) || !UUID_RE.test(planId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const plan = await prisma.trainingPlan.findUnique({
    where: { id: planId },
    select: {
      id: true,
      clubId: true,
      title: true,
      description: true,
      layout: true,
      updatedAt: true,
      createdAt: true,
    },
  });
  if (!plan || plan.clubId !== id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ plan });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; planId: string }> },
) {
  const session = await verifySession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, planId } = await params;
  if (!UUID_RE.test(id) || !UUID_RE.test(planId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const existing = await prisma.trainingPlan.findUnique({
    where: { id: planId },
    select: { id: true, clubId: true },
  });
  if (!existing || existing.clubId !== id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const data: {
    title?: string;
    description?: string | null;
    layout?: Prisma.InputJsonValue;
    updatedByUserId: string;
  } = {
    updatedByUserId: session.sub,
  };

  if (Object.hasOwn(body, "title")) {
    const title = String(body.title ?? "").trim();
    if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
    if (title.length > 200) return NextResponse.json({ error: "Title is too long" }, { status: 400 });
    data.title = title;
  }

  if (Object.hasOwn(body, "description")) {
    const description = normalizeDescription(body.description);
    if (description && description.length > 1000) {
      return NextResponse.json({ error: "Description is too long" }, { status: 400 });
    }
    data.description = description;
  }

  if (Object.hasOwn(body, "layout")) {
    const layoutError = validateLayout(body.layout);
    if (layoutError) return NextResponse.json({ error: layoutError }, { status: 400 });
    data.layout = body.layout as Prisma.InputJsonValue;
  }

  const plan = await prisma.trainingPlan.update({
    where: { id: planId },
    data,
    select: {
      id: true,
      title: true,
      description: true,
      layout: true,
      updatedAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ plan });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; planId: string }> },
) {
  const session = await verifySession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, planId } = await params;
  if (!UUID_RE.test(id) || !UUID_RE.test(planId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const existing = await prisma.trainingPlan.findUnique({
    where: { id: planId },
    select: { id: true, clubId: true },
  });
  if (!existing || existing.clubId !== id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.trainingPlan.delete({ where: { id: planId } });

  return NextResponse.json({ success: true });
}
