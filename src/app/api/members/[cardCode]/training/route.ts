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
import { updateTrainingSessionPlayerAttendance } from "@/lib/trainingSessions";

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
    icon: "/myteam-logo.webp",
    badge: "/myteam-logo.webp",
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

type CoachGroupSchedule = {
  id: string;
  trainingDates: string[];
  trainingDateTimes: unknown;
  trainingTime: string | null;
  trainingDurationMinutes: number;
  trainingWeekdays: number[];
  trainingWindowDays: number;
  trainingFieldId: string | null;
  trainingFieldPieceIds: string[];
  trainingFieldSelections: unknown;
};

type CustomGroupSchedule = CoachGroupSchedule;

function mergeScheduleDates(groups: Array<{ trainingDates: string[] }>) {
  return [...new Set(groups.flatMap((g) => g.trainingDates))].sort();
}

function mergeScheduleWeekdays(groups: Array<{ trainingWeekdays: number[] }>) {
  return [...new Set(groups.flatMap((g) => g.trainingWeekdays))];
}

function mergeStoredTrainingDateTimes(
  groups: Array<{ trainingDates: string[]; trainingDateTimes: unknown }>,
  trainingDates: string[],
) {
  const result: Record<string, string> = {};
  const allowedDates = new Set(trainingDates);
  for (const group of groups) {
    const groupDateTimes = normalizeStoredTrainingDateTimes(group.trainingDateTimes, group.trainingDates);
    for (const [date, time] of Object.entries(groupDateTimes)) {
      if (allowedDates.has(date) && !result[date]) {
        result[date] = time;
      }
    }
  }
  return result;
}

function resolveCoachGroupForDate(
  groups: CoachGroupSchedule[],
  date: string,
  weekday: number,
): string | null {
  return (
    groups.find((g) => g.trainingDates.includes(date))?.id ??
    groups.find((g) => g.trainingWeekdays.includes(weekday))?.id ??
    null
  );
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
              trainingDurationMinutes: true,
              trainingWeekdays: true,
              trainingWindowDays: true,
              trainingGroupMode: true,
              trainingFieldId: true,
              trainingFieldPieceIds: true,
              trainingFieldSelections: true,
            },
          },
          customTrainingGroups: {
            select: {
              group: {
                select: {
                  id: true,
                  trainingDates: true,
                  trainingDateTimes: true,
                  trainingTime: true,
                  trainingDurationMinutes: true,
                  trainingWeekdays: true,
                  trainingWindowDays: true,
                  trainingFieldId: true,
                  trainingFieldPieceIds: true,
                  trainingFieldSelections: true,
                },
              },
            },
          },
          coachGroups: {
            select: {
              id: true,
              trainingDates: true,
              trainingDateTimes: true,
              trainingTime: true,
              trainingDurationMinutes: true,
              trainingWeekdays: true,
              trainingWindowDays: true,
              trainingFieldId: true,
              trainingFieldPieceIds: true,
              trainingFieldSelections: true,
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
  const scheduledCustomGroups: CustomGroupSchedule[] = isCustomGroupMode
    ? card.player.customTrainingGroups
        .map((item) => item.group)
        .filter((g) => g.trainingDates.length > 0 || g.trainingWeekdays.length > 0)
    : [];
  const hasCustomGroupSchedule = scheduledCustomGroups.length > 0;

  const scheduledCoachGroups: CoachGroupSchedule[] = card.player.coachGroups.filter(
    (g) => g.trainingDates.length > 0 || g.trainingWeekdays.length > 0,
  );
  const hasCoachGroupSchedule = !hasCustomGroupSchedule && scheduledCoachGroups.length > 0;

  // Merge training dates and weekdays from all coach groups
  const mergedCoachDates = hasCoachGroupSchedule ? mergeScheduleDates(scheduledCoachGroups) : [];
  const mergedCoachWeekdays = hasCoachGroupSchedule ? mergeScheduleWeekdays(scheduledCoachGroups) : [];
  // Use first scheduled coach group as primary source for time/duration/field
  const primaryCoachGroup = hasCoachGroupSchedule ? scheduledCoachGroups[0] : null;
  const mergedCustomDates = hasCustomGroupSchedule ? mergeScheduleDates(scheduledCustomGroups) : [];
  const mergedCustomWeekdays = hasCustomGroupSchedule ? mergeScheduleWeekdays(scheduledCustomGroups) : [];
  const primaryCustomGroup = hasCustomGroupSchedule ? scheduledCustomGroups[0] : null;

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
          trainingFieldId: true,
          trainingFieldPieceIds: true,
          trainingFieldSelections: true,
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
          trainingFieldId: true,
          trainingFieldPieceIds: true,
          trainingFieldSelections: true,
        },
      });

  const trainingWeekdays = (
    hasCoachGroupSchedule
      ? mergedCoachWeekdays
      : hasCustomGroupSchedule
        ? mergedCustomWeekdays
      : isCustomGroupMode
        ? []
        : trainingGroupOverride?.trainingWeekdays ?? groupSchedule?.trainingWeekdays ?? card.player.club.trainingWeekdays ?? []
  )
    .filter((value) => Number.isInteger(value) && value >= 1 && value <= 7)
    .sort((a, b) => a - b);
  const trainingWindowDays = TRAINING_SELECTION_WINDOW_DAYS;

  const upcomingDates = getConfiguredTrainingDates({
    trainingDates: hasCoachGroupSchedule
      ? mergedCoachDates
      : hasCustomGroupSchedule
        ? mergedCustomDates
      : isCustomGroupMode
        ? []
        : trainingGroupOverride?.trainingDates ?? groupSchedule?.trainingDates ?? card.player.club.trainingDates ?? [],
    weekdays: trainingWeekdays,
    windowDays: hasCoachGroupSchedule
      ? (primaryCoachGroup?.trainingWindowDays ?? trainingWindowDays)
      : hasCustomGroupSchedule
        ? (primaryCustomGroup?.trainingWindowDays ?? trainingWindowDays)
      : isCustomGroupMode
        ? trainingWindowDays
        : trainingGroupOverride?.trainingWindowDays ?? groupSchedule?.trainingWindowDays ?? card.player.club.trainingWindowDays ?? trainingWindowDays,
    timeZone: FIXED_TIME_ZONE,
    maxDays: TRAINING_SELECTION_WINDOW_DAYS,
  });
  const scheduleDateTimes = hasCustomGroupSchedule
    ? mergeStoredTrainingDateTimes(scheduledCustomGroups, upcomingDates)
    : normalizeStoredTrainingDateTimes(
        hasCoachGroupSchedule
          ? primaryCoachGroup!.trainingDateTimes
          : isCustomGroupMode
            ? null
            : trainingGroupOverride?.trainingDateTimes ??
              groupSchedule?.trainingDateTimes ??
              card.player.club.trainingDateTimes,
        upcomingDates,
      );
  const scheduleFallbackTime = safeNormalizeTrainingTime(
    hasCoachGroupSchedule
      ? primaryCoachGroup!.trainingTime
      : hasCustomGroupSchedule
        ? primaryCustomGroup?.trainingTime
      : isCustomGroupMode
        ? null
        : trainingGroupOverride?.trainingTime ??
          groupSchedule?.trainingTime ??
          card.player.club.trainingTime ??
          null,
  );
  const scheduleDurationMinutes =
    hasCoachGroupSchedule
      ? primaryCoachGroup!.trainingDurationMinutes
      : hasCustomGroupSchedule
        ? primaryCustomGroup?.trainingDurationMinutes ?? card.player.club.trainingDurationMinutes
      : isCustomGroupMode
        ? card.player.club.trainingDurationMinutes
        : trainingGroupOverride?.trainingDurationMinutes ??
          groupSchedule?.trainingDurationMinutes ??
          card.player.club.trainingDurationMinutes;

  const scheduleFieldSource = hasCoachGroupSchedule
    ? primaryCoachGroup!
    : hasCustomGroupSchedule
      ? primaryCustomGroup!
    : isCustomGroupMode
      ? card.player.club
      : trainingGroupOverride ?? groupSchedule ?? card.player.club;

  return {
    cardCode: card.cardCode,
    playerId: card.playerId,
    playerName: card.player.fullName,
    clubId: card.player.clubId,
    playerTeamGroup: card.player.teamGroup,
    playerCustomGroupIds: card.player.customTrainingGroups.map((g) => g.group.id),
    playerCoachGroupIds: card.player.coachGroups.map((g) => g.id),
    scheduledCoachGroups,
    scheduledCustomGroups,
    hasCoachGroupSchedule,
    hasCustomGroupSchedule,
    trainingWeekdays,
    trainingWindowDays,
    upcomingDates,
    trainingDateTimes: scheduleDateTimes,
    fallbackTrainingTime: scheduleFallbackTime,
    trainingDurationMinutes: scheduleDurationMinutes,
    scheduleFieldId: scheduleFieldSource.trainingFieldId ?? null,
    scheduleFieldPieceIds: scheduleFieldSource.trainingFieldPieceIds ?? [],
    scheduleFieldSelections: scheduleFieldSource.trainingFieldSelections,
  };
}

function resolveFieldSelectionsForDate(
  fieldId: string | null,
  fieldPieceIds: string[],
  fieldSelections: unknown,
  date: string,
): { fieldId: string | null; fieldPieceIds: string[] } {
  if (fieldSelections && typeof fieldSelections === "object" && !Array.isArray(fieldSelections)) {
    const sel = (fieldSelections as Record<string, unknown>)[date];
    if (sel && typeof sel === "object" && !Array.isArray(sel)) {
      const s = sel as Record<string, unknown>;
      const id = typeof s.trainingFieldId === "string" && s.trainingFieldId.trim() ? s.trainingFieldId.trim() : null;
      const pieces = Array.isArray(s.trainingFieldPieceIds)
        ? (s.trainingFieldPieceIds as unknown[]).map((p) => String(p ?? "").trim()).filter(Boolean)
        : [];
      return { fieldId: id, fieldPieceIds: pieces };
    }
  }
  return { fieldId, fieldPieceIds };
}

type LimitedEventComputed = {
  scopeKey: string;
  id: string;
  maxSpots: number;
  isRegistered: boolean;
  isConfirmed: boolean;
  waitlistPosition: number | null;
  spotsRemaining: number;
};

type SessionItem = {
  scopeKey: string;
  trainingTime: string;
  trainingDurationMinutes: number;
  trainingFieldName: string | null;
  trainingFieldPieces: string[];
  trainingFieldPieceNames: string[];
  limitedEvent: Omit<LimitedEventComputed, "scopeKey"> | null;
};

function buildGroupSession(
  group: CoachGroupSchedule,
  scopeKey: string,
  date: string,
  limitedEventsForDate: LimitedEventComputed[],
  fieldById: Map<string, { id: string; name: string; pieces: { id: string; name: string }[] }>,
): SessionItem {
  const groupDateTimes = normalizeStoredTrainingDateTimes(group.trainingDateTimes, group.trainingDates);
  const trainingTime = groupDateTimes[date] ?? safeNormalizeTrainingTime(group.trainingTime) ?? "";
  const sel = resolveFieldSelectionsForDate(
    group.trainingFieldId, group.trainingFieldPieceIds, group.trainingFieldSelections, date,
  );
  const field = sel.fieldId ? fieldById.get(sel.fieldId) : null;
  const allPieceNames = field?.pieces.map((p) => p.name) ?? [];
  const selectedPieceNames =
    field && sel.fieldPieceIds.length > 0
      ? sel.fieldPieceIds
          .map((pid) => field.pieces.find((p) => p.id === pid)?.name)
          .filter((n): n is string => Boolean(n))
      : [];
  const leRow = limitedEventsForDate.find((e) => e.scopeKey === scopeKey);
  const limitedEvent = leRow
    ? { id: leRow.id, maxSpots: leRow.maxSpots, isRegistered: leRow.isRegistered, isConfirmed: leRow.isConfirmed, waitlistPosition: leRow.waitlistPosition, spotsRemaining: leRow.spotsRemaining }
    : null;
  return {
    scopeKey,
    trainingTime,
    trainingDurationMinutes: group.trainingDurationMinutes,
    trainingFieldName: field?.name ?? null,
    trainingFieldPieces: allPieceNames,
    trainingFieldPieceNames: selectedPieceNames,
    limitedEvent,
  };
}

function hasAnyStoredFieldSelection(fieldSelections: unknown) {
  if (!fieldSelections || typeof fieldSelections !== "object" || Array.isArray(fieldSelections)) {
    return false;
  }

  return Object.values(fieldSelections as Record<string, unknown>).some((rawSelection) => {
    if (!rawSelection || typeof rawSelection !== "object" || Array.isArray(rawSelection)) {
      return false;
    }
    const selection = rawSelection as Record<string, unknown>;
    return typeof selection.trainingFieldId === "string" && selection.trainingFieldId.trim().length > 0;
  });
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

  // Build scope keys for this player to match limited training events
  const playerScopeKeys: string[] = [];
  if (context.playerTeamGroup !== null) {
    playerScopeKeys.push(`team_group:${context.playerTeamGroup}`);
  }
  for (const cgId of context.playerCustomGroupIds) {
    playerScopeKeys.push(`custom_group:${cgId}`);
  }
  for (const coachGId of context.playerCoachGroupIds) {
    playerScopeKeys.push(`coach_group:${coachGId}`);
  }

  const [optOutRows, noteRows, sessionRows, limitedEventRows] = await Promise.all([
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
    prisma.trainingSession.findMany({
      where: {
        clubId: context.clubId,
        status: {
          not: "cancelled",
        },
        trainingDate: {
          in: trainingDatesAsUtc,
        },
        players: {
          some: {
            playerId: context.playerId,
          },
        },
      },
      select: {
        trainingDate: true,
        trainingTime: true,
        trainingDurationMinutes: true,
        trainingFieldId: true,
        trainingFieldPieceIds: true,
      },
    }),
    playerScopeKeys.length > 0
      ? prisma.limitedTrainingEvent.findMany({
          where: {
            clubId: context.clubId,
            scopeKey: { in: playerScopeKeys },
            trainingDate: { in: trainingDatesAsUtc },
          },
          select: {
            id: true,
            scopeKey: true,
            trainingDate: true,
            maxSpots: true,
            registrations: {
              select: { playerId: true },
              orderBy: { registeredAt: "asc" },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const sessionByDate = new Map(sessionRows.map((session) => [utcDateToIsoDate(session.trainingDate), session]));
  const limitedEventsByDate = new Map<string, LimitedEventComputed[]>();
  for (const e of limitedEventRows) {
    const dateKey = utcDateToIsoDate(e.trainingDate);
    const totalCount = e.registrations.length;
    const playerIndex = e.registrations.findIndex((r) => r.playerId === context.playerId);
    const position = playerIndex >= 0 ? playerIndex + 1 : null;
    const isRegistered = position !== null;
    const isConfirmed = isRegistered && position <= e.maxSpots;
    const waitlistPosition = isRegistered && !isConfirmed ? position - e.maxSpots : null;
    const spotsRemaining = Math.max(0, e.maxSpots - totalCount);
    const arr = limitedEventsByDate.get(dateKey) ?? [];
    arr.push({ scopeKey: e.scopeKey, id: e.id, maxSpots: e.maxSpots, isRegistered, isConfirmed, waitlistPosition, spotsRemaining });
    limitedEventsByDate.set(dateKey, arr);
  }
  const hasSessionFieldSelection = sessionRows.some((session) => Boolean(session.trainingFieldId));
  const hasAnyCoachGroupField = context.scheduledCoachGroups.some(
    (g) => Boolean(g.trainingFieldId) || hasAnyStoredFieldSelection(g.trainingFieldSelections),
  );
  const hasAnyCustomGroupField = context.scheduledCustomGroups.some(
    (g) => Boolean(g.trainingFieldId) || hasAnyStoredFieldSelection(g.trainingFieldSelections),
  );
  const clubFields =
    context.scheduleFieldId || hasAnyStoredFieldSelection(context.scheduleFieldSelections) || hasSessionFieldSelection || hasAnyCoachGroupField || hasAnyCustomGroupField
      ? await prisma.field.findMany({
          where: { clubId: context.clubId },
          select: {
            id: true,
            name: true,
            pieces: {
              select: { id: true, name: true },
              orderBy: { sortOrder: "asc" },
            },
          },
        })
      : [];

  const fieldById = new Map(clubFields.map((f) => [f.id, f]));

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
    dates: context.upcomingDates.map((date) => {
      const weekday = getWeekdayMondayFirst(date, FIXED_TIME_ZONE);
      const limitedEventsForDate = limitedEventsByDate.get(date) ?? [];

      let sessions: SessionItem[];

      if (context.hasCoachGroupSchedule) {
        const matchingGroups = context.scheduledCoachGroups.filter(
          (g) => g.trainingDates.includes(date) || g.trainingWeekdays.includes(weekday),
        );
        sessions = matchingGroups.map((g) =>
          buildGroupSession(g, `coach_group:${g.id}`, date, limitedEventsForDate, fieldById),
        );
      } else if (context.hasCustomGroupSchedule) {
        const matchingGroups = context.scheduledCustomGroups.filter(
          (g) => g.trainingDates.includes(date) || g.trainingWeekdays.includes(weekday),
        );
        sessions = matchingGroups.map((g) =>
          buildGroupSession(g, `custom_group:${g.id}`, date, limitedEventsForDate, fieldById),
        );
      } else {
        const session = sessionByDate.get(date);
        const scheduleFieldSelection = resolveFieldSelectionsForDate(
          context.scheduleFieldId, context.scheduleFieldPieceIds, context.scheduleFieldSelections, date,
        );
        const fieldId = session?.trainingFieldId ?? scheduleFieldSelection.fieldId;
        const fieldPieceIds = session?.trainingFieldPieceIds ?? scheduleFieldSelection.fieldPieceIds;
        const field = fieldId ? fieldById.get(fieldId) : null;
        const allPieceNames = field?.pieces.map((p) => p.name) ?? [];
        const selectedPieceNames =
          field && fieldPieceIds.length > 0
            ? fieldPieceIds.map((pid) => field.pieces.find((p) => p.id === pid)?.name).filter((n): n is string => Boolean(n))
            : [];
        const leRow = limitedEventsForDate[0] ?? null;
        sessions = [
          {
            scopeKey: context.playerTeamGroup !== null ? `team_group:${context.playerTeamGroup}` : "",
            trainingTime: session?.trainingTime ?? context.trainingDateTimes[date] ?? context.fallbackTrainingTime ?? "",
            trainingDurationMinutes: session?.trainingDurationMinutes ?? context.trainingDurationMinutes,
            trainingFieldName: field?.name ?? null,
            trainingFieldPieces: allPieceNames,
            trainingFieldPieceNames: selectedPieceNames,
            limitedEvent: leRow
              ? { id: leRow.id, maxSpots: leRow.maxSpots, isRegistered: leRow.isRegistered, isConfirmed: leRow.isConfirmed, waitlistPosition: leRow.waitlistPosition, spotsRemaining: leRow.spotsRemaining }
              : null,
          },
        ];
      }

      if (sessions.length === 0) {
        sessions = [
          {
            scopeKey: "",
            trainingTime: context.fallbackTrainingTime ?? "",
            trainingDurationMinutes: context.trainingDurationMinutes,
            trainingFieldName: null,
            trainingFieldPieces: [],
            trainingFieldPieceNames: [],
            limitedEvent: null,
          },
        ];
      }

      const firstSession = sessions[0]!;
      return {
        date,
        weekday,
        optedOut: optedOutByDate.has(date),
        optOutReasonCode: optedOutByDate.get(date)?.reasonCode ?? null,
        optOutReasonText: optedOutByDate.get(date)?.reasonText ?? null,
        note: noteByDate.get(date) ?? "",
        // Top-level fields kept for backward compatibility (first session's values):
        trainingTime: firstSession.trainingTime,
        trainingDurationMinutes: firstSession.trainingDurationMinutes,
        trainingFieldName: firstSession.trainingFieldName,
        trainingFieldPieces: firstSession.trainingFieldPieces,
        trainingFieldPieceNames: firstSession.trainingFieldPieceNames,
        limitedEvent: firstSession.limitedEvent,
        sessions,
      };
    }),
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

  await prisma.$transaction(async (tx) => {
    await tx.trainingOptOut.upsert({
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
    await updateTrainingSessionPlayerAttendance({
      tx,
      clubId: context.clubId,
      playerId: context.playerId,
      trainingDate,
      optedOut: true,
      reasonCode: parsedReason.code,
      reasonText: parsedReason.text,
    });
  });

  const optOutWeekday = getWeekdayMondayFirst(trainingDate, FIXED_TIME_ZONE);
  const optOutCoachGroupId = resolveCoachGroupForDate(context.scheduledCoachGroups, trainingDate, optOutWeekday);

  let coachPush = { total: 0, sent: 0, failed: 0, deactivated: 0 };
  const coachPayload = buildCoachAttendancePayload({
    clubId: context.clubId,
    playerName: context.playerName,
    trainingDate,
    optedOut: true,
    optOutReasonCode: parsedReason.code,
    optOutReasonText: parsedReason.text,
    coachGroupId: optOutCoachGroupId,
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
    coachPush = await sendPushToClubAdmins(context.clubId, coachPayload, optOutCoachGroupId);
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

  await prisma.$transaction(async (tx) => {
    await tx.trainingOptOut.deleteMany({
      where: {
        playerId: context.playerId,
        trainingDate: isoDateToUtcMidnight(trainingDate),
      },
    });
    await updateTrainingSessionPlayerAttendance({
      tx,
      clubId: context.clubId,
      playerId: context.playerId,
      trainingDate,
      optedOut: false,
    });
  });

  const optInWeekday = getWeekdayMondayFirst(trainingDate, FIXED_TIME_ZONE);
  const optInCoachGroupId = resolveCoachGroupForDate(context.scheduledCoachGroups, trainingDate, optInWeekday);

  let coachPush = { total: 0, sent: 0, failed: 0, deactivated: 0 };
  const coachPayload = buildCoachAttendancePayload({
    clubId: context.clubId,
    playerName: context.playerName,
    trainingDate,
    optedOut: false,
    coachGroupId: optInCoachGroupId,
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
    coachPush = await sendPushToClubAdmins(context.clubId, coachPayload, optInCoachGroupId);
  } catch (error) {
    console.error("Coach attendance push send error (opt-in):", error);
  }
  publishTrainingAttendanceUpdated(context.clubId, trainingDate);

  return NextResponse.json({ success: true, trainingDate, optedOut: false, coachPush });
}
