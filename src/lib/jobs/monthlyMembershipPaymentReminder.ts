import { prisma } from "@/lib/db";
import { saveMemberNotificationHistory } from "@/lib/push/history";
import { sendPushToMember } from "@/lib/push/service";
import { buildNotificationPayload } from "@/lib/push/templates";

const REMINDER_TYPE = "monthly_membership_payment_reminder" as const;
const DEFAULT_TIME_ZONE = "Europe/Sofia";
const DEFAULT_RUN_DAY = 25;
const DEFAULT_RUN_HOUR = 10;
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
  const schedulerTimeZone = DEFAULT_TIME_ZONE;
  const nowIso = now.toISOString();
  const clubs = await prisma.club.findMany({
    select: {
      id: true,
      reminderDay: true,
      reminderHour: true,
    },
  });

  if (clubs.length === 0) {
    return {
      success: true,
      skipped: true,
      reason: "No clubs configured.",
      timeZone: schedulerTimeZone,
      nowIso,
      targetMembers: 0,
      alreadyNotifiedThisMonth: 0,
      historySaved: 0,
      pushSummary: { total: 0, sent: 0, failed: 0, deactivated: 0 },
    };
  }

  const eligibleClubs = clubs.filter((club) => {
    if (options?.ignoreSchedule) {
      return true;
    }
    const { day, hour } = getDatePartsInTimeZone(now, schedulerTimeZone);
    const runDay = Number.isInteger(club.reminderDay) ? club.reminderDay : DEFAULT_RUN_DAY;
    const runHour = Number.isInteger(club.reminderHour) ? club.reminderHour : DEFAULT_RUN_HOUR;
    return day === runDay && hour === runHour;
  });

  if (eligibleClubs.length === 0) {
    return {
      success: true,
      skipped: true,
      reason: "No clubs are scheduled for membership reminders at this time.",
      timeZone: schedulerTimeZone,
      nowIso,
      targetMembers: 0,
      alreadyNotifiedThisMonth: 0,
      historySaved: 0,
      pushSummary: { total: 0, sent: 0, failed: 0, deactivated: 0 },
    };
  }

  let targetMemberCount = 0;
  let alreadyNotifiedCount = 0;
  const results: Array<{
    historySaved: number;
    total: number;
    sent: number;
    failed: number;
    deactivated: number;
  }> = [];

  for (const club of eligibleClubs) {
    const dateParts = getDatePartsInTimeZone(now, schedulerTimeZone);
    const year = dateParts.year;
    const month = dateParts.month;
    if (!year || !month) {
      continue;
    }

    const monthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const monthEnd = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));

    const [members, alreadySentRows] = await Promise.all([
      prisma.player.findMany({
        where: {
          clubId: club.id,
          isActive: true,
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
          player: {
            clubId: club.id,
          },
        },
        distinct: ["playerId"],
        select: { playerId: true },
      }),
    ]);

    const alreadySentMemberIds = new Set(alreadySentRows.map((row) => row.playerId));
    const targetMembers = members.filter((member) => !alreadySentMemberIds.has(member.id));
    targetMemberCount += targetMembers.length;
    alreadyNotifiedCount += alreadySentMemberIds.size;

    for (let index = 0; index < targetMembers.length; index += MEMBER_PROCESSING_CONCURRENCY) {
      const batch = targetMembers.slice(index, index + MEMBER_PROCESSING_CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map(async (member) => {
          const url = member.cards[0] ? `/member/${member.cards[0].cardCode}` : "/";
          const payload = buildNotificationPayload({
            type: REMINDER_TYPE,
            url,
          });

          const pushResult = await sendPushToMember(member.id, payload);
          let historySaved = 0;

          if (pushResult.sent > 0) {
            await saveMemberNotificationHistory(member.id, REMINDER_TYPE, payload);
            historySaved = 1;
          }

          return {
            historySaved,
            total: pushResult.total,
            sent: pushResult.sent,
            failed: pushResult.failed,
            deactivated: pushResult.deactivated,
          };
        }),
      );
      results.push(...batchResults);
    }
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
    skipped: targetMemberCount === 0,
    reason: targetMemberCount === 0 ? "All eligible clubs are already notified or have no matching members." : undefined,
    timeZone: schedulerTimeZone,
    nowIso,
    targetMembers: targetMemberCount,
    alreadyNotifiedThisMonth: alreadyNotifiedCount,
    historySaved,
    pushSummary,
  };
}
