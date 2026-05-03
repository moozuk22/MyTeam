import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyAdminToken } from "@/lib/adminAuth";
import {
  getWeekdayMondayFirst,
  getTodayIsoDateInTimeZone,
  isIsoDate,
  isoDateToUtcMidnight,
  normalizeTrainingDurationMinutes,
  normalizeTrainingTime,
} from "@/lib/training";
import {
  sendTrainingScheduleNotifications,
  shouldNotifyForTrainingDatesChange,
} from "@/lib/push/trainingScheduleNotifications";
import { assertNoTrainingFieldConflict } from "@/lib/trainingFieldConflicts";
import { clubHasTrainingFields, parseTrainingFieldSelection, verifyTrainingFieldSelection } from "@/lib/trainingFields";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FIXED_TIME_ZONE = "Europe/Sofia";
const TRAINING_SELECTION_WINDOW_DAYS = 30;

function normalizeTeamGroups(raw: unknown): number[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const unique = Array.from(
    new Set(
      raw
        .map((value) => Number.parseInt(String(value ?? "").trim(), 10))
        .filter((value) => Number.isInteger(value) && value > 0),
    ),
  );
  return unique.sort((a, b) => a - b);
}

function normalizeTrainingDates(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const todayIso = getTodayIsoDateInTimeZone(FIXED_TIME_ZONE);
  const start = isoDateToUtcMidnight(todayIso).getTime();
  const end = start + (TRAINING_SELECTION_WINDOW_DAYS - 1) * 24 * 60 * 60 * 1000;
  const dates: string[] = [];

  for (const value of raw) {
    const date = String(value ?? "").trim();
    if (!isIsoDate(date)) {
      throw new Error("Training dates must be valid ISO dates.");
    }
    const timestamp = isoDateToUtcMidnight(date).getTime();
    if (timestamp < start || timestamp > end) {
      throw new Error(`Training dates must be within the next ${TRAINING_SELECTION_WINDOW_DAYS} days.`);
    }
    dates.push(date);
  }

  return Array.from(new Set(dates)).sort((a, b) => a.localeCompare(b));
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
    const time = typeof value === "string" ? value.trim() : "";
    const normalized = normalizeTrainingTime(time);
    if (normalized) {
      result[date] = normalized;
    }
  }
  return result;
}

function buildTrainingDateTimes(input: {
  rawTrainingDateTimes: unknown;
  trainingDates: string[];
  fallbackTrainingTime: string | null;
}) {
  const allowedDates = new Set(input.trainingDates);
  const result: Record<string, string> = {};
  if (input.rawTrainingDateTimes && typeof input.rawTrainingDateTimes === "object" && !Array.isArray(input.rawTrainingDateTimes)) {
    for (const [date, value] of Object.entries(input.rawTrainingDateTimes as Record<string, unknown>)) {
      if (!allowedDates.has(date)) {
        throw new Error("Training date times contain date outside selected training days.");
      }
      const normalized = normalizeTrainingTime(value);
      if (!normalized) {
        throw new Error("Training time is required for each selected day.");
      }
      result[date] = normalized;
    }
  }

  if (Object.keys(result).length === 0 && input.fallbackTrainingTime) {
    for (const date of input.trainingDates) {
      result[date] = input.fallbackTrainingTime;
    }
  }

  for (const date of input.trainingDates) {
    if (!result[date]) {
      throw new Error("Training time is required for each selected day.");
    }
  }

  return result;
}

async function verifySession(request: NextRequest) {
  const token = request.cookies.get("admin_session")?.value;
  return token ? await verifyAdminToken(token) : null;
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
  try {
    const groups = await prisma.clubTrainingScheduleGroup.findMany({
      where: { clubId: id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        teamGroups: true,
        trainingDates: true,
        trainingTime: true,
        trainingDateTimes: true,
        trainingDurationMinutes: true,
        trainingFieldId: true,
        trainingFieldPieceIds: true,
        trainingFieldSelections: true,
        trainingWeekdays: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return NextResponse.json(
      groups.map((group) => ({
        ...group,
        trainingDateTimes: normalizeStoredTrainingDateTimes(group.trainingDateTimes, group.trainingDates ?? []),
      })),
    );
  } catch (error) {
    console.error("Training groups GET error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await verifySession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const teamGroups = normalizeTeamGroups((body as { teamGroups?: unknown }).teamGroups);
  if (teamGroups.length < 2) {
    return NextResponse.json(
      { error: "Select at least 2 team groups for a training group." },
      { status: 400 },
    );
  }

  const rawTrainingDates = (body as { trainingDates?: unknown }).trainingDates;
  const rawTrainingTime = (body as { trainingTime?: unknown }).trainingTime;
  const rawTrainingDateTimes = (body as { trainingDateTimes?: unknown }).trainingDateTimes;
  const rawTrainingDurationMinutes = (body as { trainingDurationMinutes?: unknown }).trainingDurationMinutes;
  const rawTrainingFieldId = (body as { trainingFieldId?: unknown }).trainingFieldId;
  const rawTrainingFieldPieceId = (body as { trainingFieldPieceIds?: unknown }).trainingFieldPieceIds;
  const hasExplicitTrainingDates = Array.isArray(rawTrainingDates) && rawTrainingDates.length > 0;
  let trainingTime: string | null = null;
  let trainingDurationMinutes = 60;
  let trainingFieldSelection = { trainingFieldId: null as string | null, trainingFieldPieceIds: [] as string[] };
  try {
    trainingTime = normalizeTrainingTime(rawTrainingTime);
    trainingDurationMinutes = rawTrainingDurationMinutes === undefined
      ? 60
      : normalizeTrainingDurationMinutes(rawTrainingDurationMinutes);
    trainingFieldSelection = parseTrainingFieldSelection({
      trainingFieldId: rawTrainingFieldId,
      trainingFieldPieceIds: rawTrainingFieldPieceId,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid training time." },
      { status: 400 },
    );
  }
  let trainingDates: string[] = [];
  if (hasExplicitTrainingDates) {
    try {
      trainingDates = normalizeTrainingDates(rawTrainingDates);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Invalid training dates." },
        { status: 400 },
      );
    }
  }
  let trainingDateTimes: Record<string, string> = {};
  if (trainingDates.length > 0) {
    const hasTrainingFields = await clubHasTrainingFields(id);
    if (hasTrainingFields && !trainingFieldSelection.trainingFieldId) {
      return NextResponse.json({ error: "Треньорът трябва да избере терен." }, { status: 400 });
    }
    try {
      await verifyTrainingFieldSelection(id, trainingFieldSelection);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Invalid training field." },
        { status: 400 },
      );
    }
    try {
      trainingDateTimes = buildTrainingDateTimes({
        rawTrainingDateTimes,
        trainingDates,
        fallbackTrainingTime: trainingTime,
      });
      await assertNoTrainingFieldConflict({
        clubId: id,
        trainingDates,
        trainingDateTimes,
        trainingDurationMinutes,
        trainingFieldId: trainingFieldSelection.trainingFieldId,
        trainingFieldPieceIds: trainingFieldSelection.trainingFieldPieceIds,
        excludeTeamGroups: teamGroups,
      });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Invalid training date times." },
        { status: 400 },
      );
    }
  }
  const persistedTrainingTime = trainingTime ?? Object.values(trainingDateTimes)[0] ?? null;

  const trainingWeekdays = Array.from(
    new Set(trainingDates.map((date) => getWeekdayMondayFirst(date, FIXED_TIME_ZONE)).filter((value) => value >= 1 && value <= 7)),
  ).sort((a, b) => a - b);

  const nameInput = String((body as { name?: unknown }).name ?? "").trim();
  const defaultName = teamGroups.map((group) => String(group)).join("/");
  const name = nameInput || defaultName;

  try {
    const group = await prisma.$transaction(async (tx) => {
      const club = await tx.club.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!club) {
        throw new Error("CLUB_NOT_FOUND");
      }

      const created = await tx.clubTrainingScheduleGroup.create({
        data: {
          clubId: id,
          name,
          teamGroups,
          trainingDates,
          trainingTime: persistedTrainingTime,
          trainingDateTimes,
          trainingDurationMinutes,
          trainingFieldId: trainingFieldSelection.trainingFieldId,
          trainingFieldPieceIds: trainingFieldSelection.trainingFieldPieceIds,
          trainingWeekdays,
          trainingWindowDays: TRAINING_SELECTION_WINDOW_DAYS,
        },
        select: {
          id: true,
          name: true,
          teamGroups: true,
          trainingDates: true,
          trainingTime: true,
          trainingDateTimes: true,
          trainingDurationMinutes: true,
          trainingFieldId: true,
          trainingFieldPieceIds: true,
          trainingFieldSelections: true,
          trainingWeekdays: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (hasExplicitTrainingDates) {
        for (const teamGroup of teamGroups) {
          await tx.clubTrainingGroupSchedule.upsert({
            where: {
              clubId_teamGroup: {
                clubId: id,
                teamGroup,
              },
            },
            update: {
              trainingDates,
              trainingTime: persistedTrainingTime,
              trainingDateTimes,
              trainingDurationMinutes,
              trainingFieldId: trainingFieldSelection.trainingFieldId,
              trainingFieldPieceIds: trainingFieldSelection.trainingFieldPieceIds,
              trainingWeekdays,
              trainingWindowDays: TRAINING_SELECTION_WINDOW_DAYS,
            },
            create: {
              clubId: id,
              teamGroup,
              trainingDates,
              trainingTime: persistedTrainingTime,
              trainingDateTimes,
              trainingDurationMinutes,
              trainingFieldId: trainingFieldSelection.trainingFieldId,
              trainingFieldPieceIds: trainingFieldSelection.trainingFieldPieceIds,
              trainingWeekdays,
              trainingWindowDays: TRAINING_SELECTION_WINDOW_DAYS,
            },
          });
        }
      }

      return created;
    });

    let notifications = null;
    if (shouldNotifyForTrainingDatesChange([], group.trainingDates ?? [])) {
      notifications = await sendTrainingScheduleNotifications({
        clubId: id,
        teamGroups: group.teamGroups,
        previousDates: [],
        trainingDates: group.trainingDates,
      });
    }

    return NextResponse.json(
      {
        ...group,
        trainingDateTimes: normalizeStoredTrainingDateTimes(group.trainingDateTimes, group.trainingDates ?? []),
        notifications,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "CLUB_NOT_FOUND") {
      return NextResponse.json({ error: "Club not found." }, { status: 404 });
    }
    console.error("Training groups POST error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
