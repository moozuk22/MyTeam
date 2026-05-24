import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyAdminToken } from "@/lib/adminAuth";
import { isIsoDate, isValidTrainingTime } from "@/lib/training";
import { checkAwayMatchTrainingConflict } from "@/lib/trainingFieldConflicts";
import {
  hasMatchScheduleChanged,
  sendMatchScheduleNotifications,
} from "@/lib/push/matchScheduleNotifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function verifySession(request: NextRequest) {
  const token = request.cookies.get("admin_session")?.value;
  return token ? await verifyAdminToken(token) : null;
}

function normalizeTeamGroups(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const unique = Array.from(
    new Set(
      raw
        .map((v) => Number.parseInt(String(v ?? "").trim(), 10))
        .filter((v) => Number.isInteger(v) && v >= 0),
    ),
  );
  return unique.sort((a, b) => a - b);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; matchId: string }> },
) {
  const session = await verifySession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, matchId } = await params;

  const existing = await prisma.clubMatch.findFirst({
    where: { id: matchId, clubId: id },
    select: {
      id: true,
      customGroupId: true,
      opponent: true,
      location: true,
      matchDate: true,
      matchTime: true,
      durationMinutes: true,
      isHome: true,
      teamGroups: true,
    },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const update: Record<string, unknown> = {};

  if (Object.hasOwn(body, "opponent")) {
    const opponent = String(body.opponent ?? "").trim();
    if (opponent.length > 200) return NextResponse.json({ error: "Съперник е твърде дълъг." }, { status: 400 });
    update.opponent = opponent;
  }
  if (Object.hasOwn(body, "location")) {
    const location = String(body.location ?? "").trim();
    if (!location) return NextResponse.json({ error: "Място е задължително." }, { status: 400 });
    if (location.length > 200) return NextResponse.json({ error: "Място е твърде дълго." }, { status: 400 });
    update.location = location;
  }
  if (Object.hasOwn(body, "matchDate")) {
    const matchDate = String(body.matchDate ?? "").trim();
    if (!isIsoDate(matchDate)) return NextResponse.json({ error: "Невалидна дата." }, { status: 400 });
    update.matchDate = matchDate;
  }
  if (Object.hasOwn(body, "matchTime")) {
    const matchTime = String(body.matchTime ?? "").trim();
    if (!isValidTrainingTime(matchTime)) return NextResponse.json({ error: "Невалиден час." }, { status: 400 });
    update.matchTime = matchTime;
  }
  if (Object.hasOwn(body, "durationMinutes")) {
    const raw = Number.parseInt(String(body.durationMinutes ?? "").trim(), 10);
    if (!Number.isInteger(raw) || raw < 1 || raw > 1440) return NextResponse.json({ error: "Невалидна продължителност." }, { status: 400 });
    update.durationMinutes = raw;
  }
  if (Object.hasOwn(body, "isHome")) {
    update.isHome = Boolean(body.isHome);
  }
  if (Object.hasOwn(body, "teamGroups")) {
    update.teamGroups = normalizeTeamGroups(body.teamGroups);
  }
  if (Object.hasOwn(body, "customGroupId")) {
    const raw = typeof body.customGroupId === "string" ? body.customGroupId.trim() : null;
    update.customGroupId = raw || null;
  }

  let matchConflictWarning: string | null = null;
  const finalDate = (update.matchDate as string | undefined) ?? existing.matchDate;
  const finalTime = (update.matchTime as string | undefined) ?? existing.matchTime;
  const finalDuration = (update.durationMinutes as number | undefined) ?? existing.durationMinutes;
  const finalTeamGroups = (update.teamGroups as number[] | undefined) ?? existing.teamGroups;
  const finalIsHome = (update.isHome as boolean | undefined) ?? existing.isHome;
  const conflict = await checkAwayMatchTrainingConflict({ clubId: id, matchDate: finalDate, matchTime: finalTime, durationMinutes: finalDuration, teamGroups: finalTeamGroups, isHome: finalIsHome, excludeMatchId: matchId });
  if (conflict.blocking) return NextResponse.json({ error: conflict.blocking }, { status: 400 });
  matchConflictWarning = conflict.warning;

  const match = await prisma.clubMatch.update({
    where: { id: matchId },
    data: update,
    select: { id: true, customGroupId: true, opponent: true, location: true, matchDate: true, matchTime: true, durationMinutes: true, isHome: true, teamGroups: true },
  });

  let notifications = null;
  if (hasMatchScheduleChanged(existing, match)) {
    try {
      notifications = await sendMatchScheduleNotifications({
        clubId: id,
        action: "updated",
        previousMatch: existing,
        match,
      });
    } catch (error) {
      console.error("Match schedule update notifications failed:", error);
    }
  }

  return NextResponse.json(matchConflictWarning ? { match, notifications, warning: matchConflictWarning } : { match, notifications });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; matchId: string }> },
) {
  const session = await verifySession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, matchId } = await params;

  const existing = await prisma.clubMatch.findFirst({ where: { id: matchId, clubId: id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.clubMatch.delete({ where: { id: matchId } });

  return NextResponse.json({ success: true });
}
