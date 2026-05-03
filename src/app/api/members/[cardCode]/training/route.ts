import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendPushToClubAdmins } from "@/lib/push/adminService";
import { saveAdminNotificationHistory } from "@/lib/push/adminHistory";
import type { PushNotificationPayload } from "@/lib/push/types";
import { publishTrainingAttendanceUpdated } from "@/lib/trainingAttendanceEvents";
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
const OPT_OUT_REASON_LABELS_BG = {
  injury: "Контузия",
  sick: "Болен",
  other: "Друго",
} as const;

type OptOutReasonCode = keyof typeof OPT_OUT_REASON_LABELS_BG;

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
    const normalized = safeNormalizeTrainingTime(time);
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
  optOutReasonCode?: OptOutReasonCode | null;
  optOutReasonText?: string | null;
  coachGroupId?: string | null;
}): PushNotificationPayload {
  const formattedDate = formatBgDate(input.trainingDate);
  const reasonLabel = input.optOutReasonCode ? OPT_OUT_REASON_LABELS_BG[input.optOutReasonCode] : null;
  const reasonText = input.optOutReasonCode === "other" ? input.optOutReasonText?.trim() ?? "" : "";
  const reasonSuffix = input.optedOut && reasonLabel
    ? input.optOutReasonCode === "other" && reasonText
      ? ` Причина: ${reasonText}.`
      : ` Причина: ${reasonLabel}.`
    : "";
  return {
    title: "Промяна в присъствието",
    body: input.optedOut
      ? `${input.playerName} отбеляза отсъствие за тренировка на ${formattedDate}.${reasonSuffix}`
      : `${input.playerName} потвърди присъствие за тренировка на ${formattedDate}.`,
    url: input.coachGroupId
      ? `/admin/members?clubId=${encodeURIComponent(input.clubId)}&coachGroupId=${encodeURIComponent(input.coachGroupId)}`
      : `/admin/members?clubId=${encodeURIComponent(input.clubId)}`,
    icon: "/myteam-logo.png",
    badge: "/myteam-logo.png",
    tag: "training-attendance-updated",
    data: {
      type: "training_reminder",
      clubId: input.clubId,
      trainingDate: input.trainingDate,
      optedOut: input.optedOut,
      optOutReasonCode: input.optOutReasonCode ?? null,
      optOutReasonText: input.optOutReasonText ?? null,
    },
  };
}

function parseOptOutReason(
  rawCode: unknown,
  rawText: unknown,
): { code: OptOutReasonCode; text: string | null } | { error: string } {
  const code = String(rawCode ?? "").trim().toLowerCase();
  if (code !== "injury" && code !== "sick" && code !== "other") {
    return { error: "Invalid opt-out reason." };
  }

  const text = String(rawText ?? "").trim();
  if (code === "other") {
    if (text.length === 0) {
      return { error: "Reason text is required when reason is 'other'." };
    }
    if (text.length > 200) {
      return { error: "Reason text must be at most 200 characters." };
    }
    return { code, text };
  }

  return { code, text: null };
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
          coachGroupId: true,
          club: {
            select: {
              id: true,
              trainingDates: true,
              trainingDateTimes: true,
              trainingTime: true,
              trainingDurationMinutes: true,
              trainingWeekdays: true,
              trainingWindowDays: true,
              trainingGroupMode: true,
            },
          },
          customTrainingGroups: {
            select: {
              group: {
                select: {
                  trainingDates: true,
                  trainingDateTimes: true,
                  trainingTime: true,
                  trainingDurationMinutes: true,
                  trainingWeekdays: true,
                  trainingWindowDays: true,
                },
              },
            },
          },
          coachGroup: {
            select: {
              trainingDates: true,
              trainingDateTimes: true,
              trainingTime: true,
              trainingDurationMinutes: true,
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

  const isCustomGroupMode = card.player.club.trainingGroupMode === "custom_group";
  const customGroup = isCustomGroupMode
    ? card.player.customTrainingGroups[0]?.group ?? null
    : null;

  const coachGroupSchedule = card.player.coachGroup;
  const hasCoachGroupSchedule =
    coachGroupSchedule !== null &&
    (coachGroupSchedule.trainingDates.length > 0 || coachGroupSchedule.trainingWeekdays.length > 0);

  const groupSchedule = hasCoachGroupSchedule || card.player.teamGroup === null
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
          trainingDurationMinutes: true,
          trainingWeekdays: true,
          trainingWindowDays: true,
        },
      });

  const trainingGroupOverride = hasCoachGroupSchedule || card.player.teamGroup === null
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
          trainingDurationMinutes: true,
          trainingWeekdays: true,
          trainingWindowDays: true,
        },
      });

  const trainingWeekdays = (
    hasCoachGroupSchedule
      ? coachGroupSchedule!.trainingWeekdays
      : isCustomGroupMode
        ? customGroup?.trainingWeekdays ?? []
        : trainingGroupOverride?.trainingWeekdays ?? groupSchedule?.trainingWeekdays ?? card.player.club.trainingWeekdays ?? []
  )
    .filter((value) => Number.isInteger(value) && value >= 1 && value <= 7)
    .sort((a, b) => a - b);
  const trainingWindowDays = TRAINING_SELECTION_WINDOW_DAYS;

  const upcomingDates = getConfiguredTrainingDates({
    trainingDates: hasCoachGroupSchedule
      ? coachGroupSchedule!.trainingDates
      : isCustomGroupMode
        ? customGroup?.trainingDates ?? []
        : trainingGroupOverride?.trainingDates ?? groupSchedule?.trainingDates ?? card.player.club.trainingDates ?? [],
    weekdays: trainingWeekdays,
    windowDays: hasCoachGroupSchedule
      ? coachGroupSchedule!.trainingWindowDays
      : isCustomGroupMode
        ? customGroup?.trainingWindowDays ?? trainingWindowDays
        : trainingGroupOverride?.trainingWindowDays ?? groupSchedule?.trainingWindowDays ?? card.player.club.trainingWindowDays ?? trainingWindowDays,
    timeZone: FIXED_TIME_ZONE,
    maxDays: TRAINING_SELECTION_WINDOW_DAYS,
  });
  const scheduleDateTimes = normalizeStoredTrainingDateTimes(
    hasCoachGroupSchedule
      ? coachGroupSchedule!.trainingDateTimes
      : isCustomGroupMode
        ? customGroup?.trainingDateTimes
        : trainingGroupOverride?.trainingDateTimes ??
          groupSchedule?.trainingDateTimes ??
          card.player.club.trainingDateTimes,
    upcomingDates,
  );
  const scheduleFallbackTime = safeNormalizeTrainingTime(
    hasCoachGroupSchedule
      ? coachGroupSchedule!.trainingTime
      : isCustomGroupMode
        ? customGroup?.trainingTime
        : trainingGroupOverride?.trainingTime ??
          groupSchedule?.trainingTime ??
          card.player.club.trainingTime ??
          null,
  );
  const scheduleDurationMinutes =
    hasCoachGroupSchedule
      ? coachGroupSchedule!.trainingDurationMinutes
      : isCustomGroupMode
        ? customGroup?.trainingDurationMinutes ?? card.player.club.trainingDurationMinutes
        : trainingGroupOverride?.trainingDurationMinutes ??
          groupSchedule?.trainingDurationMinutes ??
          card.player.club.trainingDurationMinutes;

  return {
    cardCode: card.cardCode,
    playerId: card.playerId,
    playerName: card.player.fullName,
    clubId: card.player.clubId,
    coachGroupId: card.player.coachGroupId ?? null,
    trainingWeekdays,
    trainingWindowDays,
    upcomingDates,
    trainingDateTimes: scheduleDateTimes,
    fallbackTrainingTime: scheduleFallbackTime,
    trainingDurationMinutes: scheduleDurationMinutes,
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
        reasonCode: true,
        reasonText: true,
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
  const optedOutByDate = new Map(
    optOutRows.map((item) => [
      utcDateToIsoDate(item.trainingDate),
      {
        reasonCode: item.reasonCode,
        reasonText: item.reasonText,
      },
    ] as const),
  );
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
      optedOut: optedOutByDate.has(date),
      optOutReasonCode: optedOutByDate.get(date)?.reasonCode ?? null,
      optOutReasonText: optedOutByDate.get(date)?.reasonText ?? null,
      trainingTime: context.trainingDateTimes[date] ?? context.fallbackTrainingTime ?? "",
      trainingDurationMinutes: context.trainingDurationMinutes,
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
  const parsedReason = parseOptOutReason(
    (body as { reasonCode?: unknown }).reasonCode,
    (body as { reasonText?: unknown }).reasonText,
  );

  if (!isIsoDate(trainingDate)) {
    return NextResponse.json({ error: "Invalid trainingDate" }, { status: 400 });
  }
  if (!context.upcomingDates.includes(trainingDate)) {
    return NextResponse.json({ error: "Date is outside configured training window" }, { status: 400 });
  }
  if ("error" in parsedReason) {
    return NextResponse.json({ error: parsedReason.error }, { status: 400 });
  }

  await prisma.trainingOptOut.upsert({
    where: {
      playerId_trainingDate: {
        playerId: context.playerId,
        trainingDate: isoDateToUtcMidnight(trainingDate),
      },
    },
    update: {
      reasonCode: parsedReason.code,
      reasonText: parsedReason.text,
    },
    create: {
      playerId: context.playerId,
      trainingDate: isoDateToUtcMidnight(trainingDate),
      reasonCode: parsedReason.code,
      reasonText: parsedReason.text,
    },
  });

  let coachPush = { total: 0, sent: 0, failed: 0, deactivated: 0 };
  const coachPayload = buildCoachAttendancePayload({
    clubId: context.clubId,
    playerName: context.playerName,
    trainingDate,
    optedOut: true,
    optOutReasonCode: parsedReason.code,
    optOutReasonText: parsedReason.text,
    coachGroupId: context.coachGroupId,
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
    coachPush = await sendPushToClubAdmins(context.clubId, coachPayload, context.coachGroupId);
  } catch (error) {
    console.error("Coach attendance push send error (opt-out):", error);
  }
  publishTrainingAttendanceUpdated(context.clubId, trainingDate);

  return NextResponse.json({
    success: true,
    trainingDate,
    optedOut: true,
    reasonCode: parsedReason.code,
    reasonText: parsedReason.text,
    coachPush,
  });
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
    coachGroupId: context.coachGroupId,
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
    coachPush = await sendPushToClubAdmins(context.clubId, coachPayload, context.coachGroupId);
  } catch (error) {
    console.error("Coach attendance push send error (opt-in):", error);
  }
  publishTrainingAttendanceUpdated(context.clubId, trainingDate);

  return NextResponse.json({ success: true, trainingDate, optedOut: false, coachPush });
}
