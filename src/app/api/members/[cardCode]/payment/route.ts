import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildNotificationPayload } from "@/lib/push/templates";
import { saveMemberNotificationHistory } from "@/lib/push/history";
import { sendPushToMember } from "@/lib/push/service";
import { publishMemberUpdated } from "@/lib/memberEvents";
import {
  addMonths,
  compareYearMonth,
  normalizeToMonthStart,
  toMonthKey,
  toYearMonth,
  type YearMonth,
} from "@/lib/paymentStatus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function ymToDate(ym: YearMonth): Date {
  return new Date(Date.UTC(ym.year, ym.month, 1));
}

function formatPaidMonthLabel(date: Date): string {
  return date.toLocaleDateString("bg-BG", {
    month: "long",
    year: "numeric",
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ cardCode: string }> },
) {
  try {
    const { cardCode } = await params;
    const normalizedCardCode = cardCode.trim().toUpperCase();
    const body = await request.json().catch(() => ({}));
    const paidForRaw = (body as { paidFor?: unknown }).paidFor;

    if (!paidForRaw) {
      return NextResponse.json({ error: "paidFor is required" }, { status: 400 });
    }

    const paidForDate = normalizeToMonthStart(new Date(String(paidForRaw)));
    if (Number.isNaN(paidForDate.getTime())) {
      return NextResponse.json(
        { error: "paidFor must be a valid date" },
        { status: 400 },
      );
    }

    const card = await prisma.card.findFirst({
      where: {
        cardCode: normalizedCardCode,
        isActive: true,
      },
      select: {
        playerId: true,
      },
    });

    if (!card) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const [existingLogs, existingWaivers] = await Promise.all([
      prisma.paymentLog.findMany({
        where: { playerId: card.playerId },
        select: { paidFor: true },
        orderBy: { paidFor: "asc" },
      }),
      prisma.paymentWaiver.findMany({
        where: { playerId: card.playerId },
        select: { waivedFor: true },
      }),
    ]);

    const targetYM = toYearMonth(paidForDate);
    const paidSet = new Set(existingLogs.map((log) => toMonthKey(toYearMonth(log.paidFor))));
    const waivedSet = new Set(existingWaivers.map((row) => toMonthKey(toYearMonth(row.waivedFor))));
    const settledSet = new Set<string>([...paidSet, ...waivedSet]);

    const firstUnpaidYM: YearMonth = (() => {
      if (existingLogs.length === 0) {
        const now = new Date();
        return { year: now.getFullYear(), month: now.getMonth() };
      }
      const latestPaid = toYearMonth(existingLogs[existingLogs.length - 1].paidFor);
      let cursor = addMonths(latestPaid, 1);
      while (settledSet.has(toMonthKey(cursor))) {
        cursor = addMonths(cursor, 1);
      }
      return cursor;
    })();

    if (compareYearMonth(targetYM, firstUnpaidYM) < 0) {
      return NextResponse.json(
        { error: "Selected month is before the next unpaid month" },
        { status: 400 },
      );
    }

    const monthsToCreate: Date[] = [];
    let cursor = firstUnpaidYM;
    while (compareYearMonth(cursor, targetYM) <= 0) {
      if (!paidSet.has(toMonthKey(cursor)) && !waivedSet.has(toMonthKey(cursor))) {
        monthsToCreate.push(ymToDate(cursor));
      }
      cursor = addMonths(cursor, 1);
    }

    if (monthsToCreate.length === 0) {
      return NextResponse.json({ error: "This period is already paid" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.paymentLog.createMany({
        data: monthsToCreate.map((date) => ({
          playerId: card.playerId,
          paidFor: date,
          recordedBy: "member",
        })),
      });

      await tx.player.update({
        where: { id: card.playerId },
        data: {
          lastPaymentDate: new Date(),
        },
      });
    });

    const player = await prisma.player.findUnique({
      where: { id: card.playerId },
      select: {
        id: true,
        fullName: true,
        cards: {
          where: { isActive: true },
          select: { cardCode: true },
          take: 1,
        },
      },
    });

    let pushResult = { total: 0, sent: 0, failed: 0, deactivated: 0 };
    if (player) {
      const targetCardCode = player.cards[0]?.cardCode ?? normalizedCardCode;
      const firstPaidDate = monthsToCreate[0];
      const lastPaidDate = monthsToCreate[monthsToCreate.length - 1];
      const trainerMessage =
        monthsToCreate.length > 1
          ? `Благодарим Ви! Вие успешно заплатихте членския си внос за периода ${formatPaidMonthLabel(firstPaidDate)} - ${formatPaidMonthLabel(lastPaidDate)}.`
          : `Благодарим Ви! Вие успешно заплатихте месечния си членски внос за ${formatPaidMonthLabel(firstPaidDate)}.`;
      const payload = buildNotificationPayload({
        type: "trainer_message",
        memberName: player.fullName.trim(),
        trainerMessage,
        url: `/member/${targetCardCode}`,
      });

      try {
        pushResult = await sendPushToMember(player.id, payload);
        if (pushResult.sent > 0) {
          await saveMemberNotificationHistory(player.id, "trainer_message", payload);
        }
      } catch (pushError) {
        // Payment should remain successful even if push delivery fails.
        console.error("Member payment push send error:", pushError);
      }
    }

    const createdPayments = await prisma.paymentLog.findMany({
      where: {
        playerId: card.playerId,
        paidFor: {
          in: monthsToCreate,
        },
      },
      orderBy: { paidFor: "asc" },
      select: {
        id: true,
        paidFor: true,
        paidAt: true,
      },
    });

    publishMemberUpdated(normalizedCardCode, "status-updated");

    return NextResponse.json({
      success: true,
      createdCount: createdPayments.length,
      payments: createdPayments,
      push: pushResult,
    });
  } catch (error) {
    console.error("Member payment creation error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
