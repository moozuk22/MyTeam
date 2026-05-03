import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyAdminToken } from "@/lib/adminAuth";
import {
  getConfiguredTrainingDates,
  getTodayIsoDateInTimeZone,
  isIsoDate,
  isoDateToUtcMidnight,
  normalizeTrainingDurationMinutes,
  normalizeTrainingTime,
} from "@/lib/training";
import { assertNoTrainingFieldConflict, assertNoTrainingTimeConflict } from "@/lib/trainingFieldConflicts";
import {
  clubHasTrainingFields,
  normalizeStoredTrainingFieldSelections,
  parseTrainingFieldSelection,
  parseTrainingFieldSelectionsByDate,
  verifyTrainingFieldSelectionsByDate,
} from "@/lib/trainingFields";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FIXED_TIME_ZONE = "Europe/Sofia";
const TRAINING_SELECTION_WINDOW_DAYS = 30;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function verifySession(request: NextRequest) {
  const token = request.cookies.get("admin_session")?.value;
  return token ? await verifyAdminToken(token) : null;
}

function normalizeStoredTrainingDateTimes(raw: unknown, trainingDates: string[]): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const source = raw as Record<string, unknown>;
  const allowedDates = new Set(trainingDates);
  const result: Record<string, string> = {};
  for (const [date, value] of Object.entries(source)) {
    if (!allowedDates.has(date)) continue;
    const time = typeof value === "string" ? value.trim() : "";
    const normalized = normalizeTrainingTime(time);
    if (normalized) result[date] = normalized;
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
  if (
    input.rawTrainingDateTimes &&
    typeof input.rawTrainingDateTimes === "object" &&
    !Array.isArray(input.rawTrainingDateTimes)
  ) {
    for (const [date, value] of Object.entries(input.rawTrainingDateTimes as Record<string, unknown>)) {
      if (!allowedDates.has(date)) {
        throw new Error("Training date times contain date outside selected training days.");
      }
      const normalized = normalizeTrainingTime(value);
      if (!normalized) throw new Error("Training time is required for each selected day.");
      result[date] = normalized;
    }
  }
  if (Object.keys(result).length === 0 && input.fallbackTrainingTime) {
    for (const date of input.trainingDates) result[date] = input.fallbackTrainingTime;
  }
  for (const date of input.trainingDates) {
    if (!result[date]) throw new Error("Training time is required for each selected day.");
  }
  return result;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; groupId: string }> },
) {
  const session = await verifySession(request);
  if (!session) {
    return NextResponse.json({ error: "Нямате достъп." }, { status: 401 });
  }

  const { id: clubId, groupId } = await params;
  if (!UUID_REGEX.test(clubId) || !UUID_REGEX.test(groupId)) {
    return NextResponse.json({ error: "Coach group not found" }, { status: 404 });
  }

  const row = await prisma.coachGroup.findFirst({
    where: { id: groupId, clubId },
    select: {
      trainingDates: true,
      trainingDateTimes: true,
      trainingTime: true,
      trainingDurationMinutes: true,
      trainingFieldId: true,
      trainingFieldPieceIds: true,
      trainingFieldSelections: true,
      trainingWeekdays: true,
      trainingWindowDays: true,
    },
  });

  if (!row) {
    return NextResponse.json({ error: "Coach group not found" }, { status: 404 });
  }

  const resolvedDates = getConfiguredTrainingDates({
    trainingDates: row.trainingDates,
    weekdays: row.trainingWeekdays.filter((v) => v >= 1 && v <= 7).sort((a, b) => a - b),
    windowDays: row.trainingWindowDays,
    timeZone: FIXED_TIME_ZONE,
    maxDays: TRAINING_SELECTION_WINDOW_DAYS,
  });

  const resolvedDateTimes = normalizeStoredTrainingDateTimes(row.trainingDateTimes, resolvedDates);
  const hasSchedule = row.trainingDates.length > 0 || row.trainingWeekdays.length > 0;

  return NextResponse.json({
    trainingDates: resolvedDates,
    trainingTime: row.trainingTime ?? null,
    trainingDurationMinutes: row.trainingDurationMinutes,
    trainingFieldId: row.trainingFieldId,
    trainingFieldPieceIds: row.trainingFieldPieceIds,
    trainingFieldSelections: normalizeStoredTrainingFieldSelections(
      row.trainingFieldSelections,
      resolvedDates,
      { trainingFieldId: row.trainingFieldId, trainingFieldPieceIds: row.trainingFieldPieceIds ?? [] },
    ),
    trainingDateTimes: resolvedDateTimes,
    trainingWeekdays: row.trainingWeekdays,
    trainingWindowDays: row.trainingWindowDays,
    hasSchedule,
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; groupId: string }> },
) {
  const session = await verifySession(request);
  if (!session) {
    return NextResponse.json({ error: "Нямате достъп." }, { status: 401 });
  }

  const { id: clubId, groupId } = await params;
  if (!UUID_REGEX.test(clubId) || !UUID_REGEX.test(groupId)) {
    return NextResponse.json({ error: "Coach group not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rawTrainingDates = (body as { trainingDates?: unknown }).trainingDates;
  const rawTrainingTime = (body as { trainingTime?: unknown }).trainingTime;
  const rawTrainingDateTimes = (body as { trainingDateTimes?: unknown }).trainingDateTimes;
  const rawTrainingDurationMinutes = (body as { trainingDurationMinutes?: unknown }).trainingDurationMinutes;
  const rawTrainingFieldId = (body as { trainingFieldId?: unknown }).trainingFieldId;
  const rawTrainingFieldPieceId = (body as { trainingFieldPieceIds?: unknown }).trainingFieldPieceIds;
  const rawTrainingFieldSelections = (body as { trainingFieldSelections?: unknown }).trainingFieldSelections;
  const rawWeekdays = (body as { trainingWeekdays?: unknown }).trainingWeekdays;
  const rawWindowDays = (body as { trainingWindowDays?: unknown }).trainingWindowDays;

  let trainingTime: string | null = null;
  let trainingDurationMinutes = 60;
  let trainingFieldSelection = { trainingFieldId: null as string | null, trainingFieldPieceIds: [] as string[] };
  try {
    trainingTime = normalizeTrainingTime(rawTrainingTime);
    trainingDurationMinutes = normalizeTrainingDurationMinutes(rawTrainingDurationMinutes);
    trainingFieldSelection = parseTrainingFieldSelection({
      trainingFieldId: rawTrainingFieldId,
      trainingFieldPieceIds: rawTrainingFieldPieceId,
    });
  } catch {
    return NextResponse.json({ error: "Invalid trainingTime, trainingDurationMinutes, or training field" }, { status: 400 });
  }

  let trainingDates: string[] = [];
  let trainingWeekdays: number[] = [];
  let trainingWindowDays = TRAINING_SELECTION_WINDOW_DAYS;

  if (Array.isArray(rawTrainingDates)) {
    const todayIso = getTodayIsoDateInTimeZone(FIXED_TIME_ZONE);
    const start = isoDateToUtcMidnight(todayIso).getTime();
    const end = start + (TRAINING_SELECTION_WINDOW_DAYS - 1) * 24 * 60 * 60 * 1000;

    for (const value of rawTrainingDates) {
      const date = String(value ?? "").trim();
      if (!isIsoDate(date)) {
        return NextResponse.json({ error: "Training dates must be valid ISO dates." }, { status: 400 });
      }
      const timestamp = isoDateToUtcMidnight(date).getTime();
      if (timestamp < start || timestamp > end) {
        return NextResponse.json(
          { error: `Training dates must be within the next ${TRAINING_SELECTION_WINDOW_DAYS} days.` },
          { status: 400 },
        );
      }
      trainingDates.push(date);
    }
    trainingDates = Array.from(new Set(trainingDates)).sort((a, b) => a.localeCompare(b));
  } else if (Array.isArray(rawWeekdays)) {
    trainingWeekdays = Array.from(
      new Set(
        rawWeekdays
          .map((v) => Number.parseInt(String(v), 10))
          .filter((v) => Number.isInteger(v) && v >= 1 && v <= 7),
      ),
    ).sort((a, b) => a - b);
    const parsedWindow = Number.parseInt(String(rawWindowDays ?? ""), 10);
    trainingWindowDays = Number.isInteger(parsedWindow) ? parsedWindow : TRAINING_SELECTION_WINDOW_DAYS;
    trainingDates = getConfiguredTrainingDates({
      weekdays: trainingWeekdays,
      windowDays: trainingWindowDays,
      timeZone: FIXED_TIME_ZONE,
      maxDays: TRAINING_SELECTION_WINDOW_DAYS,
    });
  }

  let trainingDateTimes: Record<string, string> = {};
  let trainingFieldSelections: Record<string, { trainingFieldId: string | null; trainingFieldPieceIds: string[] }> = {};
  try {
    const hasTrainingFields = trainingDates.length > 0 ? await clubHasTrainingFields(clubId) : false;
    if (!hasTrainingFields) {
      trainingFieldSelection = { trainingFieldId: null, trainingFieldPieceIds: [] };
    }
    if (trainingDates.length > 0) {
      if (hasTrainingFields && !trainingFieldSelection.trainingFieldId) {
        return NextResponse.json({ error: "Треньорът трябва да избере терен." }, { status: 400 });
      }
      trainingFieldSelections = parseTrainingFieldSelectionsByDate({
        trainingFieldSelections: rawTrainingFieldSelections,
        trainingDates,
        fallback: trainingFieldSelection,
      });
      if (hasTrainingFields) {
        await verifyTrainingFieldSelectionsByDate(clubId, trainingFieldSelections);
      }
    }
    trainingDateTimes = buildTrainingDateTimes({
      rawTrainingDateTimes,
      trainingDates,
      fallbackTrainingTime: trainingTime,
    });
    if (hasTrainingFields) {
      await assertNoTrainingFieldConflict({
        clubId,
        trainingDates,
        trainingDateTimes,
        trainingDurationMinutes,
        trainingFieldId: trainingFieldSelection.trainingFieldId,
        trainingFieldPieceIds: trainingFieldSelection.trainingFieldPieceIds,
        trainingFieldSelections,
        exclude: { type: "coachGroup", id: groupId },
      });
    } else {
      await assertNoTrainingTimeConflict({
        clubId,
        trainingDates,
        trainingDateTimes,
        trainingDurationMinutes,
        exclude: { type: "coachGroup", id: groupId },
      });
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid trainingDateTimes" },
      { status: 400 },
    );
  }

  const result = await prisma.coachGroup.updateMany({
    where: { id: groupId, clubId },
    data: {
      trainingDates,
      trainingWeekdays,
      trainingTime,
      trainingDurationMinutes,
      trainingFieldId: trainingFieldSelection.trainingFieldId,
      trainingFieldPieceIds: trainingFieldSelection.trainingFieldPieceIds,
      trainingFieldSelections,
      trainingDateTimes,
      trainingWindowDays,
    },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Coach group not found" }, { status: 404 });
  }

  const resolvedDates = getConfiguredTrainingDates({
    trainingDates,
    weekdays: trainingWeekdays,
    windowDays: trainingWindowDays,
    timeZone: FIXED_TIME_ZONE,
    maxDays: TRAINING_SELECTION_WINDOW_DAYS,
  });
  const resolvedDateTimes = normalizeStoredTrainingDateTimes(trainingDateTimes, resolvedDates);
  const hasSchedule = trainingDates.length > 0 || trainingWeekdays.length > 0;

  return NextResponse.json({
    trainingDates: resolvedDates,
    trainingTime,
    trainingDurationMinutes,
    trainingFieldId: trainingFieldSelection.trainingFieldId,
    trainingFieldPieceIds: trainingFieldSelection.trainingFieldPieceIds,
    trainingFieldSelections,
    trainingDateTimes: resolvedDateTimes,
    trainingWeekdays,
    trainingWindowDays,
    hasSchedule,
  });
}
