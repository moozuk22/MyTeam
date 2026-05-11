import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { verifyAdminToken } from "@/lib/adminAuth";
import { DEFAULT_LAYOUT, validateLayout } from "@/lib/trainingPlans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function verifySession(request: NextRequest) {
  const token = request.cookies.get("admin_session")?.value;
  return token ? await verifyAdminToken(token) : null;
}

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
  const session = await verifySession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid club id" }, { status: 400 });

  const plans = await prisma.trainingPlan.findMany({
    where: { clubId: id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      updatedAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ plans });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await verifySession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid club id" }, { status: 400 });

  const club = await prisma.club.findUnique({ where: { id }, select: { id: true } });
  if (!club) return NextResponse.json({ error: "Club not found" }, { status: 404 });

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const title = normalizeTitle(body.title);
  if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
  if (title.length > 200) return NextResponse.json({ error: "Title is too long" }, { status: 400 });

  const description = normalizeDescription(body.description);
  if (description && description.length > 1000) {
    return NextResponse.json({ error: "Description is too long" }, { status: 400 });
  }

  const layout = Object.hasOwn(body, "layout") ? body.layout : DEFAULT_LAYOUT;
  const layoutError = validateLayout(layout);
  if (layoutError) return NextResponse.json({ error: layoutError }, { status: 400 });

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
    },
  });

  return NextResponse.json({ plan }, { status: 201 });
}
