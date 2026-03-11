import webpush from "web-push";
import { prisma } from "@/lib/db";
import { getVapidConfig } from "@/lib/push/vapid";
import type {
  BrowserPushSubscription,
  PushNotificationPayload,
} from "@/lib/push/types";

let isWebPushConfigured = false;

function ensureWebPushConfigured() {
  if (isWebPushConfigured) {
    return;
  }

  const vapid = getVapidConfig();
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
  isWebPushConfigured = true;
}

function getPushErrorStatusCode(error: unknown) {
  if (!error || typeof error !== "object") {
    return null;
  }

  const maybeError = error as { statusCode?: number };
  return typeof maybeError.statusCode === "number" ? maybeError.statusCode : null;
}

export interface SavePushSubscriptionInput {
  memberId: string;
  subscription: BrowserPushSubscription;
  userAgent?: string | null;
  device?: string | null;
}

export async function savePushSubscription(input: SavePushSubscriptionInput) {
  return await prisma.pushSubscription.upsert({
    where: {
      endpoint: input.subscription.endpoint,
    },
    update: {
      memberId: input.memberId,
      p256dh: input.subscription.keys.p256dh,
      auth: input.subscription.keys.auth,
      userAgent: input.userAgent ?? undefined,
      device: input.device ?? undefined,
      isActive: true,
    },
    create: {
      memberId: input.memberId,
      endpoint: input.subscription.endpoint,
      p256dh: input.subscription.keys.p256dh,
      auth: input.subscription.keys.auth,
      userAgent: input.userAgent ?? undefined,
      device: input.device ?? undefined,
      isActive: true,
    },
  });
}

export async function deactivatePushSubscription(endpoint: string, memberId?: string) {
  return await prisma.pushSubscription.updateMany({
    where: {
      endpoint,
      ...(memberId ? { memberId } : {}),
    },
    data: {
      isActive: false,
    },
  });
}

export interface SendPushResult {
  total: number;
  sent: number;
  failed: number;
  deactivated: number;
}

export async function sendPushToMember(
  memberId: string,
  payload: PushNotificationPayload
): Promise<SendPushResult> {
  const subscriptions = await prisma.pushSubscription.findMany({
    where: {
      memberId,
      isActive: true,
    },
    select: {
      id: true,
      endpoint: true,
      p256dh: true,
      auth: true,
    },
  });

  if (subscriptions.length === 0) {
    return { total: 0, sent: 0, failed: 0, deactivated: 0 };
  }

  ensureWebPushConfigured();

  let sent = 0;
  let failed = 0;
  let deactivated = 0;
  const body = JSON.stringify(payload);

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          body
        );
        sent += 1;
      } catch (error) {
        failed += 1;
        const statusCode = getPushErrorStatusCode(error);

        if (statusCode === 404 || statusCode === 410) {
          deactivated += 1;
          await prisma.pushSubscription.update({
            where: { id: subscription.id },
            data: { isActive: false },
          });
        }

        console.error("Push delivery error:", error);
      }
    })
  );

  return {
    total: subscriptions.length,
    sent,
    failed,
    deactivated,
  };
}
