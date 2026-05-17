import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyAdminToken } from "@/lib/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getPlayerIdsInScope(clubId: string, scopeKey: string): Promise<string[]> {
  if (scopeKey.startsWith("team_group:")) {
    const tg = parseInt(scopeKey.slice("team_group:".length), 10);
    const players = await prisma.player.findMany({
      where: { clubId, teamGroup: tg, isActive: true },
      select: { id: true },
    });
    return players.map((p) => p.id);
  }
  if (scopeKey.startsWith("custom_group:")) {
    const groupId = scopeKey.slice("custom_group:".length);
    const members = await prisma.clubCustomTrainingGroupPlayer.findMany({
      where: { groupId },
      select: { playerId: true, player: { select: { isActive: true } } },
    });
    return members.filter((m) => m.player.isActive).map((m) => m.playerId);
  }
  if (scopeKey.startsWith("coach_group:")) {
    const groupId = scopeKey.slice("coach_group:".length);
    const players = await prisma.player.findMany({
      where: { coachGroups: { some: { id: groupId } }, clubId, isActive: true },
      select: { id: true },
    });
    return players.map((p) => p.id);
  }
  return [];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; eventId: string }> },
) {
  const token = request.cookies.get("admin_session")?.value;
  const session = token ? await verifyAdminToken(token) : null;
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, eventId } = await params;

  try {
    const event = await prisma.limitedTrainingEvent.findFirst({
      where: { id: eventId, clubId: id },
      select: {
        id: true,
        scopeKey: true,
        scopeId: true,
        teamGroup: true,
        trainingDate: true,
        maxSpots: true,
        registrations: {
          select: {
            id: true,
            playerId: true,
            registeredAt: true,
            player: { select: { fullName: true } },
          },
          orderBy: { registeredAt: "asc" },
        },
      },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const registrations = event.registrations.map((r, idx) => ({
      position: idx + 1,
      playerId: r.playerId,
      fullName: r.player.fullName,
      registeredAt: r.registeredAt.toISOString(),
      isConfirmed: idx + 1 <= event.maxSpots,
    }));

    return NextResponse.json({
      event: {
        id: event.id,
        scopeKey: event.scopeKey,
        scopeId: event.scopeId,
        teamGroup: event.teamGroup,
        trainingDate: event.trainingDate.toISOString().slice(0, 10),
        maxSpots: event.maxSpots,
      },
      registrations,
      spotsRemaining: Math.max(0, event.maxSpots - registrations.length),
    });
  } catch (error) {
    console.error("Limited training event GET error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; eventId: string }> },
) {
  const token = request.cookies.get("admin_session")?.value;
  const session = token ? await verifyAdminToken(token) : null;
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, eventId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const maxSpots = typeof b.maxSpots === "number" ? b.maxSpots : Number(b.maxSpots);

  if (!Number.isInteger(maxSpots) || maxSpots < 1 || maxSpots > 200) {
    return NextResponse.json({ error: "maxSpots must be an integer between 1 and 200" }, { status: 400 });
  }

  try {
    const existing = await prisma.limitedTrainingEvent.findFirst({
      where: { id: eventId, clubId: id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const updated = await prisma.limitedTrainingEvent.update({
      where: { id: eventId },
      data: { maxSpots },
      select: {
        id: true,
        scopeKey: true,
        trainingDate: true,
        maxSpots: true,
        _count: { select: { registrations: true } },
      },
    });

    return NextResponse.json({
      event: {
        id: updated.id,
        scopeKey: updated.scopeKey,
        trainingDate: updated.trainingDate.toISOString().slice(0, 10),
        maxSpots: updated.maxSpots,
        registeredCount: updated._count.registrations,
      },
    });
  } catch (error) {
    console.error("Limited training event PATCH error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; eventId: string }> },
) {
  const token = request.cookies.get("admin_session")?.value;
  const session = token ? await verifyAdminToken(token) : null;
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, eventId } = await params;

  try {
    const existing = await prisma.limitedTrainingEvent.findFirst({
      where: { id: eventId, clubId: id },
      select: { id: true, scopeKey: true, trainingDate: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Clean up auto-created opt-outs before deleting the event
    try {
      const playerIds = await getPlayerIdsInScope(id, existing.scopeKey);
      if (playerIds.length > 0) {
        await prisma.trainingOptOut.deleteMany({
          where: {
            playerId: { in: playerIds },
            trainingDate: existing.trainingDate,
            reasonCode: "limited_event",
          },
        });
      }
    } catch (cleanupError) {
      console.error("Limited event opt-out cleanup error:", cleanupError);
    }

    await prisma.limitedTrainingEvent.delete({ where: { id: eventId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Limited training event DELETE error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
