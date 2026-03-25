import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
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
          clubId: true,
          club: {
            select: {
              id: true,
              trainingDates: true,
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

  const trainingWeekdays = (card.player.club.trainingWeekdays ?? [])
    .filter((value) => Number.isInteger(value) && value >= 1 && value <= 7)
    .sort((a, b) => a - b);
  const trainingWindowDays = TRAINING_SELECTION_WINDOW_DAYS;

  const upcomingDates = getConfiguredTrainingDates({
    trainingDates: card.player.club.trainingDates ?? [],
    weekdays: trainingWeekdays,
    windowDays: card.player.club.trainingWindowDays ?? trainingWindowDays,
    timeZone: FIXED_TIME_ZONE,
    maxDays: TRAINING_SELECTION_WINDOW_DAYS,
  });

  return {
    cardCode: card.cardCode,
    playerId: card.playerId,
    clubId: card.player.clubId,
    trainingWeekdays,
    trainingWindowDays,
    upcomingDates,
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

  const optOutRows = await prisma.trainingOptOut.findMany({
    where: {
      playerId: context.playerId,
      trainingDate: {
        in: context.upcomingDates.map((value) => isoDateToUtcMidnight(value)),
      },
    },
    select: {
      trainingDate: true,
    },
  });
  const optedOutSet = new Set(optOutRows.map((item) => utcDateToIsoDate(item.trainingDate)));

  return NextResponse.json({
    clubId: context.clubId,
    cardCode: context.cardCode,
    trainingWeekdays: context.trainingWeekdays,
    trainingWindowDays: context.trainingWindowDays,
    dates: context.upcomingDates.map((date) => ({
      date,
      weekday: getWeekdayMondayFirst(date, FIXED_TIME_ZONE),
      optedOut: optedOutSet.has(date),
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

  return NextResponse.json({ success: true, trainingDate, optedOut: true });
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

  return NextResponse.json({ success: true, trainingDate, optedOut: false });
}
