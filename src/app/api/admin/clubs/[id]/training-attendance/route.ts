import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
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
  if (requestedDate && !isIsoDate(requestedDate)) {
    return NextResponse.json({ error: "Invalid date query parameter" }, { status: 400 });
  }

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

  const upcomingDates = getConfiguredTrainingDates({
    trainingDates: club.trainingDates ?? [],
    weekdays: club.trainingWeekdays ?? [],
    windowDays: club.trainingWindowDays ?? TRAINING_SELECTION_WINDOW_DAYS,
    timeZone: FIXED_TIME_ZONE,
    maxDays: TRAINING_SELECTION_WINDOW_DAYS,
  });
  const trainingDate = requestedDate || upcomingDates[0] || "";
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
    });
  }
  if (requestedDate && !upcomingDates.includes(trainingDate)) {
    return NextResponse.json({ error: "Date is outside configured training window" }, { status: 400 });
  }

  const players = await prisma.player.findMany({
    where: {
      clubId: id,
      isActive: true,
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

  if (!isIsoDate(trainingDate)) {
    return NextResponse.json({ error: "Invalid trainingDate" }, { status: 400 });
  }

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

  const upcomingDates = getConfiguredTrainingDates({
    trainingDates: club.trainingDates ?? [],
    weekdays: club.trainingWeekdays ?? [],
    windowDays: club.trainingWindowDays ?? TRAINING_SELECTION_WINDOW_DAYS,
    timeZone: FIXED_TIME_ZONE,
    maxDays: TRAINING_SELECTION_WINDOW_DAYS,
  });
  if (!upcomingDates.includes(trainingDate)) {
    return NextResponse.json({ error: "Date is outside configured training window" }, { status: 400 });
  }

  const trainingDateAsDate = isoDateToUtcMidnight(trainingDate);
  if (!note) {
    await prisma.trainingNote.deleteMany({
      where: {
        clubId: id,
        trainingDate: trainingDateAsDate,
      },
    });
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

  return NextResponse.json({
    success: true,
    trainingDate: utcDateToIsoDate(saved.trainingDate),
    note: saved.note ?? "",
  });
}
