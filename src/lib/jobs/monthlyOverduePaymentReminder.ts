import { prisma } from "@/lib/db";
import { saveMemberNotificationHistory } from "@/lib/push/history";
import { sendPushToMember } from "@/lib/push/service";
import { buildNotificationPayload } from "@/lib/push/templates";

const REMINDER_TYPE = "monthly_overdue_payment_reminder" as const;
const DEFAULT_TIME_ZONE = "Europe/Sofia";
const STATUS_ROLLOVER_JOB = "monthly_status_rollover";
const RUN_DAY = 23;

function getDatePartsInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const get = (type: "year" | "month" | "day") =>
      Number(parts.find((part) => part.type === type)?.value);

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
  };
}

export interface MonthlyOverduePaymentReminderResult {
  success: boolean;
  skipped: boolean;
  reason?: string;
  timeZone: string;
  nowIso: string;
  previousMonthIso: string;
  targetMembers: number;
  alreadyNotifiedThisMonth: number;
  historySaved: number;
  statusRollover: {
    phase: "executed" | "already_completed" | "in_progress";
    forcedToPaid: number;
    paidToWarning: number;
    warningToOverdue: number;
  };
  pushSummary: {
    total: number;
    sent: number;
    failed: number;
    deactivated: number;
  };
}

async function acquireMonthlyJobLock(jobName: string, year: number, month: number) {
  try {
    await prisma.cronJobRun.create({
      data: {
        jobName,
        runYear: year,
        runMonth: month,
      },
    });
    return { acquired: true, alreadyCompleted: false, inProgress: false };
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code?: unknown }).code)
        : "";

    if (code !== "P2002") {
      throw error;
    }
  }

  const existingRow = await prisma.cronJobRun.findFirst({
    where: {
      jobName,
      runYear: year,
      runMonth: month,
    },
    select: {
      completedAt: true,
    },
  });
  const completedAt = existingRow?.completedAt ?? null;

  if (completedAt) {
    return { acquired: false, alreadyCompleted: true, inProgress: false };
  }

  return { acquired: false, alreadyCompleted: false, inProgress: true };
}

async function markMonthlyJobCompleted(jobName: string, year: number, month: number) {
  await prisma.cronJobRun.updateMany({
    where: {
      jobName,
      runYear: year,
      runMonth: month,
    },
    data: {
      completedAt: new Date(),
    },
  });
}

async function runMonthlyStatusRollover(year: number, month: number) {
  const lock = await acquireMonthlyJobLock(STATUS_ROLLOVER_JOB, year, month);

  if (lock.inProgress) {
    return {
      phase: "in_progress" as const,
      forcedToPaid: 0,
      paidToWarning: 0,
      warningToOverdue: 0,
    };
  }

  if (lock.alreadyCompleted) {
    return {
      phase: "already_completed" as const,
      forcedToPaid: 0,
      paidToWarning: 0,
      warningToOverdue: 0,
    };
  }

  const currentMonthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const nextMonthStart = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));

  const paidCurrentMonthRows = await prisma.paymentLog.findMany({
    where: {
      paidFor: {
        gte: currentMonthStart,
        lt: nextMonthStart,
      },
    },
    distinct: ["playerId"],
    select: { playerId: true },
  });

  const paidCurrentMonthIds = new Set(paidCurrentMonthRows.map((row) => row.playerId));

  const forcedToPaidResult = await prisma.player.updateMany({
    where: {
      id: {
        in: Array.from(paidCurrentMonthIds),
      },
      status: {
        in: ["warning", "overdue"],
      },
    },
    data: { status: "paid" },
  });

  const [paidRows, warningRows] = await Promise.all([
    prisma.player.findMany({
      where: {
        status: "paid",
        ...(paidCurrentMonthIds.size > 0
          ? {
              id: {
                notIn: Array.from(paidCurrentMonthIds),
              },
            }
          : {}),
      },
      select: { id: true },
    }),
    prisma.player.findMany({
      where: {
        status: "warning",
        ...(paidCurrentMonthIds.size > 0
          ? {
              id: {
                notIn: Array.from(paidCurrentMonthIds),
              },
            }
          : {}),
      },
      select: { id: true },
    }),
  ]);

  const paidIds = paidRows.map((row) => row.id);
  const warningIds = warningRows.map((row) => row.id);

  const [paidToWarningResult, warningToOverdueResult] = await prisma.$transaction([
    paidIds.length > 0
      ? prisma.player.updateMany({
          where: {
            id: { in: paidIds },
          },
          data: { status: "warning" },
        })
      : prisma.player.updateMany({
          where: { id: "__no_match__" },
          data: { status: "warning" },
        }),
    warningIds.length > 0
      ? prisma.player.updateMany({
          where: {
            id: { in: warningIds },
          },
          data: { status: "overdue" },
        })
      : prisma.player.updateMany({
          where: { id: "__no_match__" },
          data: { status: "overdue" },
        }),
  ]);

  await markMonthlyJobCompleted(STATUS_ROLLOVER_JOB, year, month);

  return {
    phase: "executed" as const,
    forcedToPaid: forcedToPaidResult.count,
    paidToWarning: paidToWarningResult.count,
    warningToOverdue: warningToOverdueResult.count,
  };
}

export async function runMonthlyOverduePaymentReminder(
    now = new Date()
): Promise<MonthlyOverduePaymentReminderResult> {
  const timeZone = process.env.CRON_TIMEZONE?.trim() || DEFAULT_TIME_ZONE;
  const nowIso = now.toISOString();
  const { year, month, day } = getDatePartsInTimeZone(now, timeZone);

  if (!year || !month || !day) {
    return {
      success: false,
      skipped: true,
      reason: "Could not resolve date parts in configured time zone.",
      timeZone,
      nowIso,
      previousMonthIso: "",
      targetMembers: 0,
      alreadyNotifiedThisMonth: 0,
      historySaved: 0,
      statusRollover: {
        phase: "already_completed",
        forcedToPaid: 0,
        paidToWarning: 0,
        warningToOverdue: 0,
      },
      pushSummary: { total: 0, sent: 0, failed: 0, deactivated: 0 },
    };
  }

  if (day !== RUN_DAY) {
    return {
      success: true,
      skipped: true,
      reason: `Today is day ${day}; overdue reminders run only on day ${RUN_DAY}.`,
      timeZone,
      nowIso,
      previousMonthIso: "",
      targetMembers: 0,
      alreadyNotifiedThisMonth: 0,
      historySaved: 0,
      statusRollover: {
        phase: "already_completed",
        forcedToPaid: 0,
        paidToWarning: 0,
        warningToOverdue: 0,
      },
      pushSummary: { total: 0, sent: 0, failed: 0, deactivated: 0 },
    };
  }

  const statusRollover = await runMonthlyStatusRollover(year, month);

  if (statusRollover.phase === "in_progress") {
    return {
      success: true,
      skipped: true,
      reason: "Status rollover is currently in progress in another run.",
      timeZone,
      nowIso,
      previousMonthIso: "",
      targetMembers: 0,
      alreadyNotifiedThisMonth: 0,
      historySaved: 0,
      statusRollover,
      pushSummary: { total: 0, sent: 0, failed: 0, deactivated: 0 },
    };
  }

  const previousMonthStart = new Date(Date.UTC(year, month - 2, 1, 0, 0, 0, 0));
  const previousMonthIso = previousMonthStart.toISOString();
  const notificationMonthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const notificationMonthEnd = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));

  const [eligibleMembers, alreadySentRows] = await Promise.all([
    prisma.player.findMany({
      where: {
        status: "overdue",
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
          gte: notificationMonthStart,
          lt: notificationMonthEnd,
        },
      },
      distinct: ["playerId"],
      select: { playerId: true },
    }),
  ]);

  const alreadySentIds = new Set(alreadySentRows.map((row) => row.playerId));

  const targetMembers = eligibleMembers.filter(
      (member) => !alreadySentIds.has(member.id)
  );

  if (targetMembers.length === 0) {
    return {
      success: true,
      skipped: true,
      reason: "No overdue members to notify this month.",
      timeZone,
      nowIso,
      previousMonthIso,
      targetMembers: 0,
      alreadyNotifiedThisMonth: alreadySentIds.size,
      historySaved: 0,
      statusRollover,
      pushSummary: { total: 0, sent: 0, failed: 0, deactivated: 0 },
    };
  }

  const results = await Promise.all(
      targetMembers.map(async (member) => {
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
    previousMonthIso,
    targetMembers: targetMembers.length,
    alreadyNotifiedThisMonth: alreadySentIds.size,
    historySaved,
    statusRollover,
    pushSummary,
  };
}
