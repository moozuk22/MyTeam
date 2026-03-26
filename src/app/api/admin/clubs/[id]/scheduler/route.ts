import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyAdminToken } from "@/lib/adminAuth";
import {
  getConfiguredTrainingDates,
  getTodayIsoDateInTimeZone,
  getWeekdayMondayFirst,
  isIsoDate,
  isoDateToUtcMidnight,
} from "@/lib/training";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const FIXED_TIME_ZONE = "Europe/Sofia";
const TRAINING_SELECTION_WINDOW_DAYS = 30;

function parseTeamGroupValue(raw: unknown): number | null {
  if (raw === null || raw === undefined || String(raw).trim() === "") {
    return null;
  }
  const parsed = Number.parseInt(String(raw).trim(), 10);
  if (!Number.isInteger(parsed)) {
    throw new Error("Invalid teamGroup");
  }
  return parsed;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = request.cookies.get("admin_session")?.value;
  if (!token || !(await verifyAdminToken(token))) {
    return NextResponse.json({ error: "\u041d\u044f\u043c\u0430\u0442\u0435 \u0434\u043e\u0441\u0442\u044a\u043f." }, { status: 401 });
  }

  const { id } = await params;
  const teamGroupRaw = request.nextUrl.searchParams.get("teamGroup");
  let teamGroup: number | null = null;
  try {
    teamGroup = parseTeamGroupValue(teamGroupRaw);
  } catch {
    return NextResponse.json({ error: "Invalid teamGroup" }, { status: 400 });
  }

  const club = await prisma.club.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      reminderDay: true,
      overdueDay: true,
      reminderHour: true,
      reminderMinute: true,
      overdueHour: true,
      overdueMinute: true,
      trainingDates: true,
      trainingWeekdays: true,
      trainingWindowDays: true,
    },
  });

  if (!club) {
    return NextResponse.json({ error: "\u041e\u0442\u0431\u043e\u0440\u044a\u0442 \u043d\u0435 \u0435 \u043d\u0430\u043c\u0435\u0440\u0435\u043d." }, { status: 404 });
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

  const trainingDates = getConfiguredTrainingDates({
    trainingDates: groupSchedule?.trainingDates ?? club.trainingDates,
    weekdays: groupSchedule?.trainingWeekdays ?? club.trainingWeekdays,
    windowDays: groupSchedule?.trainingWindowDays ?? club.trainingWindowDays,
    timeZone: FIXED_TIME_ZONE,
    maxDays: TRAINING_SELECTION_WINDOW_DAYS,
  });

  return NextResponse.json({
    ...club,
    teamGroup,
    trainingDates,
    trainingWindowDays: TRAINING_SELECTION_WINDOW_DAYS,
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = request.cookies.get("admin_session")?.value;
  const session = token ? await verifyAdminToken(token) : null;
  if (!session) {
    return NextResponse.json({ error: "\u041d\u044f\u043c\u0430\u0442\u0435 \u0434\u043e\u0441\u0442\u044a\u043f." }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const reminderDay = Number.parseInt(String((body as { reminderDay?: unknown }).reminderDay ?? ""), 10);
  const overdueDay = Number.parseInt(String((body as { overdueDay?: unknown }).overdueDay ?? ""), 10);
  const reminderHour = Number.parseInt(String((body as { reminderHour?: unknown }).reminderHour ?? ""), 10);
  const reminderMinute = Number.parseInt(String((body as { reminderMinute?: unknown }).reminderMinute ?? ""), 10);
  const overdueHour = Number.parseInt(String((body as { overdueHour?: unknown }).overdueHour ?? ""), 10);
  const overdueMinute = Number.parseInt(String((body as { overdueMinute?: unknown }).overdueMinute ?? ""), 10);
  const rawTrainingDates = (body as { trainingDates?: unknown }).trainingDates;
  const rawWeekdays = (body as { trainingWeekdays?: unknown }).trainingWeekdays;
  const rawWindowDays = Number.parseInt(String((body as { trainingWindowDays?: unknown }).trainingWindowDays ?? ""), 10);
  const rawTeamGroup = (body as { teamGroup?: unknown }).teamGroup;

  let teamGroup: number | null = null;
  try {
    teamGroup = parseTeamGroupValue(rawTeamGroup);
  } catch {
    return NextResponse.json({ error: "Invalid teamGroup" }, { status: 400 });
  }

  if (!Number.isInteger(reminderDay) || reminderDay < 1 || reminderDay > 28) {
    return NextResponse.json({ error: "\u0414\u0435\u043d\u044f\u0442 \u0437\u0430 \u043c\u0435\u0441\u0435\u0447\u043d\u043e \u043d\u0430\u043f\u043e\u043c\u043d\u044f\u043d\u0435 \u0442\u0440\u044f\u0431\u0432\u0430 \u0434\u0430 \u0435 \u043c\u0435\u0436\u0434\u0443 1 \u0438 28." }, { status: 400 });
  }
  if (!Number.isInteger(overdueDay) || overdueDay < 1 || overdueDay > 28) {
    return NextResponse.json({ error: "\u0414\u0435\u043d\u044f\u0442 \u0437\u0430 \u043f\u0440\u043e\u0441\u0440\u043e\u0447\u0438\u0435 \u0442\u0440\u044f\u0431\u0432\u0430 \u0434\u0430 \u0435 \u043c\u0435\u0436\u0434\u0443 1 \u0438 28." }, { status: 400 });
  }
  if (!Number.isInteger(reminderHour) || reminderHour < 0 || reminderHour > 23) {
    return NextResponse.json({ error: "\u0427\u0430\u0441\u044a\u0442 \u0442\u0440\u044f\u0431\u0432\u0430 \u0434\u0430 \u0435 \u043c\u0435\u0436\u0434\u0443 0 \u0438 23." }, { status: 400 });
  }
  if (!Number.isInteger(reminderMinute) || reminderMinute < 0 || reminderMinute > 59) {
    return NextResponse.json({ error: "\u041c\u0438\u043d\u0443\u0442\u0438\u0442\u0435 \u0437\u0430 \u043c\u0435\u0441\u0435\u0447\u043d\u043e \u043d\u0430\u043f\u043e\u043c\u043d\u044f\u043d\u0435 \u0442\u0440\u044f\u0431\u0432\u0430 \u0434\u0430 \u0441\u0430 \u043c\u0435\u0436\u0434\u0443 0 \u0438 59." }, { status: 400 });
  }
  if (!Number.isInteger(overdueHour) || overdueHour < 0 || overdueHour > 23) {
    return NextResponse.json({ error: "\u0427\u0430\u0441\u044a\u0442 \u0437\u0430 \u043f\u0440\u043e\u0441\u0440\u043e\u0447\u0438\u0435 \u0442\u0440\u044f\u0431\u0432\u0430 \u0434\u0430 \u0435 \u043c\u0435\u0436\u0434\u0443 0 \u0438 23." }, { status: 400 });
  }
  if (!Number.isInteger(overdueMinute) || overdueMinute < 0 || overdueMinute > 59) {
    return NextResponse.json({ error: "\u041c\u0438\u043d\u0443\u0442\u0438\u0442\u0435 \u0437\u0430 \u043f\u0440\u043e\u0441\u0440\u043e\u0447\u0438\u0435 \u0442\u0440\u044f\u0431\u0432\u0430 \u0434\u0430 \u0441\u0430 \u043c\u0435\u0436\u0434\u0443 0 \u0438 59." }, { status: 400 });
  }

  let trainingDates: string[] = [];
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
  } else {
    const trainingWeekdays = Array.isArray(rawWeekdays)
      ? Array.from(
          new Set(
            rawWeekdays
              .map((value) => Number.parseInt(String(value), 10))
              .filter((value) => Number.isInteger(value) && value >= 1 && value <= 7),
          ),
        ).sort((a, b) => a - b)
      : [];
    const trainingWindowDays = Number.isInteger(rawWindowDays) ? rawWindowDays : TRAINING_SELECTION_WINDOW_DAYS;
    trainingDates = getConfiguredTrainingDates({
      weekdays: trainingWeekdays,
      windowDays: trainingWindowDays,
      timeZone: FIXED_TIME_ZONE,
      maxDays: TRAINING_SELECTION_WINDOW_DAYS,
    });
  }

  const trainingWeekdays = Array.from(
    new Set(trainingDates.map((date) => getWeekdayMondayFirst(date, FIXED_TIME_ZONE)).filter((value) => value >= 1 && value <= 7)),
  ).sort((a, b) => a - b);

  const updated = await prisma.club.update({
    where: { id },
    data: {
      reminderDay,
      overdueDay,
      reminderHour,
      reminderMinute,
      overdueHour,
      overdueMinute,
      reminderTz: FIXED_TIME_ZONE,
      ...(teamGroup === null
        ? {
            trainingDates,
            trainingWeekdays,
            trainingWindowDays: TRAINING_SELECTION_WINDOW_DAYS,
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      reminderDay: true,
      overdueDay: true,
      reminderHour: true,
      reminderMinute: true,
      overdueHour: true,
      overdueMinute: true,
      trainingDates: true,
      trainingWeekdays: true,
      trainingWindowDays: true,
    },
  });

  if (teamGroup !== null) {
    await prisma.clubTrainingGroupSchedule.upsert({
      where: {
        clubId_teamGroup: {
          clubId: id,
          teamGroup,
        },
      },
      update: {
        trainingDates,
        trainingWeekdays,
        trainingWindowDays: TRAINING_SELECTION_WINDOW_DAYS,
      },
      create: {
        clubId: id,
        teamGroup,
        trainingDates,
        trainingWeekdays,
        trainingWindowDays: TRAINING_SELECTION_WINDOW_DAYS,
      },
    });
  }

  return NextResponse.json({
    ...updated,
    teamGroup,
    trainingDates,
    trainingWindowDays: TRAINING_SELECTION_WINDOW_DAYS,
  });
}
