import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyAdminToken } from "@/lib/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function verifySession(request: NextRequest) {
  const token = request.cookies.get("admin_session")?.value;
  return token ? await verifyAdminToken(token) : null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; groupId: string }> },
) {
  const session = await verifySession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: clubId, groupId } = await params;
  if (!UUID_REGEX.test(groupId)) {
    return NextResponse.json({ error: "Invalid group ID." }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const playerId = String((body as { playerId?: unknown }).playerId ?? "").trim();
  if (!UUID_REGEX.test(playerId)) {
    return NextResponse.json({ error: "Invalid player ID." }, { status: 400 });
  }

  const group = await prisma.clubCustomTrainingGroup.findFirst({
    where: { id: groupId, clubId },
    select: { id: true },
  });
  if (!group) {
    return NextResponse.json({ error: "Group not found." }, { status: 404 });
  }

  const player = await prisma.player.findFirst({
    where: { id: playerId, clubId },
    select: { id: true },
  });
  if (!player) {
    return NextResponse.json({ error: "Player not found." }, { status: 404 });
  }

  await prisma.clubCustomTrainingGroupPlayer.createMany({
    data: [{ groupId, playerId }],
    skipDuplicates: true,
  });

  return NextResponse.json({ success: true });
}
