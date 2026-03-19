import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildCloudinaryUrlFromUploadPath } from "@/lib/cloudinaryImagePath";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ cardCode: string }> }
) {
  const { cardCode } = await params;
  const normalizedCardCode = cardCode.trim().toUpperCase();
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  try {
    const card = await prisma.card.findFirst({
      where: {
        cardCode: normalizedCardCode,
        isActive: true,
      },
      include: {
        player: true,
      },
    });

    if (!card) {
      return NextResponse.json(
        { error: "Member not found" },
        {
          status: 404,
          headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" },
        }
      );
    }

    let notifications: {
      id: string;
      type: string;
      title: string;
      body: string;
      url: string | null;
      sentAt: Date;
      readAt: Date | null;
    }[] = [];
    let unreadCount = 0;

    try {
      const [items, count] = await Promise.all([
        prisma.playerNotification.findMany({
          where: {
            playerId: card.player.id,
            sentAt: {
              gte: oneWeekAgo,
            },
          },
          orderBy: { sentAt: "desc" },
          take: 20,
        }),
        prisma.playerNotification.count({
          where: {
            playerId: card.player.id,
            readAt: null,
            sentAt: {
              gte: oneWeekAgo,
            },
          },
        }),
      ]);
      notifications = items;
      unreadCount = count;
    } catch (notificationError) {
      // Keep profile available if notification history table is not migrated yet.
      const code =
        typeof notificationError === "object" &&
        notificationError !== null &&
        "code" in notificationError
          ? String((notificationError as { code?: unknown }).code)
          : "";

      if (code !== "P2021") {
        console.error("Notification history unavailable:", notificationError);
      }
    }

    const paymentLogs = await prisma.paymentLog.findMany({
      where: { playerId: card.player.id },
      orderBy: { paidAt: "desc" },
      select: {
        id: true,
        paidFor: true,
        paidAt: true,
      },
    });

    return NextResponse.json(
      {
        id: card.player.id,
        cardCode: card.cardCode,
        name: card.player.fullName,
        avatarUrl:
          card.player.avatarUrl ||
          (card.player.imageUrl && process.env.CLOUDINARY_CLOUD_NAME
            ? buildCloudinaryUrlFromUploadPath(
                card.player.imageUrl,
                process.env.CLOUDINARY_CLOUD_NAME,
              )
            : null),
        visits_total: 0,
        visits_used: 0,
        isActive: card.isActive,
        team_group: card.player.teamGroup,
        jerseyNumber: card.player.jerseyNumber,
        birthDate: card.player.birthDate,
        status: card.player.status,
        last_payment_date: card.player.lastPaymentDate,
        paymentLogs: paymentLogs.map((item) => ({
          id: item.id,
          paidFor: item.paidFor,
          paidAt: item.paidAt,
        })),
        notifications: notifications.map((item) => ({
          id: item.id,
          type: item.type,
          title: item.title,
          body: item.body,
          url: item.url,
          sentAt: item.sentAt,
          readAt: item.readAt,
        })),
        unread_notifications: unreadCount,
      },
      {
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" },
      }
    );
  } catch (error) {
    console.error("Member fetch error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      {
        status: 500,
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" },
      }
    );
  }
}
