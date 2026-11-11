import { matchEventTypeLabel } from "@/lib/matchEventType";
import { TRAINING_SELECTION_WINDOW_DAYS } from "@/lib/trainingScheduleWindow";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyAdminToken } from "@/lib/adminAuth";
import { getConfiguredTrainingDates, getTodayIsoDateInTimeZone, getWeekdayMondayFirst } from "@/lib/training";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FIXED_TIME_ZONE = "Europe/Sofia";

const WEEK_DAYS = 7;

function isTransientPrismaConnectionError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }
  const maybeError = error as { code?: unknown };
  const code = typeof maybeError.code === "string" ? maybeError.code : "";
  return code === "P1001" || code === "P2024";
}

async function verifySession(request: NextRequest) {
  const token = request.cookies.get("admin_session")?.value;
  const session = token ? await verifyAdminToken(token) : null;
  return session;
}

function hasTrainingOnDate(input: {
  date: string;
  trainingDates?: string[] | null;
  weekdays?: number[] | null;
  windowDays?: number;
  includeEarlierThisWeek?: boolean;
}) {
  if (input.includeEarlierThisWeek) {
    if (input.trainingDates?.length) {
      return input.trainingDates.some((date) => date.trim() === input.date);
    }
    return input.weekdays?.includes(getWeekdayMondayFirst(input.date, FIXED_TIME_ZONE)) ?? false;
  }
  const configured = getConfiguredTrainingDates({
    trainingDates: input.trainingDates ?? [],
    weekdays: input.weekdays ?? [],
    windowDays: input.windowDays ?? TRAINING_SELECTION_WINDOW_DAYS,
    timeZone: FIXED_TIME_ZONE,
    maxDays: TRAINING_SELECTION_WINDOW_DAYS,
  });
  return configured.includes(input.date);
}

function resolveTime(
  date: string,
  trainingTime: string | null,
  trainingDateTimes: unknown,
): string | null {
  if (trainingDateTimes && typeof trainingDateTimes === "object" && !Array.isArray(trainingDateTimes)) {
    const dtMap = trainingDateTimes as Record<string, unknown>;
    const v = dtMap[date];
    if (typeof v === "string" && /^\d{2}:\d{2}$/.test(v)) return v;
  }
  if (typeof trainingTime === "string" && /^\d{2}:\d{2}$/.test(trainingTime)) return trainingTime;
  return null;
}

function getSevenDates(todayIso: string): string[] {
  return Array.from({ length: WEEK_DAYS }, (_, i) => {
    const d = new Date(`${todayIso}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

type WeekSession = {
  id: string;
  date: string;
  trainingTime: string | null;
  scopeType: "teamGroup" | "trainingGroup";
  eventType: "training" | "match";
  label: string;
  teamGroups: number[];
  color?: string | null;
  location?: string;
  fieldName?: string;
  scopeLabel?: string;
  isHome?: boolean;
  durationMinutes?: number;
  customGroupId?: string | null;
  coachGroupId?: string | null;
  limitedSpots?: { id: string; maxSpots: number; registeredCount: number } | null;
};

function formatTeamGroupsLabel(teamGroups: number[]): string {
  if (teamGroups.length === 0) return "Всички";
  return `Набор ${teamGroups.join("/")}`;
}

function resolveMatchScopeLabel(
  teamGroups: number[],
  trainingGroups: Array<{ name: string; teamGroups: number[] }>,
): string {
  if (teamGroups.length === 0) return "Всички";
  const normalized = [...teamGroups].sort((a, b) => a - b);
  const matchingTrainingGroup = trainingGroups.find((group) => {
    const groupTeamGroups = [...(group.teamGroups ?? [])].sort((a, b) => a - b);
    return groupTeamGroups.length === normalized.length && groupTeamGroups.every((value, index) => value === normalized[index]);
  });
  return matchingTrainingGroup?.name || formatTeamGroupsLabel(normalized);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await verifySession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const includeFields = request.nextUrl.searchParams.get("view") === "schedule2";
  if (includeFields && !session.roles.includes("admin")) {
    return NextResponse.json({ error: "Нямате достъп до График 2." }, { status: 403 });
  }

  const scheduleFieldSelect = {
    trainingFieldId: includeFields,
    trainingFieldPieceIds: includeFields,
    trainingFieldSelections: includeFields,
  };
  const { id } = await params;
  const todayIso = getTodayIsoDateInTimeZone(FIXED_TIME_ZONE);
  let start = todayIso;
  if (includeFields) {
    const week = Number(request.nextUrl.searchParams.get("week") ?? 0);
    if (!Number.isInteger(week) || week < 0 || week > Math.ceil(TRAINING_SELECTION_WINDOW_DAYS / WEEK_DAYS)) {
      return NextResponse.json({ error: "Невалидна седмица." }, { status: 400 });
    }
    const monday = new Date(`${todayIso}T00:00:00Z`);
    monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % WEEK_DAYS + week * WEEK_DAYS);
    start = monday.toISOString().slice(0, 10);
  }
  const dates = getSevenDates(start);

  try {
    const [club, teamSchedules, trainingGroups, customTrainingGroups, clubMatches, limitedEvents, cancelledSessions] = await Promise.all([
      prisma.club.findUnique({
        where: { id },
        select: {
          id: true,
          trainingDates: true,
          trainingWeekdays: true,
          trainingWindowDays: true,
          trainingTime: true,
          trainingDateTimes: true,
          ...scheduleFieldSelect,
          trainingGroupMode: true,
        },
      }),
      prisma.clubTrainingGroupSchedule.findMany({
        where: { clubId: id },
        select: {
          teamGroup: true,
          trainingDates: true,
          trainingWeekdays: true,
          trainingWindowDays: true,
          trainingTime: true,
          trainingDateTimes: true,
          ...scheduleFieldSelect,
        },
      }),
      prisma.clubTrainingScheduleGroup.findMany({
        where: { clubId: id },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          name: true,
          teamGroups: true,
          trainingDates: true,
          trainingWeekdays: true,
          trainingWindowDays: true,
          trainingTime: true,
          trainingDateTimes: true,
          ...scheduleFieldSelect,
        },
      }),
      prisma.clubCustomTrainingGroup.findMany({
        where: { clubId: id },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          name: true,
          color: true,
          coachGroupId: includeFields,
          trainingDates: true,
          trainingWeekdays: true,
          trainingWindowDays: true,
          trainingTime: true,
          trainingDateTimes: true,
          ...scheduleFieldSelect,
        },
      }),
      prisma.clubMatch.findMany({
        where: { clubId: id, matchDate: { in: dates } },
        select: {
          id: true, eventType: true, opponent: true, location: true, matchDate: true, matchTime: true,
          teamGroups: true, isHome: true, durationMinutes: true, customGroupId: true,
          customGroup: { select: { name: true, color: true } },
          description: includeFields, category: includeFields, homeScore: includeFields, awayScore: includeFields,
        },
      }),
      prisma.limitedTrainingEvent.findMany({
        where: { clubId: id, trainingDate: { in: dates.map((d) => new Date(d + "T00:00:00.000Z")) } },
        select: { id: true, scopeKey: true, trainingDate: true, maxSpots: true, _count: { select: { registrations: true } } },
      }),
      prisma.trainingSession.findMany({
        where: { clubId: id, status: "cancelled", trainingDate: { in: dates.map((d) => new Date(d + "T00:00:00.000Z")) } },
        select: { scopeKey: true, trainingDate: true },
      }),
    ]);

    const cancelledSet = new Set<string>();
    for (const cs of cancelledSessions) {
      cancelledSet.add(`${cs.scopeKey}|${cs.trainingDate.toISOString().slice(0, 10)}`);
    }

    if (!club) {
      return NextResponse.json({ error: "Club not found" }, { status: 404 });
    }

    // Build a lookup: "scopeKey|YYYY-MM-DD" → limited event data
    const limitedEventByKey = new Map<string, { id: string; maxSpots: number; registeredCount: number }>();
    for (const ev of limitedEvents) {
      const dateIso = ev.trainingDate.toISOString().slice(0, 10);
      limitedEventByKey.set(`${ev.scopeKey}|${dateIso}`, {
        id: ev.id,
        maxSpots: ev.maxSpots,
        registeredCount: ev._count.registrations,
      });
    }

    const sessions: WeekSession[] = [];
    const elapsedDates = includeFields ? dates.filter((date) => date < todayIso) : [];
    const [coachSessions, coachGroups, fields, storedSessions] = await Promise.all([
      prisma.trainingSession.findMany({ where: { clubId: id, scopeType: "coachGroup", status: "scheduled", trainingDate: { in: dates.map((d) => new Date(`${d}T00:00:00Z`)) } }, select: { id: true, scopeId: true, trainingDate: true, trainingTime: true, trainingDurationMinutes: true, trainingFieldId: includeFields, trainingFieldPieceIds: includeFields } }),
      prisma.coachGroup.findMany({ where: { clubId: id }, select: { id: true, name: true } }),
      includeFields ? prisma.field.findMany({
        where: { clubId: id },
        select: { id: true, name: true, pieces: { orderBy: { sortOrder: "asc" }, select: { id: true, name: true } } },
      }) : [],
      elapsedDates.length > 0 ? prisma.trainingSession.findMany({
        where: {
          clubId: id,
          scopeType: { in: club.trainingGroupMode === "custom_group" ? ["customGroup"] : ["trainingGroup", "teamGroup"] },
          status: "scheduled",
          removedFromSchedule: false,
          occurrenceKey: "",
          trainingDate: { in: elapsedDates.map((date) => new Date(`${date}T00:00:00Z`)) },
        },
        select: {
          scopeKey: true, teamGroup: true, teamGroups: true, trainingDate: true, trainingTime: true,
          trainingDurationMinutes: true, trainingFieldId: true, trainingFieldPieceIds: true,
        },
      }) : [],
    ]);
    const storedByScopeAndDate = new Map(storedSessions.map((session) => [
      `${session.scopeKey}|${session.trainingDate.toISOString().slice(0, 10)}`, session,
    ]));
    const fieldsById = new Map(fields.map((field) => [field.id, field]));
    const describeField = (
      date: string,
      source: {
        trainingFieldId?: string | null;
        trainingFieldPieceIds?: string[];
        trainingFieldSelections?: unknown;
      },
    ) => {
      if (!includeFields) return {};
      const selections = source.trainingFieldSelections as Record<string, {
        trainingFieldId?: string | null;
        trainingFieldPieceIds?: string[];
      }> | null | undefined;
      const selection = selections?.[date] && typeof selections[date] === "object" ? selections[date] : source;
      const field = fieldsById.get(selection.trainingFieldId ?? "");
      if (!field) return {};
      const pieceIds = Array.isArray(selection.trainingFieldPieceIds) ? selection.trainingFieldPieceIds : [];
      const pieces = field.pieces.filter((piece) => pieceIds.includes(piece.id));
      const location = pieces.length ? `${field.name} · ${pieces.map((piece) => piece.name).join(", ")}` : field.name;
      return { fieldName: field.name, location };
    };
    const coachNames = new Map(coachGroups.map((g) => [g.id, g.name]));
    const schedule2Details = includeFields ? {
      canCreateCustomTraining: club.trainingGroupMode === "custom_group",
      matches: clubMatches.map(({ customGroup, ...match }) => match),
      customGroups: customTrainingGroups.map(({ id, name, coachGroupId }) => ({
        id,
        name,
        coachGroupId: coachGroupId ?? null,
        coachName: coachGroupId ? coachNames.get(coachGroupId) ?? null : null,
      })).sort((a, b) => a.name.localeCompare(b.name, "bg") || a.id.localeCompare(b.id)),
    } : {};
    for (const item of coachSessions) sessions.push({ id: `coach-${item.scopeId}-${item.id}`, date: item.trainingDate.toISOString().slice(0, 10), trainingTime: item.trainingTime, durationMinutes: item.trainingDurationMinutes, ...describeField(item.trainingDate.toISOString().slice(0, 10), item), scopeType: "trainingGroup", eventType: "training", label: coachNames.get(item.scopeId ?? "") ?? "Треньорска група", teamGroups: [], ...(includeFields ? { coachGroupId: item.scopeId } : {}), limitedSpots: limitedEventByKey.get(`coach_group:${item.scopeId}:session:${item.id}|${item.trainingDate.toISOString().slice(0, 10)}`) ?? null });

    if (club.trainingGroupMode === "custom_group") {
      for (const date of dates) {
        for (const group of customTrainingGroups) {
          const scopeDate = `custom_group:${group.id}|${date}`;
          if (cancelledSet.has(scopeDate)) continue;
          const stored = storedByScopeAndDate.get(scopeDate);
          if (!stored && !hasTrainingOnDate({
            date,
            trainingDates: group.trainingDates,
            weekdays: group.trainingWeekdays,
            windowDays: group.trainingWindowDays,
            includeEarlierThisWeek: includeFields && date < todayIso,
          })) continue;
          sessions.push({
            id: `${date}-custom-${group.id}`,
            date,
            trainingTime: stored ? stored.trainingTime : resolveTime(date, group.trainingTime, group.trainingDateTimes),
            durationMinutes: stored?.trainingDurationMinutes,
            scopeType: "trainingGroup",
            eventType: "training",
            label: group.name || "Custom group",
            ...describeField(date, stored ?? group),
            teamGroups: [],
            color: group.color ?? null,
            ...(includeFields ? { customGroupId: group.id } : {}),
            limitedSpots: limitedEventByKey.get(scopeDate) ?? null,
          });
        }
      }
    }

    if (club.trainingGroupMode === "custom_group") {
      for (const match of clubMatches) {
        sessions.push({
          id: `match-${match.id}`,
          date: match.matchDate,
          trainingTime: match.matchTime,
          scopeType: "teamGroup",
          eventType: "match",
          label: `${matchEventTypeLabel(match.eventType)} · ${match.opponent}`,
          teamGroups: match.teamGroups,
          location: match.location,
          scopeLabel: match.customGroup?.name ?? resolveMatchScopeLabel(match.teamGroups, []),
          isHome: match.isHome,
          durationMinutes: match.durationMinutes,
          color: match.customGroup?.color ?? null,
          customGroupId: match.customGroupId ?? null,
        });
      }

      sessions.sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.label.localeCompare(b.label, "bg");
      });

      return NextResponse.json({ dates, sessions, ...schedule2Details });
    }

    const teamScheduleByGroup = new Map<number, (typeof teamSchedules)[number]>();
    for (const schedule of teamSchedules) {
      teamScheduleByGroup.set(schedule.teamGroup, schedule);
    }

    const trainingGroupOverrideByTeamGroup = new Map<number, (typeof trainingGroups)[number]>();
    for (const group of trainingGroups) {
      const hasExplicitDates = Array.isArray(group.trainingDates) && group.trainingDates.length > 0;
      if (!hasExplicitDates) continue;
      for (const teamGroup of group.teamGroups ?? []) {
        if (!Number.isInteger(teamGroup) || trainingGroupOverrideByTeamGroup.has(teamGroup)) continue;
        trainingGroupOverrideByTeamGroup.set(teamGroup, group);
      }
    }

    const allTeamGroups = Array.from(
      new Set([
        ...teamSchedules.map((item) => item.teamGroup),
        ...trainingGroups.flatMap((item) => item.teamGroups ?? []),
        ...storedSessions.flatMap((session) => session.teamGroup === null ? [] : [session.teamGroup]),
      ]),
    )
      .filter((value) => Number.isInteger(value))
      .sort((a, b) => a - b);

    for (const date of dates) {
      const coveredTeamGroups = new Set<number>();

      for (const group of trainingGroups) {
        const scopeDate = `training_group:${group.id}|${date}`;
        if (cancelledSet.has(scopeDate)) continue;
        const stored = storedByScopeAndDate.get(scopeDate);
        const normalizedGroups = Array.from(
          new Set((stored?.teamGroups ?? group.teamGroups ?? []).filter((v) => Number.isInteger(v))),
        ).sort((a, b) => a - b);
        if (normalizedGroups.length === 0) continue;

        if (!stored && !hasTrainingOnDate({
          date,
          trainingDates: group.trainingDates,
          weekdays: group.trainingWeekdays,
          windowDays: group.trainingWindowDays,
          includeEarlierThisWeek: includeFields && date < todayIso,
        })) continue;

        for (const tg of normalizedGroups) coveredTeamGroups.add(tg);
        sessions.push({
          id: `${date}-group-${group.id}`,
          date,
          trainingTime: stored ? stored.trainingTime : resolveTime(date, group.trainingTime, group.trainingDateTimes),
          durationMinutes: stored?.trainingDurationMinutes,
          scopeType: "trainingGroup",
          eventType: "training",
          label: group.name || "Сборен отбор",
          ...describeField(date, stored ?? group),
          teamGroups: normalizedGroups,
        });
      }

      for (const teamGroup of allTeamGroups) {
        if (coveredTeamGroups.has(teamGroup)) continue;
        const scopeDate = `team_group:${teamGroup}|${date}`;
        if (cancelledSet.has(scopeDate) || cancelledSet.has(`club|${date}`)) continue;
        const stored = storedByScopeAndDate.get(scopeDate);
        const groupSchedule = teamScheduleByGroup.get(teamGroup);
        const override = trainingGroupOverrideByTeamGroup.get(teamGroup);
        if (!stored && !hasTrainingOnDate({
          date,
          trainingDates: override?.trainingDates ?? groupSchedule?.trainingDates ?? club.trainingDates,
          weekdays: override?.trainingWeekdays ?? groupSchedule?.trainingWeekdays ?? club.trainingWeekdays,
          windowDays: override?.trainingWindowDays ?? groupSchedule?.trainingWindowDays ?? club.trainingWindowDays,
          includeEarlierThisWeek: includeFields && date < todayIso,
        })) continue;

        const resolvedSchedule = groupSchedule ?? null;
        const pitchSource = [override, groupSchedule, club].find((source) => source?.trainingFieldId);
        sessions.push({
          id: `${date}-team-${teamGroup}`,
          date,
          trainingTime: stored ? stored.trainingTime : resolveTime(
            date,
            resolvedSchedule?.trainingTime ?? club.trainingTime,
            resolvedSchedule?.trainingDateTimes ?? club.trainingDateTimes,
          ),
          durationMinutes: stored?.trainingDurationMinutes,
          scopeType: "teamGroup",
          eventType: "training",
          label: `Отбор ${teamGroup}`,
          ...describeField(date, stored ?? {
            trainingFieldId: pitchSource?.trainingFieldId,
            trainingFieldPieceIds: pitchSource?.trainingFieldPieceIds,
            trainingFieldSelections: override?.trainingFieldSelections ?? groupSchedule?.trainingFieldSelections ?? club.trainingFieldSelections,
          }),
          teamGroups: [teamGroup],
          limitedSpots: limitedEventByKey.get(scopeDate) ?? null,
        });
      }
    }

    for (const match of clubMatches) {
      sessions.push({
        id: `match-${match.id}`,
        date: match.matchDate,
        trainingTime: match.matchTime,
        scopeType: "teamGroup",
        eventType: "match",
        label: `${matchEventTypeLabel(match.eventType)} · ${match.opponent}`,
        teamGroups: match.teamGroups,
        location: match.location,
        scopeLabel: match.customGroup?.name ?? resolveMatchScopeLabel(match.teamGroups, trainingGroups),
        isHome: match.isHome,
        durationMinutes: match.durationMinutes,
        color: match.customGroup?.color ?? null,
        customGroupId: match.customGroupId ?? null,
      });
    }

    sessions.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      if (a.eventType !== b.eventType) return a.eventType === "training" ? -1 : 1;
      if (a.scopeType !== b.scopeType) return a.scopeType === "teamGroup" ? -1 : 1;
      return a.label.localeCompare(b.label, "bg");
    });

    return NextResponse.json({ dates, sessions, ...schedule2Details });
  } catch (error) {
    console.error("Training attendance week GET error:", error);
    if (isTransientPrismaConnectionError(error)) {
      return NextResponse.json(
        { error: "Database temporarily unavailable. Please retry in a few seconds." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
