import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendPushToClubAdmins } from "@/lib/push/adminService";
import { saveAdminNotificationHistory } from "@/lib/push/adminHistory";
import type { PushNotificationPayload } from "@/lib/push/types";
import {
  getConfiguredTrainingDates,
  getWeekdayMondayFirst,
  isIsoDate,
  isoDateToUtcMidnight,
  normalizeTrainingTime,
  utcDateToIsoDate,
} from "@/lib/training";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FIXED_TIME_ZONE = "Europe/Sofia";
const TRAINING_SELECTION_WINDOW_DAYS = 30;

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
    const time = typeof value === "string" ? value.trim() : "";
    const normalized = normalizeTrainingTime(time);
    if (normalized) {
      result[date] = normalized;
    }
  }
  return result;
}

function safeNormalizeTrainingTime(raw: unknown): string | null {
  try {
    return normalizeTrainingTime(raw);
  } catch {
    return null;
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

function buildCoachAttendancePayload(input: {
  clubId: string;
  playerName: string;
  trainingDate: string;
  optedOut: boolean;
}): PushNotificationPayload {
  const formattedDate = formatBgDate(input.trainingDate);
  return {
    title: "Промяна в присъствието",
    body: input.optedOut
      ? `${input.playerName} отбеляза отсъствие за тренировка на ${formattedDate}.`
      : `${input.playerName} потвърди присъствие за тренировка на ${formattedDate}.`,
    url: `/admin/members?clubId=${encodeURIComponent(input.clubId)}`,
    icon: "/logo.png",
    badge: "/logo.png",
    tag: "training-attendance-updated",
    data: {
      type: "training_reminder",
      clubId: input.clubId,
      trainingDate: input.trainingDate,
      optedOut: input.optedOut,
    },
  };
}

async function getMemberTrainingContext(cardCode: string) {
  const normalizedCardCode = cardCode.trim().toUpperCase();
  const card = await prisma.card.findFirst({
    where: {
      cardCode: normalizedCardCode,
      isActive: true,
    },
    select: {
      cardCode: true,
      playerId: true,
      player: {
        select: {
          id: true,
          fullName: true,
          clubId: true,
          teamGroup: true,
          club: {
            select: {
              id: true,
              trainingDates: true,
              trainingDateTimes: true,
              trainingTime: true,
              trainingWeekdays: true,
              trainingWindowDays: true,
            },
          },
        },
      },
    },
  });

  if (!card?.player?.club) {
    return null;
  }

  const groupSchedule = card.player.teamGroup === null
    ? null
    : await prisma.clubTrainingGroupSchedule.findUnique({
        where: {
          clubId_teamGroup: {
            clubId: card.player.clubId,
            teamGroup: card.player.teamGroup,
          },
        },
        select: {
          trainingDates: true,
          trainingDateTimes: true,
          trainingTime: true,
          trainingWeekdays: true,
          trainingWindowDays: true,
        },
      });

  const trainingGroupOverride = card.player.teamGroup === null
    ? null
    : await prisma.clubTrainingScheduleGroup.findFirst({
        where: {
          clubId: card.player.clubId,
          teamGroups: {
            has: card.player.teamGroup,
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
          trainingDateTimes: true,
          trainingTime: true,
          trainingWeekdays: true,
          trainingWindowDays: true,
        },
      });

  const trainingWeekdays = (trainingGroupOverride?.trainingWeekdays ?? groupSchedule?.trainingWeekdays ?? card.player.club.trainingWeekdays ?? [])
    .filter((value) => Number.isInteger(value) && value >= 1 && value <= 7)
    .sort((a, b) => a - b);
  const trainingWindowDays = TRAINING_SELECTION_WINDOW_DAYS;

  const upcomingDates = getConfiguredTrainingDates({
    trainingDates: trainingGroupOverride?.trainingDates ?? groupSchedule?.trainingDates ?? card.player.club.trainingDates ?? [],
    weekdays: trainingWeekdays,
    windowDays: trainingGroupOverride?.trainingWindowDays ?? groupSchedule?.trainingWindowDays ?? card.player.club.trainingWindowDays ?? trainingWindowDays,
    timeZone: FIXED_TIME_ZONE,
    maxDays: TRAINING_SELECTION_WINDOW_DAYS,
  });
  const scheduleDateTimes = normalizeStoredTrainingDateTimes(
    trainingGroupOverride?.trainingDateTimes ??
      groupSchedule?.trainingDateTimes ??
      card.player.club.trainingDateTimes,
    upcomingDates,
  );
  const scheduleFallbackTime = safeNormalizeTrainingTime(
    trainingGroupOverride?.trainingTime ??
    groupSchedule?.trainingTime ??
    card.player.club.trainingTime ??
    null,
  );

  return {
    cardCode: card.cardCode,
    playerId: card.playerId,
    playerName: card.player.fullName,
    clubId: card.player.clubId,
    trainingWeekdays,
    trainingWindowDays,
    upcomingDates,
    trainingDateTimes: scheduleDateTimes,
    fallbackTrainingTime: scheduleFallbackTime,
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ cardCode: string }> },
) {
  const { cardCode } = await params;
  const context = await getMemberTrainingContext(cardCode);

  if (!context) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  if (context.upcomingDates.length === 0) {
    return NextResponse.json({
      clubId: context.clubId,
      cardCode: context.cardCode,
      trainingWeekdays: context.trainingWeekdays,
      trainingWindowDays: context.trainingWindowDays,
      dates: [],
    });
  }

  const trainingDatesAsUtc = context.upcomingDates.map((value) => isoDateToUtcMidnight(value));
  const [optOutRows, noteRows] = await Promise.all([
    prisma.trainingOptOut.findMany({
      where: {
        playerId: context.playerId,
        trainingDate: {
          in: trainingDatesAsUtc,
        },
      },
      select: {
        trainingDate: true,
      },
    }),
    prisma.trainingNote.findMany({
      where: {
        clubId: context.clubId,
        trainingDate: {
          in: trainingDatesAsUtc,
        },
      },
      select: {
        trainingDate: true,
        note: true,
      },
    }),
  ]);
  const optedOutSet = new Set(optOutRows.map((item) => utcDateToIsoDate(item.trainingDate)));
  const noteByDate = new Map(
    noteRows
      .map((item) => [utcDateToIsoDate(item.trainingDate), item.note?.trim() ?? ""] as const)
      .filter(([, note]) => note.length > 0),
  );

  return NextResponse.json({
    clubId: context.clubId,
    cardCode: context.cardCode,
    trainingWeekdays: context.trainingWeekdays,
    trainingWindowDays: context.trainingWindowDays,
    dates: context.upcomingDates.map((date) => ({
      date,
      weekday: getWeekdayMondayFirst(date, FIXED_TIME_ZONE),
      optedOut: optedOutSet.has(date),
      trainingTime: context.trainingDateTimes[date] ?? context.fallbackTrainingTime ?? "",
      note: noteByDate.get(date) ?? "",
    })),
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ cardCode: string }> },
) {
  const { cardCode } = await params;
  const context = await getMemberTrainingContext(cardCode);

  if (!context) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const trainingDate = String((body as { trainingDate?: unknown }).trainingDate ?? "").trim();

  if (!isIsoDate(trainingDate)) {
    return NextResponse.json({ error: "Invalid trainingDate" }, { status: 400 });
  }
  if (!context.upcomingDates.includes(trainingDate)) {
    return NextResponse.json({ error: "Date is outside configured training window" }, { status: 400 });
  }

  await prisma.trainingOptOut.upsert({
    where: {
      playerId_trainingDate: {
        playerId: context.playerId,
        trainingDate: isoDateToUtcMidnight(trainingDate),
      },
    },
    update: {},
    create: {
      playerId: context.playerId,
      trainingDate: isoDateToUtcMidnight(trainingDate),
    },
  });

  let coachPush = { total: 0, sent: 0, failed: 0, deactivated: 0 };
  const coachPayload = buildCoachAttendancePayload({
    clubId: context.clubId,
    playerName: context.playerName,
    trainingDate,
    optedOut: true,
  });

  try {
    await saveAdminNotificationHistory({
      clubId: context.clubId,
      playerId: context.playerId,
      type: "training_attendance",
      payload: coachPayload,
    });
  } catch (error) {
    console.error("Coach attendance history save error (opt-out):", error);
  }

  try {
    coachPush = await sendPushToClubAdmins(context.clubId, coachPayload);
  } catch (error) {
    console.error("Coach attendance push send error (opt-out):", error);
  }

  return NextResponse.json({ success: true, trainingDate, optedOut: true, coachPush });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ cardCode: string }> },
) {
  const { cardCode } = await params;
  const context = await getMemberTrainingContext(cardCode);

  if (!context) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const trainingDate = String((body as { trainingDate?: unknown }).trainingDate ?? "").trim();

  if (!isIsoDate(trainingDate)) {
    return NextResponse.json({ error: "Invalid trainingDate" }, { status: 400 });
  }

  await prisma.trainingOptOut.deleteMany({
    where: {
      playerId: context.playerId,
      trainingDate: isoDateToUtcMidnight(trainingDate),
    },
  });

  let coachPush = { total: 0, sent: 0, failed: 0, deactivated: 0 };
  const coachPayload = buildCoachAttendancePayload({
    clubId: context.clubId,
    playerName: context.playerName,
    trainingDate,
    optedOut: false,
  });

  try {
    await saveAdminNotificationHistory({
      clubId: context.clubId,
      playerId: context.playerId,
      type: "training_attendance",
      payload: coachPayload,
    });
  } catch (error) {
    console.error("Coach attendance history save error (opt-in):", error);
  }

  try {
    coachPush = await sendPushToClubAdmins(context.clubId, coachPayload);
  } catch (error) {
    console.error("Coach attendance push send error (opt-in):", error);
  }

  return NextResponse.json({ success: true, trainingDate, optedOut: false, coachPush });
}
