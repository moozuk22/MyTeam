import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { publishMemberUpdated } from "@/lib/memberEvents";
import { verifyAdminToken } from "@/lib/adminAuth";
import { publishTrainingAttendanceUpdated } from "@/lib/trainingAttendanceEvents";
import { sendPushToMember } from "@/lib/push/service";
import {
  getConfiguredTrainingDates,
  getTodayIsoDateInTimeZone,
  getWeekdayMondayFirst,
  isIsoDate,
  isoDateToUtcMidnight,
  normalizeTrainingTime,
  utcDateToIsoDate,
} from "@/lib/training";
import { getTrainingSessionScopeKey } from "@/lib/trainingSessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FIXED_TIME_ZONE = "Europe/Sofia";
const TRAINING_SELECTION_WINDOW_DAYS = 30;

function safeNormalizeTrainingTime(raw: unknown): string | null {
  try {
    return normalizeTrainingTime(raw);
  } catch {
    return null;
  }
}

function normalizeStoredTrainingDateTimes(raw: unknown, trainingDates: string[]): Record<string, string> {
  if (!raw || typeof raw !== "object") {
    return {};
  }
  const source = raw as Record<string, unknown>;
  const allowedDates = new Set(trainingDates);
  const result: Record<string, string> = {};
  for (const [date, value] of Object.entries(source)) {
    if (!allowedDates.has(date)) {
      continue;
    }
    const normalized = safeNormalizeTrainingTime(value);
    if (normalized) {
      result[date] = normalized;
    }
  }
  return result;
}

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

function parseOptionalCustomTrainingGroupId(raw: unknown): string | null {
  if (raw === null || raw === undefined) {
    return null;
  }
  const value = String(raw).trim();
  return value ? value : null;
}

function parseMonthKey(raw: string | null, fallbackDate: string) {
  const value = raw?.trim() ?? "";
  if (/^\d{4}-\d{2}$/.test(value)) {
    return value;
  }
  return fallbackDate.slice(0, 7);
}

function getDatesInMonth(monthKey: string) {
  const [year, month] = monthKey.split("-").map((value) => Number.parseInt(value, 10));
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return [];
  }
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Array.from({ length: daysInMonth }, (_, index) =>
    `${year}-${String(month).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`,
  );
}

function getConfiguredTrainingDatesForMonth(input: {
  trainingDates?: string[] | null;
  weekdays?: number[] | null;
  monthKey: string;
  timeZone: string;
}): string[] {
  const monthDates = getDatesInMonth(input.monthKey);
  if (monthDates.length === 0) {
    return [];
  }
  const monthDateSet = new Set(monthDates);

  if (Array.isArray(input.trainingDates) && input.trainingDates.length > 0) {
    return Array.from(
      new Set(
        input.trainingDates
          .map((value) => String(value).trim())
          .filter((value) => isIsoDate(value) && monthDateSet.has(value)),
      ),
    ).sort((a, b) => a.localeCompare(b));
  }

  const weekdaysSet = new Set(
    (Array.isArray(input.weekdays) ? input.weekdays : [])
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value >= 1 && value <= 7),
  );
  if (weekdaysSet.size === 0) {
    return [];
  }

  return monthDates.filter((date) => weekdaysSet.has(getWeekdayMondayFirst(date, input.timeZone)));
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
  const requestedMonth = request.nextUrl.searchParams.get("month");
  const monthKey = parseMonthKey(requestedMonth, requestedDate || getTodayIsoDateInTimeZone(FIXED_TIME_ZONE));
  let teamGroup: number | null = null;
  let trainingGroupId: string | null = null;
  let customTrainingGroupId: string | null = null;
  try {
    teamGroup = parseOptionalTeamGroup(request.nextUrl.searchParams.get("teamGroup"));
    trainingGroupId = parseOptionalTrainingGroupId(request.nextUrl.searchParams.get("trainingGroupId"));
    customTrainingGroupId = parseOptionalCustomTrainingGroupId(request.nextUrl.searchParams.get("customTrainingGroupId"));
  } catch {
    return NextResponse.json({ error: "Invalid training group query parameter" }, { status: 400 });
  }
  if ([teamGroup !== null, Boolean(trainingGroupId), Boolean(customTrainingGroupId)].filter(Boolean).length > 1) {
    return NextResponse.json({ error: "Use only one training group filter." }, { status: 400 });
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
      trainingTime: true,
      trainingDateTimes: true,
      trainingWeekdays: true,
      trainingWindowDays: true,
      trainingGroupMode: true,
      trainingDurationMinutes: true,
      trainingFieldId: true,
      trainingFieldPieceIds: true,
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
          trainingTime: true,
          trainingDateTimes: true,
          trainingWeekdays: true,
          trainingWindowDays: true,
          trainingDurationMinutes: true,
          trainingFieldId: true,
          trainingFieldPieceIds: true,
        },
      })
    : null;
  if (trainingGroupId && !trainingGroup) {
    return NextResponse.json({ error: "Training group not found" }, { status: 404 });
  }

  const customTrainingGroup = customTrainingGroupId
    ? await prisma.clubCustomTrainingGroup.findFirst({
        where: {
          id: customTrainingGroupId,
          clubId: id,
        },
        select: {
          id: true,
          trainingDates: true,
          trainingTime: true,
          trainingDateTimes: true,
          trainingWeekdays: true,
          trainingWindowDays: true,
          trainingDurationMinutes: true,
          trainingFieldId: true,
          trainingFieldPieceIds: true,
          players: { select: { playerId: true } },
        },
      })
    : null;
  if (customTrainingGroupId && !customTrainingGroup) {
    return NextResponse.json({ error: "Custom training group not found" }, { status: 404 });
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
          trainingTime: true,
          trainingDateTimes: true,
          trainingWeekdays: true,
          trainingWindowDays: true,
          trainingDurationMinutes: true,
          trainingFieldId: true,
          trainingFieldPieceIds: true,
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
          trainingTime: true,
          trainingDateTimes: true,
          trainingWeekdays: true,
          trainingWindowDays: true,
          trainingDurationMinutes: true,
          trainingFieldId: true,
          trainingFieldPieceIds: true,
        },
      })
    : null;

  const resolvedTrainingDates =
    customTrainingGroup
      ? customTrainingGroup.trainingDates ?? []
      : trainingGroup
      ? trainingGroup.trainingDates ?? []
      : trainingGroupOverride?.trainingDates ?? groupSchedule?.trainingDates ?? club.trainingDates ?? [];
  const resolvedTrainingWeekdays =
    customTrainingGroup
      ? customTrainingGroup.trainingWeekdays ?? []
      : trainingGroup
      ? trainingGroup.trainingWeekdays ?? []
      : trainingGroupOverride?.trainingWeekdays ?? groupSchedule?.trainingWeekdays ?? club.trainingWeekdays ?? [];
  const resolvedTrainingWindowDays =
    customTrainingGroup?.trainingWindowDays ??
    trainingGroup?.trainingWindowDays ??
    trainingGroupOverride?.trainingWindowDays ??
    groupSchedule?.trainingWindowDays ??
    club.trainingWindowDays ??
    TRAINING_SELECTION_WINDOW_DAYS;
  const resolvedTrainingDateTimes = normalizeStoredTrainingDateTimes(
    customTrainingGroup
      ? customTrainingGroup.trainingDateTimes
      : trainingGroup
      ? trainingGroup.trainingDateTimes
      : trainingGroupOverride?.trainingDateTimes ?? groupSchedule?.trainingDateTimes ?? club.trainingDateTimes,
    resolvedTrainingDates,
  );
  const resolvedDefaultTrainingTime = safeNormalizeTrainingTime(
    customTrainingGroup
      ? customTrainingGroup.trainingTime
      : trainingGroup
      ? trainingGroup.trainingTime
      : trainingGroupOverride?.trainingTime ?? groupSchedule?.trainingTime ?? club.trainingTime,
  );
  const resolvedTrainingDurationMinutes =
    customTrainingGroup
      ? customTrainingGroup.trainingDurationMinutes
      : trainingGroup
      ? trainingGroup.trainingDurationMinutes
      : trainingGroupOverride?.trainingDurationMinutes ?? groupSchedule?.trainingDurationMinutes ?? club.trainingDurationMinutes;
  const resolvedTrainingFieldId =
    customTrainingGroup
      ? customTrainingGroup.trainingFieldId
      : trainingGroup
      ? trainingGroup.trainingFieldId
      : trainingGroupOverride?.trainingFieldId ?? groupSchedule?.trainingFieldId ?? club.trainingFieldId ?? null;
  const resolvedTrainingFieldPieceIds =
    customTrainingGroup
      ? customTrainingGroup.trainingFieldPieceIds
      : trainingGroup
      ? trainingGroup.trainingFieldPieceIds
      : trainingGroupOverride?.trainingFieldPieceIds ?? groupSchedule?.trainingFieldPieceIds ?? club.trainingFieldPieceIds ?? [];

  const scopeKey = getTrainingSessionScopeKey(
    customTrainingGroup
      ? { type: "customGroup", id: customTrainingGroup.id }
      : trainingGroup
        ? { type: "trainingGroup", id: trainingGroup.id }
        : teamGroup !== null
          ? { type: "teamGroup", teamGroup }
          : { type: "club" },
  );
  const monthDates = requestedMonth ? getDatesInMonth(monthKey) : [];
  const storedSessions = requestedMonth && monthDates.length > 0
    ? await prisma.trainingSession.findMany({
        where: {
          clubId: id,
          scopeKey,
          trainingDate: {
            gte: isoDateToUtcMidnight(monthDates[0]),
            lte: isoDateToUtcMidnight(monthDates[monthDates.length - 1]),
          },
          status: {
            not: "cancelled",
          },
        },
        orderBy: { trainingDate: "asc" },
        select: {
          trainingDate: true,
          trainingTime: true,
          trainingDurationMinutes: true,
          trainingFieldId: true,
          trainingFieldPieceIds: true,
        },
      })
    : [];
  const storedSessionByDate = new Map(storedSessions.map((session) => [utcDateToIsoDate(session.trainingDate), session]));
  const storedSessionDates = storedSessions.map((session) => utcDateToIsoDate(session.trainingDate));

  const upcomingDates = storedSessionDates.length > 0
    ? storedSessionDates
    : requestedMonth
      ? getConfiguredTrainingDatesForMonth({
          trainingDates: resolvedTrainingDates,
          weekdays: resolvedTrainingWeekdays,
          monthKey,
          timeZone: FIXED_TIME_ZONE,
        })
      : getConfiguredTrainingDates({
          trainingDates: resolvedTrainingDates,
          weekdays: resolvedTrainingWeekdays,
          windowDays: resolvedTrainingWindowDays,
          timeZone: FIXED_TIME_ZONE,
          maxDays: TRAINING_SELECTION_WINDOW_DAYS,
        });
  const trainingDate =
    requestedDate && upcomingDates.includes(requestedDate)
      ? requestedDate
      : upcomingDates[0] || "";
  const selectedSession = trainingDate ? storedSessionByDate.get(trainingDate) : null;
  const effectiveTrainingFieldId = selectedSession?.trainingFieldId ?? resolvedTrainingFieldId;
  const effectiveTrainingFieldPieceIds = selectedSession?.trainingFieldPieceIds ?? resolvedTrainingFieldPieceIds;
  const effectiveTrainingDurationMinutes = selectedSession?.trainingDurationMinutes ?? resolvedTrainingDurationMinutes;

  const trainingField = effectiveTrainingFieldId
    ? await prisma.field.findUnique({
        where: { id: effectiveTrainingFieldId },
        select: {
          id: true,
          name: true,
          pieces: {
            select: { id: true, name: true },
            orderBy: { sortOrder: "asc" },
          },
        },
      })
    : null;
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
      customTrainingGroupId: customTrainingGroup?.id ?? null,
      trainingDurationMinutes: effectiveTrainingDurationMinutes,
      trainingFieldId: effectiveTrainingFieldId,
      trainingFieldPieceIds: effectiveTrainingFieldPieceIds,
      trainingField,
    });
  }

  const customPlayerIds = customTrainingGroup
    ? customTrainingGroup.players.map((item) => item.playerId)
    : [];

  const players = await prisma.player.findMany({
    where: {
      clubId: id,
      isActive: true,
      ...(customTrainingGroup ? { id: { in: customPlayerIds } } : {}),
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
      customTrainingGroupId: customTrainingGroup?.id ?? null,
      trainingDate,
      weekday: getWeekdayMondayFirst(trainingDate, FIXED_TIME_ZONE),
      trainingTime: selectedSession?.trainingTime ?? resolvedTrainingDateTimes[trainingDate] ?? resolvedDefaultTrainingTime,
      note: note?.note ?? "",
      trainingDurationMinutes: effectiveTrainingDurationMinutes,
      trainingFieldId: effectiveTrainingFieldId,
      trainingFieldPieceIds: effectiveTrainingFieldPieceIds,
      trainingField,
      stats: {
        total: totalPlayers,
        optedOut: playersWithStatus.filter((player) => player.optedOut).length,
        attending: playersWithStatus.filter((player) => !player.optedOut).length,
      },
      players: playersWithStatus,
      upcomingDates: upcomingDates.map((date) => ({
        date,
        weekday: getWeekdayMondayFirst(date, FIXED_TIME_ZONE),
        trainingTime: storedSessionByDate.get(date)?.trainingTime ?? resolvedTrainingDateTimes[date] ?? resolvedDefaultTrainingTime,
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
  let customTrainingGroupId: string | null = null;
  try {
    teamGroup = parseOptionalTeamGroup((body as { teamGroup?: unknown }).teamGroup);
    trainingGroupId = parseOptionalTrainingGroupId((body as { trainingGroupId?: unknown }).trainingGroupId);
    customTrainingGroupId = parseOptionalCustomTrainingGroupId((body as { customTrainingGroupId?: unknown }).customTrainingGroupId);
  } catch {
    return NextResponse.json({ error: "Invalid training group filter" }, { status: 400 });
  }
  if ([teamGroup !== null, Boolean(trainingGroupId), Boolean(customTrainingGroupId)].filter(Boolean).length > 1) {
    return NextResponse.json({ error: "Use only one training group filter." }, { status: 400 });
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
      trainingGroupMode: true,
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

  const customTrainingGroup = customTrainingGroupId
    ? await prisma.clubCustomTrainingGroup.findFirst({
        where: {
          id: customTrainingGroupId,
          clubId: id,
        },
        select: {
          id: true,
          trainingDates: true,
          trainingWeekdays: true,
          trainingWindowDays: true,
          players: { select: { playerId: true } },
        },
      })
    : null;
  if (customTrainingGroupId && !customTrainingGroup) {
    return NextResponse.json({ error: "Custom training group not found" }, { status: 404 });
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
      customTrainingGroup
        ? customTrainingGroup.trainingDates ?? []
        : trainingGroup
        ? trainingGroup.trainingDates ?? []
        : trainingGroupOverride?.trainingDates ?? groupSchedule?.trainingDates ?? club.trainingDates ?? [],
    weekdays:
      customTrainingGroup
        ? customTrainingGroup.trainingWeekdays ?? []
        : trainingGroup
        ? trainingGroup.trainingWeekdays ?? []
        : trainingGroupOverride?.trainingWeekdays ?? groupSchedule?.trainingWeekdays ?? club.trainingWeekdays ?? [],
    windowDays:
      customTrainingGroup?.trainingWindowDays ??
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
  const customPlayerIds = customTrainingGroup
    ? customTrainingGroup.players.map((item) => item.playerId)
    : [];
  const affectedPlayers = await prisma.player.findMany({
    where: {
      clubId: id,
      isActive: true,
      ...(customTrainingGroup ? { id: { in: customPlayerIds } } : {}),
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
    publishTrainingAttendanceUpdated(id, trainingDate);
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
  publishTrainingAttendanceUpdated(id, trainingDate);

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

function formatBgDate(isoDate: string) {
  return new Date(`${isoDate}T00:00:00.000Z`).toLocaleDateString("bg-BG", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
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
  const playerId = String((body as { playerId?: unknown }).playerId ?? "").trim();
  const trainingDate = String((body as { trainingDate?: unknown }).trainingDate ?? "").trim();
  const optedOut = (body as { optedOut?: unknown }).optedOut;

  if (!playerId) {
    return NextResponse.json({ error: "Missing playerId" }, { status: 400 });
  }
  if (!isIsoDate(trainingDate)) {
    return NextResponse.json({ error: "Invalid trainingDate" }, { status: 400 });
  }
  if (typeof optedOut !== "boolean") {
    return NextResponse.json({ error: "optedOut must be a boolean" }, { status: 400 });
  }

  try {
    const player = await prisma.player.findFirst({
      where: { id: playerId, clubId },
      select: {
        id: true,
        fullName: true,
        cards: {
          where: { isActive: true },
          select: { cardCode: true },
        },
      },
    });
    if (!player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    const trainingDateAsDate = isoDateToUtcMidnight(trainingDate);

    if (optedOut) {
      await prisma.trainingOptOut.upsert({
        where: {
          playerId_trainingDate: {
            playerId: player.id,
            trainingDate: trainingDateAsDate,
          },
        },
        update: {
          reasonCode: "other",
          reasonText: "Промяна направена от треньор",
        },
        create: {
          playerId: player.id,
          trainingDate: trainingDateAsDate,
          reasonCode: "other",
          reasonText: "Промяна направена от треньор",
        },
      });
    } else {
      await prisma.trainingOptOut.deleteMany({
        where: {
          playerId: player.id,
          trainingDate: trainingDateAsDate,
        },
      });
    }

    const firstCardCode = player.cards[0]?.cardCode ?? null;
    const formattedDate = formatBgDate(trainingDate);
    const memberPayload = {
      title: "Промяна в присъствието",
      body: optedOut
        ? `Треньорът е отбелязал отсъствие за тренировка на ${formattedDate}.`
        : `Треньорът е потвърдил присъствие за тренировка на ${formattedDate}.`,
      url: firstCardCode ? `/member/${encodeURIComponent(firstCardCode)}` : "/",
      icon: "/myteam-logo.png",
      badge: "/myteam-logo.png",
      tag: "training-attendance-updated",
      data: { type: "training_reminder", trainingDate },
    };

    try {
      await sendPushToMember(player.id, memberPayload, "training_reminder");
    } catch (error) {
      console.error("Member push send error (coach attendance change):", error);
    }

    for (const { cardCode } of player.cards) {
      publishMemberUpdated(cardCode, "training-updated");
    }
    publishTrainingAttendanceUpdated(clubId, trainingDate);

    return NextResponse.json({ success: true, playerId: player.id, trainingDate, optedOut });
  } catch (error) {
    console.error("Training attendance PATCH error:", error);
    if (isTransientPrismaConnectionError(error)) {
      return NextResponse.json(
        { error: "Database temporarily unavailable. Please retry in a few seconds." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
