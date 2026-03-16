import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ cardCode: string }> }
) {
  const { cardCode } = await params;

  try {
    const card = await prisma.card.findFirst({
      where: {
        cardCode,
        isActive: true,
      },
      select: { playerId: true },
    });

    if (!card) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const notifications = await prisma.playerNotification.findMany({
      where: {
        playerId: card.playerId,
      },
      orderBy: {
        sentAt: "desc",
      },
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        url: true,
        sentAt: true,
        readAt: true,
      },
    });

    const unreadCount = await prisma.playerNotification.count({
      where: {
        playerId: card.playerId,
        readAt: null,
      },
    });

    return NextResponse.json({
      notifications,
      unreadCount,
    });
  } catch (error) {
    console.error("Fetch notifications error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
