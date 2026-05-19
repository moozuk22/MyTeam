import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyAdminToken } from "@/lib/adminAuth";
import { buildNotificationPayload } from "@/lib/push/templates";
import { saveMemberNotificationHistory } from "@/lib/push/history";
import { sendPushToMember } from "@/lib/push/service";
import { publishMemberUpdated } from "@/lib/memberEvents";
import {
  normalizeToDayStart,
  normalizeToMonthStart,
  getRollingThirtyDayPaymentWindow,
  toYearMonth,
  compareYearMonth,
} from "@/lib/paymentStatus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    const body = await request.json().catch(() => ({}));
    const paidFor = (body as { paidFor?: unknown }).paidFor;
    const remainingTrainingsRaw = (body as { remainingTrainings?: unknown }).remainingTrainings;

    if (!paidFor) {
      return NextResponse.json(
        { error: "paidFor is required" },
        { status: 400 }
      );
    }

    const parsedPaidFor = new Date(String(paidFor));
    if (isNaN(parsedPaidFor.getTime())) {
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
          orderBy: { paidFor: "desc" },
          take: 1,
        },
        cards: {
          where: { isActive: true },
          select: { cardCode: true },
          take: 1,
        },
        club: {
          select: { paymentWorkflow: true },
        },
      },
    });

    if (!player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    const isRollingThirtyDay = player.club.paymentWorkflow === "rolling_30_days";
    const isTrainingCredits = player.club.paymentWorkflow === "training_credits";
    const paidForDate = isRollingThirtyDay || isTrainingCredits
      ? normalizeToDayStart(parsedPaidFor)
      : normalizeToMonthStart(parsedPaidFor);

    if (player.firstBillingMonth) {
      const isBeforeBillingStart = isRollingThirtyDay || isTrainingCredits
        ? paidForDate < normalizeToDayStart(player.firstBillingMonth)
        : compareYearMonth(toYearMonth(paidForDate), toYearMonth(player.firstBillingMonth)) < 0;
      if (isBeforeBillingStart) {
        return NextResponse.json(
          { error: isRollingThirtyDay || isTrainingCredits ? "Cannot record payment before billing start date" : "Cannot record payment before billing start month" },
          { status: 400 },
        );
      }
    }

    let remainingTrainingCreditsUpdate: number | undefined;
    if (isTrainingCredits) {
      const parsedRemainingTrainings = Number(remainingTrainingsRaw);
      if (!Number.isInteger(parsedRemainingTrainings) || parsedRemainingTrainings < 1 || parsedRemainingTrainings > 999) {
        return NextResponse.json(
          { error: "remainingTrainings must be a whole number greater than 0" },
          { status: 400 },
        );
      }
      remainingTrainingCreditsUpdate = parsedRemainingTrainings;
    }

    if (isRollingThirtyDay) {
      const activeWindow = getRollingThirtyDayPaymentWindow({
        paidDates: player.paymentLogs.map((log) => log.paidFor),
      });
      if (activeWindow && activeWindow.remainingDays > 0) {
        return NextResponse.json(
          {
            error: `Membership is already paid for ${activeWindow.remainingDays} more ${activeWindow.remainingDays === 1 ? "day" : "days"}.`,
            remainingDays: activeWindow.remainingDays,
            paidUntil: activeWindow.paidUntil,
          },
          { status: 400 },
        );
      }
    }

    // Check if this month/year is already paid
    const existingPayment = await prisma.paymentLog.findFirst({
      where: {
        playerId: id,
        paidFor: paidForDate,
      },
    });
    const existingWaiver = await prisma.paymentWaiver.findFirst({
      where: {
        playerId: id,
        waivedFor: paidForDate,
      },
      select: { id: true },
    });

    if (existingPayment) {
      return NextResponse.json(
        { error: `Този период (${paidForDate.toLocaleDateString("bg-BG")}) вече е платен` },
        { status: 400 }
      );
    }

    if (existingWaiver) {
      return NextResponse.json(
        { error: "Cannot record payment for a waived month. Remove pause first." },
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

    // Update player's last payment date
    await prisma.player.update({
      where: { id },
      data: {
        status: "paid",
        lastPaymentDate: new Date(),
        ...(remainingTrainingCreditsUpdate !== undefined
          ? { remainingTrainingCredits: remainingTrainingCreditsUpdate }
          : {}),
      },
    });

    const memberUrl = player.cards[0]?.cardCode
      ? `/member/${player.cards[0].cardCode}`
      : "/";
    const paidForLabel = paidForDate.toLocaleDateString("bg-BG", {
      day: isRollingThirtyDay ? "2-digit" : undefined,
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

    const targetCardCode = player.cards[0]?.cardCode;
    if (targetCardCode) {
      publishMemberUpdated(targetCardCode, "status-updated");
      publishMemberUpdated(targetCardCode, "payment-history-updated");
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

    // Get all payment logs and waived months for this player
    const [paymentLogs, waivedMonths] = await Promise.all([
      prisma.paymentLog.findMany({
        where: { playerId: id },
        orderBy: { paidAt: "desc" },
        select: {
          id: true,
          paidFor: true,
          paidAt: true,
          recordedBy: true,
        },
      }),
      prisma.paymentWaiver.findMany({
        where: { playerId: id },
        orderBy: { waivedFor: "desc" },
        select: {
          id: true,
          waivedFor: true,
          reason: true,
          createdBy: true,
          createdAt: true,
        },
      }),
    ]);

    return NextResponse.json({
      payments: paymentLogs,
      waivedMonths,
    });

  } catch (error) {
    console.error("Payment fetch error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
