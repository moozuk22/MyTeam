import { prisma } from "@/lib/db";
import { saveMemberNotificationHistory } from "@/lib/push/history";
import { sendPushToMember } from "@/lib/push/service";
import { buildNotificationPayload } from "@/lib/push/templates";

const REMINDER_TYPE = "monthly_membership_payment_reminder" as const;
const DEFAULT_TIME_ZONE = "Europe/Sofia";
const RUN_DAY = 25;
const RUN_HOUR = 10;
const MEMBER_PROCESSING_CONCURRENCY = 2;

function getDatePartsInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: "year" | "month" | "day" | "hour") =>
      Number(parts.find((part) => part.type === type)?.value);

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
  };
}

export interface MonthlyMembershipReminderResult {
  success: boolean;
  skipped: boolean;
  reason?: string;
  timeZone: string;
  nowIso: string;
  targetMembers: number;
  alreadyNotifiedThisMonth: number;
  historySaved: number;
  pushSummary: {
    total: number;
    sent: number;
    failed: number;
    deactivated: number;
  };
}

export async function runMonthlyMembershipPaymentReminder(
    now = new Date(),
    options?: { ignoreSchedule?: boolean }
): Promise<MonthlyMembershipReminderResult> {
  const timeZone = process.env.CRON_TIMEZONE?.trim() || DEFAULT_TIME_ZONE;
  const nowIso = now.toISOString();
  const { year, month, day, hour } = getDatePartsInTimeZone(now, timeZone);

  if (!year || !month || !day || hour === undefined || Number.isNaN(hour)) {
    return {
      success: false,
      skipped: true,
      reason: "Could not resolve date parts in configured time zone.",
      timeZone,
      nowIso,
      targetMembers: 0,
      alreadyNotifiedThisMonth: 0,
      historySaved: 0,
      pushSummary: { total: 0, sent: 0, failed: 0, deactivated: 0 },
    };
  }

  if (!options?.ignoreSchedule && (day !== RUN_DAY || hour !== RUN_HOUR)) {
    return {
      success: true,
      skipped: true,
      reason: `Current local time is day ${day}, hour ${hour}; monthly reminders run only on day ${RUN_DAY} at ${RUN_HOUR}:00 (${timeZone}).`,
      timeZone,
      nowIso,
      targetMembers: 0,
      alreadyNotifiedThisMonth: 0,
      historySaved: 0,
      pushSummary: { total: 0, sent: 0, failed: 0, deactivated: 0 },
    };
  }

  const monthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const monthEnd = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));

  const [members, alreadySentRows] = await Promise.all([
    prisma.player.findMany({
      where: {
        status: {
          in: ["warning", "overdue"],
        },
        paymentWaivers: {
          none: {
            waivedFor: {
              gte: monthStart,
              lt: monthEnd,
            },
          },
        },
      },
      select: {
        id: true,
        cards: {
          where: { isActive: true },
          select: { cardCode: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    }),
    prisma.playerNotification.findMany({
      where: {
        type: REMINDER_TYPE,
        sentAt: {
          gte: monthStart,
          lt: monthEnd,
        },
      },
      distinct: ["playerId"],
      select: { playerId: true },
    }),
  ]);

  const alreadySentMemberIds = new Set(alreadySentRows.map((row) => row.playerId));
  const targetMembers = members.filter((member) => !alreadySentMemberIds.has(member.id));

  if (targetMembers.length === 0) {
    return {
      success: true,
      skipped: true,
      reason: "All members already received this monthly reminder.",
      timeZone,
      nowIso,
      targetMembers: 0,
      alreadyNotifiedThisMonth: alreadySentMemberIds.size,
      historySaved: 0,
      pushSummary: { total: 0, sent: 0, failed: 0, deactivated: 0 },
    };
  }

  const results: Array<{
    historySaved: number;
    total: number;
    sent: number;
    failed: number;
    deactivated: number;
  }> = [];

  for (let index = 0; index < targetMembers.length; index += MEMBER_PROCESSING_CONCURRENCY) {
    const batch = targetMembers.slice(index, index + MEMBER_PROCESSING_CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (member) => {
        const url = member.cards[0] ? `/member/${member.cards[0].cardCode}` : "/";
        const payload = buildNotificationPayload({
          type: REMINDER_TYPE,
          url,
        });

        await saveMemberNotificationHistory(member.id, REMINDER_TYPE, payload);
        const pushResult = await sendPushToMember(member.id, payload);

        return {
          historySaved: 1,
          total: pushResult.total,
          sent: pushResult.sent,
          failed: pushResult.failed,
          deactivated: pushResult.deactivated,
        };
      })
    );
    results.push(...batchResults);
  }

  const historySaved = results.reduce((sum, item) => sum + item.historySaved, 0);

  const pushSummary = results.reduce(
      (acc, item) => {
        acc.total += item.total;
        acc.sent += item.sent;
        acc.failed += item.failed;
        acc.deactivated += item.deactivated;
        return acc;
      },
      { total: 0, sent: 0, failed: 0, deactivated: 0 }
  );

  return {
    success: true,
    skipped: false,
    timeZone,
    nowIso,
    targetMembers: targetMembers.length,
    alreadyNotifiedThisMonth: alreadySentMemberIds.size,
    historySaved,
    pushSummary,
  };
}
