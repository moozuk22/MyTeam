import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";
import { publishMemberUpdated } from "@/lib/memberEvents";
import { buildNotificationPayload } from "@/lib/push/templates";
import { saveMemberNotificationHistory } from "@/lib/push/history";
import { sendPushToMember } from "@/lib/push/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ cardCode: string }> },
) {
  const token = request.cookies.get("admin_session")?.value;
  const payload = token ? await verifyAdminToken(token) : null;

  if (!payload || (!payload.roles.includes("admin") && !payload.roles.includes("coach"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { cardCode } = await params;
    const normalizedCardCode = cardCode.trim().toUpperCase();

    const card = await prisma.card.findFirst({
      where: {
        cardCode: normalizedCardCode,
        isActive: true,
      },
      select: {
        playerId: true,
        player: {
          select: {
            fullName: true,
            remainingTrainingCredits: true,
            club: {
              select: {
                paymentWorkflow: true,
              },
            },
          },
        },
      },
    });

    if (!card) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    if (card.player.club.paymentWorkflow !== "training_credits") {
      return NextResponse.json(
        { error: "Training check-in is available only for training credits payment workflow" },
        { status: 400 },
      );
    }

    if (card.player.remainingTrainingCredits <= 0) {
      return NextResponse.json(
        { error: "No remaining trainings for this player", remainingTrainingCredits: 0 },
        { status: 400 },
      );
    }

    const updatedPlayer = await prisma.player.update({
      where: { id: card.playerId },
      data: {
        remainingTrainingCredits: { decrement: 1 },
        status: card.player.remainingTrainingCredits - 1 > 0 ? "paid" : "overdue",
      },
      select: {
        remainingTrainingCredits: true,
        status: true,
      },
    });

    publishMemberUpdated(normalizedCardCode, "status-updated");

    const pushPayload = buildNotificationPayload({
      type: "trainer_message",
      memberName: card.player.fullName.trim(),
      trainerMessage:
        updatedPlayer.remainingTrainingCredits > 0
          ? `Отчетена е тренировка. Остават ${updatedPlayer.remainingTrainingCredits} тренировки.`
          : "Отчетена е тренировка. Нямате оставащи тренировки.",
      url: `/member/${normalizedCardCode}`,
    });

    let pushResult = { total: 0, sent: 0, failed: 0, deactivated: 0 };
    try {
      await saveMemberNotificationHistory(card.playerId, "trainer_message", pushPayload);
      pushResult = await sendPushToMember(card.playerId, pushPayload);
    } catch (pushError) {
      // Check-in should remain successful even if notification delivery fails.
      console.error("Training credit check-in notification error:", pushError);
    }

    return NextResponse.json({
      success: true,
      remainingTrainingCredits: updatedPlayer.remainingTrainingCredits,
      status: updatedPlayer.remainingTrainingCredits > 0 ? "paid" : "overdue",
      push: pushResult,
    });
  } catch (error) {
    console.error("Training credit check-in error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
