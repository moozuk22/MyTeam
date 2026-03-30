import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { publishMemberUpdated } from "@/lib/memberEvents";
import { verifyAdminToken } from "@/lib/adminAuth";
import {
  getConfiguredTrainingDates,
  getWeekdayMondayFirst,
  isIsoDate,
  isoDateToUtcMidnight,
  utcDateToIsoDate,
} from "@/lib/training";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FIXED_TIME_ZONE = "Europe/Sofia";
const TRAINING_SELECTION_WINDOW_DAYS = 30;

function isTransientPrismaConnectionError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }
  const maybeError = error as { code?: unknown };
  const code = typeof maybeError.code === "string" ? maybeError.code : "";
  return code === "P1001" || code === "P2024";
}

function parseOptionalTeamGroup(raw: unknown): number | null {
  if (raw === null || raw === undefined || String(raw).trim() === "") {
    return null;
  }
  const parsed = Number.parseInt(String(raw).trim(), 10);
  if (!Number.isInteger(parsed)) {
    throw new Error("Invalid teamGroup");
  }
  return parsed;
}

function parseOptionalTrainingGroupId(raw: unknown): string | null {
  if (raw === null || raw === undefined) {
    return null;
  }
  const value = String(raw).trim();
  return value ? value : null;
}

async function verifySession(request: NextRequest) {
  const token = request.cookies.get("admin_session")?.value;
  const session = token ? await verifyAdminToken(token) : null;
  return session;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await verifySession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const requestedDate = request.nextUrl.searchParams.get("date")?.trim() ?? "";
  let teamGroup: number | null = null;
  let trainingGroupId: string | null = null;
  try {
    teamGroup = parseOptionalTeamGroup(request.nextUrl.searchParams.get("teamGroup"));
    trainingGroupId = parseOptionalTrainingGroupId(request.nextUrl.searchParams.get("trainingGroupId"));
  } catch {
    return NextResponse.json({ error: "Invalid teamGroup or trainingGroupId query parameter" }, { status: 400 });
  }
  if (teamGroup !== null && trainingGroupId) {
    return NextResponse.json({ error: "Use either teamGroup or trainingGroupId." }, { status: 400 });
  }
  if (requestedDate && !isIsoDate(requestedDate)) {
    return NextResponse.json({ error: "Invalid date query parameter" }, { status: 400 });
  }

  try {
    const club = await prisma.club.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      trainingDates: true,
      trainingWeekdays: true,
      trainingWindowDays: true,
    },
  });
  if (!club) {
    return NextResponse.json({ error: "Club not found" }, { status: 404 });
  }

  const trainingGroup = trainingGroupId
    ? await prisma.clubTrainingScheduleGroup.findFirst({
        where: {
          id: trainingGroupId,
          clubId: id,
        },
        select: {
          id: true,
          teamGroups: true,
          trainingDates: true,
          trainingWeekdays: true,
          trainingWindowDays: true,
        },
      })
    : null;
  if (trainingGroupId && !trainingGroup) {
    return NextResponse.json({ error: "Training group not found" }, { status: 404 });
  }

  const groupSchedule = teamGroup === null
    ? null
    : await prisma.clubTrainingGroupSchedule.findUnique({
        where: {
          clubId_teamGroup: {
            clubId: id,
            teamGroup,
          },
        },
        select: {
          trainingDates: true,
          trainingWeekdays: true,
          trainingWindowDays: true,
        },
      });

  const trainingGroupOverride = !trainingGroup && teamGroup !== null
    ? await prisma.clubTrainingScheduleGroup.findFirst({
        where: {
          clubId: id,
          teamGroups: {
            has: teamGroup,
          },
          trainingDates: {
            isEmpty: false,
          },
        },
        orderBy: {
          updatedAt: "desc",
        },
        select: {
          trainingDates: true,
          trainingWeekdays: true,
          trainingWindowDays: true,
        },
      })
    : null;

  const upcomingDates = getConfiguredTrainingDates({
    trainingDates:
      trainingGroup
        ? trainingGroup.trainingDates ?? []
        : trainingGroupOverride?.trainingDates ?? groupSchedule?.trainingDates ?? club.trainingDates ?? [],
    weekdays:
      trainingGroup
        ? trainingGroup.trainingWeekdays ?? []
        : trainingGroupOverride?.trainingWeekdays ?? groupSchedule?.trainingWeekdays ?? club.trainingWeekdays ?? [],
    windowDays:
      trainingGroup?.trainingWindowDays ??
      trainingGroupOverride?.trainingWindowDays ??
      groupSchedule?.trainingWindowDays ??
      club.trainingWindowDays ??
      TRAINING_SELECTION_WINDOW_DAYS,
    timeZone: FIXED_TIME_ZONE,
    maxDays: TRAINING_SELECTION_WINDOW_DAYS,
  });
  const trainingDate =
    requestedDate && upcomingDates.includes(requestedDate)
      ? requestedDate
      : upcomingDates[0] || "";
  if (!trainingDate) {
    return NextResponse.json({
      clubId: club.id,
      clubName: club.name,
      trainingDate: "",
      weekday: 0,
      note: "",
      stats: {
        total: 0,
        optedOut: 0,
        attending: 0,
      },
      players: [],
      upcomingDates: [],
      teamGroup,
      trainingGroupId: trainingGroup?.id ?? null,
    });
  }

  const players = await prisma.player.findMany({
    where: {
      clubId: id,
      isActive: true,
      ...(trainingGroup ? { teamGroup: { in: trainingGroup.teamGroups } } : {}),
      ...(teamGroup !== null ? { teamGroup } : {}),
    },
    select: {
      id: true,
      fullName: true,
      teamGroup: true,
      cards: {
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { cardCode: true },
      },
    },
    orderBy: { fullName: "asc" },
  });
  const playerIds = players.map((player) => player.id);
  const trainingDateAsDate = isoDateToUtcMidnight(trainingDate);
  const upcomingDatesAsDate = upcomingDates.map((date) => isoDateToUtcMidnight(date));

  const [allOptOuts, note] = await Promise.all([
    playerIds.length > 0 && upcomingDatesAsDate.length > 0
      ? prisma.trainingOptOut.findMany({
          where: {
            playerId: {
              in: playerIds,
            },
            trainingDate: {
              in: upcomingDatesAsDate,
            },
          },
          select: {
            playerId: true,
            trainingDate: true,
          },
        })
      : Promise.resolve([]),
    prisma.trainingNote.findUnique({
      where: {
        clubId_trainingDate: {
          clubId: id,
          trainingDate: trainingDateAsDate,
        },
      },
      select: {
        note: true,
      },
    }),
  ]);

  const optedOutCountByDate = new Map<string, number>();
  const selectedDateOptedOutSet = new Set<string>();
  for (const item of allOptOuts) {
    const dateIso = utcDateToIsoDate(item.trainingDate);
    optedOutCountByDate.set(dateIso, (optedOutCountByDate.get(dateIso) ?? 0) + 1);
    if (dateIso === trainingDate) {
      selectedDateOptedOutSet.add(item.playerId);
    }
  }

  const playersWithStatus = players.map((player) => ({
    id: player.id,
    fullName: player.fullName,
    teamGroup: player.teamGroup,
    cardCode: player.cards[0]?.cardCode ?? null,
    optedOut: selectedDateOptedOutSet.has(player.id),
  }));
  const totalPlayers = playersWithStatus.length;

    return NextResponse.json({
      clubId: club.id,
      clubName: club.name,
      teamGroup,
      trainingGroupId: trainingGroup?.id ?? null,
      trainingDate,
      weekday: getWeekdayMondayFirst(trainingDate, FIXED_TIME_ZONE),
      note: note?.note ?? "",
      stats: {
        total: totalPlayers,
        optedOut: playersWithStatus.filter((player) => player.optedOut).length,
        attending: playersWithStatus.filter((player) => !player.optedOut).length,
      },
      players: playersWithStatus,
      upcomingDates: upcomingDates.map((date) => ({
        date,
        weekday: getWeekdayMondayFirst(date, FIXED_TIME_ZONE),
        stats: {
          total: totalPlayers,
          optedOut: optedOutCountByDate.get(date) ?? 0,
          attending: Math.max(0, totalPlayers - (optedOutCountByDate.get(date) ?? 0)),
        },
      })),
    });
  } catch (error) {
    console.error("Training attendance GET error:", error);
    if (isTransientPrismaConnectionError(error)) {
      return NextResponse.json(
        { error: "Database temporarily unavailable. Please retry in a few seconds." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await verifySession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const trainingDate = String((body as { trainingDate?: unknown }).trainingDate ?? "").trim();
  const noteRaw = (body as { note?: unknown }).note;
  const note = noteRaw === null || noteRaw === undefined ? "" : String(noteRaw).trim();
  let teamGroup: number | null = null;
  let trainingGroupId: string | null = null;
  try {
    teamGroup = parseOptionalTeamGroup((body as { teamGroup?: unknown }).teamGroup);
    trainingGroupId = parseOptionalTrainingGroupId((body as { trainingGroupId?: unknown }).trainingGroupId);
  } catch {
    return NextResponse.json({ error: "Invalid teamGroup or trainingGroupId" }, { status: 400 });
  }
  if (teamGroup !== null && trainingGroupId) {
    return NextResponse.json({ error: "Use either teamGroup or trainingGroupId." }, { status: 400 });
  }

  if (!isIsoDate(trainingDate)) {
    return NextResponse.json({ error: "Invalid trainingDate" }, { status: 400 });
  }

  try {
    const club = await prisma.club.findUnique({
    where: { id },
    select: {
      id: true,
      trainingDates: true,
      trainingWeekdays: true,
      trainingWindowDays: true,
    },
  });
  if (!club) {
    return NextResponse.json({ error: "Club not found" }, { status: 404 });
  }

  const trainingGroup = trainingGroupId
    ? await prisma.clubTrainingScheduleGroup.findFirst({
        where: {
          id: trainingGroupId,
          clubId: id,
        },
        select: {
          id: true,
          teamGroups: true,
          trainingDates: true,
          trainingWeekdays: true,
          trainingWindowDays: true,
        },
      })
    : null;
  if (trainingGroupId && !trainingGroup) {
    return NextResponse.json({ error: "Training group not found" }, { status: 404 });
  }

  const groupSchedule = teamGroup === null
    ? null
    : await prisma.clubTrainingGroupSchedule.findUnique({
        where: {
          clubId_teamGroup: {
            clubId: id,
            teamGroup,
          },
        },
        select: {
          trainingDates: true,
          trainingWeekdays: true,
          trainingWindowDays: true,
        },
      });

  const trainingGroupOverride = !trainingGroup && teamGroup !== null
    ? await prisma.clubTrainingScheduleGroup.findFirst({
        where: {
          clubId: id,
          teamGroups: {
            has: teamGroup,
          },
          trainingDates: {
            isEmpty: false,
          },
        },
        orderBy: {
          updatedAt: "desc",
        },
        select: {
          trainingDates: true,
          trainingWeekdays: true,
          trainingWindowDays: true,
        },
      })
    : null;

  const upcomingDates = getConfiguredTrainingDates({
    trainingDates:
      trainingGroup
        ? trainingGroup.trainingDates ?? []
        : trainingGroupOverride?.trainingDates ?? groupSchedule?.trainingDates ?? club.trainingDates ?? [],
    weekdays:
      trainingGroup
        ? trainingGroup.trainingWeekdays ?? []
        : trainingGroupOverride?.trainingWeekdays ?? groupSchedule?.trainingWeekdays ?? club.trainingWeekdays ?? [],
    windowDays:
      trainingGroup?.trainingWindowDays ??
      trainingGroupOverride?.trainingWindowDays ??
      groupSchedule?.trainingWindowDays ??
      club.trainingWindowDays ??
      TRAINING_SELECTION_WINDOW_DAYS,
    timeZone: FIXED_TIME_ZONE,
    maxDays: TRAINING_SELECTION_WINDOW_DAYS,
  });
  if (!upcomingDates.includes(trainingDate)) {
    return NextResponse.json({ error: "Date is outside configured training window" }, { status: 400 });
  }

  const trainingDateAsDate = isoDateToUtcMidnight(trainingDate);
  const affectedPlayers = await prisma.player.findMany({
    where: {
      clubId: id,
      isActive: true,
      ...(trainingGroup ? { teamGroup: { in: trainingGroup.teamGroups } } : {}),
      ...(teamGroup !== null ? { teamGroup } : {}),
    },
    select: {
      cards: {
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { cardCode: true },
      },
    },
  });
  const affectedCardCodes = Array.from(
    new Set(
      affectedPlayers
        .map((player) => player.cards[0]?.cardCode?.trim().toUpperCase() ?? "")
        .filter((cardCode) => cardCode.length > 0),
    ),
  );

  if (!note) {
    await prisma.trainingNote.deleteMany({
      where: {
        clubId: id,
        trainingDate: trainingDateAsDate,
      },
    });
    for (const cardCode of affectedCardCodes) {
      publishMemberUpdated(cardCode, "training-updated");
    }
    return NextResponse.json({
      success: true,
      trainingDate,
      note: "",
    });
  }

  if (note.length > 1000) {
    return NextResponse.json({ error: "Note is too long (max 1000 chars)" }, { status: 400 });
  }

  const saved = await prisma.trainingNote.upsert({
    where: {
      clubId_trainingDate: {
        clubId: id,
        trainingDate: trainingDateAsDate,
      },
    },
    update: {
      note,
      createdByUserId: session.sub,
      updatedAt: new Date(),
    },
    create: {
      clubId: id,
      trainingDate: trainingDateAsDate,
      note,
      createdByUserId: session.sub,
    },
    select: {
      trainingDate: true,
      note: true,
    },
  });
  for (const cardCode of affectedCardCodes) {
    publishMemberUpdated(cardCode, "training-updated");
  }

    return NextResponse.json({
      success: true,
      trainingDate: utcDateToIsoDate(saved.trainingDate),
      note: saved.note ?? "",
    });
  } catch (error) {
    console.error("Training attendance PUT error:", error);
    if (isTransientPrismaConnectionError(error)) {
      return NextResponse.json(
        { error: "Database temporarily unavailable. Please retry in a few seconds." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
