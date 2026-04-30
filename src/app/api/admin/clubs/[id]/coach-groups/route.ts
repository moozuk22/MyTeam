import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyAdminToken } from "@/lib/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function verifySession(request: NextRequest) {
  const token = request.cookies.get("admin_session")?.value;
  return token ? await verifyAdminToken(token) : null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await verifySession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: clubId } = await params;
  if (!UUID_REGEX.test(clubId)) {
    return NextResponse.json({ error: "Club not found" }, { status: 404 });
  }

  const clubExists = await prisma.club.findUnique({ where: { id: clubId }, select: { id: true } });
  if (!clubExists) {
    return NextResponse.json({ error: "Club not found" }, { status: 404 });
  }

  try {
    const groups = await prisma.coachGroup.findMany({
      where: { clubId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { players: true } },
      },
    });

    return NextResponse.json(
      groups.map((g) => ({
        id: g.id,
        name: g.name,
        createdAt: g.createdAt,
        updatedAt: g.updatedAt,
        playerCount: g._count.players,
      })),
    );
  } catch (error) {
    console.error("Coach groups GET error:", error);
    return NextResponse.json({ error: "Failed to fetch coach groups" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await verifySession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: clubId } = await params;
  if (!UUID_REGEX.test(clubId)) {
    return NextResponse.json({ error: "Club not found" }, { status: 404 });
  }

  const clubExists = await prisma.club.findUnique({ where: { id: clubId }, select: { id: true } });
  if (!clubExists) {
    return NextResponse.json({ error: "Club not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = String((body as { name?: unknown }).name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (name.length > 100) {
    return NextResponse.json({ error: "name must be at most 100 characters" }, { status: 400 });
  }

  try {
    const group = await prisma.coachGroup.create({
      data: { clubId, name },
      select: { id: true, name: true, createdAt: true, updatedAt: true },
    });

    return NextResponse.json({ ...group, playerCount: 0 }, { status: 201 });
  } catch (error) {
    console.error("Coach group create error:", error);
    return NextResponse.json({ error: "Failed to create coach group" }, { status: 500 });
  }
}
