import { prisma } from "@/lib/db";
import type { PushNotificationPayload } from "@/lib/push/types";
import { publishAdminNotificationCreated } from "@/lib/adminNotificationEvents";

const prismaAdmin = prisma as unknown as {
  adminNotification: {
    create: (args: Record<string, unknown>) => Promise<unknown>;
    findMany: (args: Record<string, unknown>) => Promise<unknown[]>;
    count: (args: Record<string, unknown>) => Promise<number>;
    updateMany: (args: Record<string, unknown>) => Promise<{ count: number }>;
  };
};

export async function saveAdminNotificationHistory(input: {
  clubId: string;
  type: string;
  payload: PushNotificationPayload;
  playerId?: string | null;
}) {
  const saved = await prismaAdmin.adminNotification.create({
    data: {
      clubId: input.clubId,
      playerId: input.playerId ?? null,
      type: input.type,
      title: input.payload.title,
      body: input.payload.body,
      url: input.payload.url,
    },
  });

  try {
    publishAdminNotificationCreated(input.clubId);
  } catch (error) {
    console.error("Admin notification SSE publish error:", error);
  }

  return saved;
}

export async function getClubAdminNotifications(input: {
  clubId: string;
  playerId?: string | null;
}) {
  return await prismaAdmin.adminNotification.findMany({
    where: {
      clubId: input.clubId,
      playerId: input.playerId ?? undefined,
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
      playerId: true,
    },
  });
}

export async function getClubAdminUnreadCount(input: {
  clubId: string;
  playerId?: string | null;
}) {
  return await prismaAdmin.adminNotification.count({
    where: {
      clubId: input.clubId,
      playerId: input.playerId ?? undefined,
      readAt: null,
    },
  });
}

export async function markClubAdminNotificationsRead(input: {
  clubId: string;
  playerId?: string | null;
}) {
  return await prismaAdmin.adminNotification.updateMany({
    where: {
      clubId: input.clubId,
      playerId: input.playerId ?? undefined,
      readAt: null,
    },
    data: {
      readAt: new Date(),
    },
  });
}
