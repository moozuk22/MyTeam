import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildNotificationPayload } from "@/lib/push/templates";
import { saveMemberNotificationHistory } from "@/lib/push/history";
import { sendPushToMember } from "@/lib/push/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type YM = { year: number; month: number };

function toYM(date: Date): YM {
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() };
}

function ymKey(ym: YM): string {
  return `${ym.year}-${ym.month}`;
}

function cmpYM(a: YM, b: YM): number {
  if (a.year !== b.year) return a.year - b.year;
  return a.month - b.month;
}

function addMonths(ym: YM, count: number): YM {
  const d = new Date(Date.UTC(ym.year, ym.month + count, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
}

function ymToDate(ym: YM): Date {
  return new Date(Date.UTC(ym.year, ym.month, 1));
}

function resolveStatusForLatestPaidMonth(latestPaidYM: YM): "paid" | "warning" | "overdue" {
  const now = new Date();
  const currentYM: YM = { year: now.getUTCFullYear(), month: now.getUTCMonth() };
  const previousYM = addMonths(currentYM, -1);

  if (cmpYM(latestPaidYM, currentYM) >= 0) return "paid";
  if (cmpYM(latestPaidYM, previousYM) >= 0) return "warning";
  return "overdue";
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

    const paidForDate = new Date(String(paidForRaw));
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

    const existingLogs = await prisma.paymentLog.findMany({
      where: { playerId: card.playerId },
      select: { paidFor: true },
      orderBy: { paidFor: "asc" },
    });

    const targetYM = toYM(paidForDate);
    const paidSet = new Set(existingLogs.map((log) => ymKey(toYM(log.paidFor))));

    const firstUnpaidYM: YM = (() => {
      if (existingLogs.length === 0) {
        const now = new Date();
        return { year: now.getFullYear(), month: now.getMonth() };
      }
      const latestPaid = toYM(existingLogs[existingLogs.length - 1].paidFor);
      return addMonths(latestPaid, 1);
    })();

    if (cmpYM(targetYM, firstUnpaidYM) < 0) {
      return NextResponse.json(
        { error: "Selected month is before the next unpaid month" },
        { status: 400 },
      );
    }

    const monthsToCreate: Date[] = [];
    let cursor = firstUnpaidYM;
    while (cmpYM(cursor, targetYM) <= 0) {
      if (!paidSet.has(ymKey(cursor))) {
        monthsToCreate.push(ymToDate(cursor));
      }
      cursor = addMonths(cursor, 1);
    }

    if (monthsToCreate.length === 0) {
      return NextResponse.json({ error: "This period is already paid" }, { status: 400 });
    }

    const nextStatus = resolveStatusForLatestPaidMonth(targetYM);

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
          status: nextStatus,
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
