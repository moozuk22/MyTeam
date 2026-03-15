import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyAdminToken } from "@/lib/adminAuth";
import { buildNotificationPayload } from "@/lib/push/templates";
import { saveMemberNotificationHistory } from "@/lib/push/history";
import { sendPushToMember } from "@/lib/push/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type YM = { year: number; month: number };

function toYM(date: Date): YM {
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() };
}

function cmpYM(a: YM, b: YM): number {
  if (a.year !== b.year) return a.year - b.year;
  return a.month - b.month;
}

function addMonths(ym: YM, count: number): YM {
  const d = new Date(Date.UTC(ym.year, ym.month + count, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
}

function resolveStatusForLatestPaidMonth(latestPaidDate: Date): "paid" | "warning" | "overdue" {
  const latestPaidYM = toYM(latestPaidDate);
  const currentYM = toYM(new Date());
  const previousYM = addMonths(currentYM, -1);

  if (cmpYM(latestPaidYM, currentYM) >= 0) return "paid";
  if (cmpYM(latestPaidYM, previousYM) >= 0) return "warning";
  return "overdue";
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get("admin_session")?.value;

  if (!token || !(await verifyAdminToken(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const { paidFor } = await request.json();

    if (!paidFor) {
      return NextResponse.json(
        { error: "paidFor is required" },
        { status: 400 }
      );
    }

    // Validate that paidFor is a valid date
    const paidForDate = new Date(paidFor);
    if (isNaN(paidForDate.getTime())) {
      return NextResponse.json(
        { error: "paidFor must be a valid date" },
        { status: 400 }
      );
    }

    // Check if player exists
    const player = await prisma.player.findUnique({
      where: { id },
      include: {
        paymentLogs: {
          orderBy: { paidAt: "desc" },
          take: 1,
        },
        cards: {
          where: { isActive: true },
          select: { cardCode: true },
          take: 1,
        },
      },
    });

    if (!player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    // Check if this month/year is already paid
    const existingPayment = await prisma.paymentLog.findFirst({
      where: {
        playerId: id,
        paidFor: paidForDate,
      },
    });

    if (existingPayment) {
      return NextResponse.json(
        { error: `Този период (${paidForDate.toLocaleDateString("bg-BG")}) вече е платен` },
        { status: 400 }
      );
    }

    // Create payment log
    const paymentLog = await prisma.paymentLog.create({
      data: {
        playerId: id,
        paidFor: paidForDate,
        recordedBy: "admin",
      },
    });

    const latestPaymentAfterInsert = await prisma.paymentLog.findFirst({
      where: { playerId: id },
      orderBy: { paidFor: "desc" },
      select: { paidFor: true },
    });

    if (!latestPaymentAfterInsert) {
      throw new Error("Latest payment could not be resolved after insert.");
    }

    // Update player's last payment date and status
    await prisma.player.update({
      where: { id },
      data: {
        lastPaymentDate: new Date(),
        status: resolveStatusForLatestPaidMonth(latestPaymentAfterInsert.paidFor),
      },
    });

    const memberUrl = player.cards[0]?.cardCode
      ? `/member/${player.cards[0].cardCode}`
      : "/";
    const paidForLabel = paidForDate.toLocaleDateString("bg-BG", {
      month: "long",
      year: "numeric",
    });

    const pushPayload = buildNotificationPayload({
      type: "trainer_message",
      memberName: player.fullName.trim(),
      trainerMessage: `Плащането за месец ${paidForLabel} е отчетено успешно.`,
      url: memberUrl,
    });

    let pushResult = { total: 0, sent: 0, failed: 0, deactivated: 0 };
    try {
      pushResult = await sendPushToMember(player.id, pushPayload);
      if (pushResult.sent > 0) {
        await saveMemberNotificationHistory(player.id, "trainer_message", pushPayload);
      }
    } catch (pushError) {
      // Payment should not fail because push delivery failed.
      console.error("Payment push send error:", pushError);
    }

    return NextResponse.json({
      success: true,
      payment: {
        id: paymentLog.id,
        paidFor: paymentLog.paidFor,
        paidAt: paymentLog.paidAt,
      },
      push: pushResult,
    });

  } catch (error) {
    console.error("Payment creation error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get("admin_session")?.value;

  if (!token || !(await verifyAdminToken(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;

    // Get all payment logs for this player
    const paymentLogs = await prisma.paymentLog.findMany({
      where: { playerId: id },
      orderBy: { paidAt: "desc" },
      select: {
        id: true,
        paidFor: true,
        paidAt: true,
        recordedBy: true,
      },
    });

    return NextResponse.json({
      payments: paymentLogs,
    });

  } catch (error) {
    console.error("Payment fetch error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
