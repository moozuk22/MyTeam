import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyAdminToken } from "@/lib/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = request.cookies.get("admin_session")?.value;
  if (!token || !(await verifyAdminToken(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rawCoachGroupId = (body as { coachGroupId?: unknown }).coachGroupId;
  const coachGroupId =
    rawCoachGroupId === null || rawCoachGroupId === undefined
      ? null
      : String(rawCoachGroupId).trim() || null;

  if (coachGroupId !== null && !UUID_REGEX.test(coachGroupId)) {
    return NextResponse.json({ error: "Invalid coachGroupId" }, { status: 400 });
  }

  const player = await prisma.player.findUnique({
    where: { id },
    select: { id: true, clubId: true },
  });

  if (!player) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  if (coachGroupId !== null) {
    const groupExists = await prisma.coachGroup.findFirst({
      where: { id: coachGroupId, clubId: player.clubId },
      select: { id: true },
    });
    if (!groupExists) {
      return NextResponse.json({ error: "Coach group not found" }, { status: 404 });
    }
  }

  await prisma.player.update({
    where: { id },
    data: { coachGroupId },
  });

  return NextResponse.json({ success: true, id, coachGroupId });
}
