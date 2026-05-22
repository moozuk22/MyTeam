import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyAdminToken } from "@/lib/adminAuth";
import { isIsoDate, isoDateToUtcMidnight } from "@/lib/training";
import { getTrainingSessionScopeKey } from "@/lib/trainingSessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function verifySession(request: NextRequest) {
  const token = request.cookies.get("admin_session")?.value;
  return token ? await verifyAdminToken(token) : null;
}

function scopeTypeFromKey(scopeKey: string): string {
  if (scopeKey === "club") return "club";
  if (scopeKey.startsWith("team_group:")) return "teamGroup";
  if (scopeKey.startsWith("training_group:")) return "trainingGroup";
  if (scopeKey.startsWith("custom_group:")) return "customGroup";
  if (scopeKey.startsWith("coach_group:")) return "coachGroup";
  return "club";
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await verifySession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: clubId } = await params;
  const body = await request.json().catch(() => ({}));
  const date = String((body as { date?: unknown }).date ?? "").trim();
  const rawStatus = String((body as { status?: unknown }).status ?? "").trim();

  if (!isIsoDate(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }
  if (rawStatus !== "scheduled" && rawStatus !== "cancelled") {
    return NextResponse.json({ error: "status must be 'scheduled' or 'cancelled'" }, { status: 400 });
  }

  const teamGroupRaw = (body as { teamGroup?: unknown }).teamGroup;
  const trainingGroupId = String((body as { trainingGroupId?: unknown }).trainingGroupId ?? "").trim() || null;
  const customTrainingGroupId = String((body as { customTrainingGroupId?: unknown }).customTrainingGroupId ?? "").trim() || null;
  const teamGroup = teamGroupRaw !== undefined && teamGroupRaw !== null && String(teamGroupRaw).trim() !== ""
    ? Number.parseInt(String(teamGroupRaw), 10)
    : null;

  const scopeKey = getTrainingSessionScopeKey(
    customTrainingGroupId
      ? { type: "customGroup", id: customTrainingGroupId }
      : trainingGroupId
        ? { type: "trainingGroup", id: trainingGroupId }
        : teamGroup !== null && Number.isInteger(teamGroup)
          ? { type: "teamGroup", teamGroup }
          : { type: "club" },
  );

  try {
    const club = await prisma.club.findUnique({ where: { id: clubId }, select: { id: true } });
    if (!club) {
      return NextResponse.json({ error: "Club not found" }, { status: 404 });
    }

    const trainingDate = isoDateToUtcMidnight(date);
    await prisma.trainingSession.upsert({
      where: { clubId_scopeKey_trainingDate: { clubId, scopeKey, trainingDate } },
      update: { status: rawStatus },
      create: {
        clubId,
        scopeType: scopeTypeFromKey(scopeKey),
        scopeKey,
        trainingDate,
        status: rawStatus,
      },
    });

    return NextResponse.json({ success: true, status: rawStatus });
  } catch (error) {
    console.error("Training session status PATCH error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
