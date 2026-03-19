import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { saveMemberNotificationHistory } from "@/lib/push/history";
import { buildNotificationPayload } from "@/lib/push/templates";
import { sendPushToMember } from "@/lib/push/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ cardCode: string }> }
) {
  const { cardCode } = await params;
  const normalizedCardCode = cardCode.trim().toUpperCase();

  try {
    const card = await prisma.card.findFirst({
      where: {
        cardCode: normalizedCardCode,
        isActive: true,
      },
      include: {
        player: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    if (!card) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const memberName = card.player.fullName.trim();

    const payload = buildNotificationPayload({
      type: "trainer_message",
      memberName,
      trainerMessage: "Тестово известие: push notifications работят.",
      url: `/member/${normalizedCardCode}`,
    });

    const result = await sendPushToMember(card.player.id, payload);
    if (result.sent > 0) {
      await saveMemberNotificationHistory(card.player.id, "trainer_message", payload);
    }

    return NextResponse.json({
      success: true,
      ...result,
      memberId: card.player.id,
    });
  } catch (error) {
    console.error("Push test send error:", error);
    return NextResponse.json(
      { error: "Failed to send test notification" },
      { status: 500 }
    );
  }
}
