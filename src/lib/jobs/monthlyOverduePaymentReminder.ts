import { prisma } from "@/lib/db";
import { saveMemberNotificationHistory } from "@/lib/push/history";
import { sendPushToMember } from "@/lib/push/service";
import { buildNotificationPayload } from "@/lib/push/templates";

const REMINDER_TYPE = "monthly_overdue_payment_reminder" as const;
const DEFAULT_TIME_ZONE = "Europe/Sofia";
const STATUS_ROLLOVER_JOB = "monthly_status_rollover";
const DEFAULT_RUN_DAY = 1;
const DEFAULT_RUN_HOUR = 10;
const DEFAULT_RUN_MINUTE = 0;
const DEFAULT_SCHEDULE_GRACE_MINUTES = 10;
const DEFAULT_LOCK_TIMEOUT_MINUTES = 180;
const MEMBER_PROCESSING_CONCURRENCY = 2;

function getDatePartsInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: "year" | "month" | "day" | "hour" | "minute") =>
      Number(parts.find((part) => part.type === type)?.value);

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

function shouldRunAtScheduledTime(
  currentDay: number,
  currentHour: number,
  currentMinute: number,
  runDay: number,
  runHour: number,
  runMinute: number
) {
  if (currentDay !== runDay) {
    return false;
  }

  const nowTotalMinutes = currentHour * 60 + currentMinute;
  const runTotalMinutes = runHour * 60 + runMinute;
  const minuteDelta = nowTotalMinutes - runTotalMinutes;

  return minuteDelta >= 0 && minuteDelta <= DEFAULT_SCHEDULE_GRACE_MINUTES;
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
  const configuredTimeoutMinutes = Number(process.env.CRON_LOCK_TIMEOUT_MINUTES ?? "");
  const lockTimeoutMinutes =
    Number.isFinite(configuredTimeoutMinutes) && configuredTimeoutMinutes > 0
      ? configuredTimeoutMinutes
      : DEFAULT_LOCK_TIMEOUT_MINUTES;
  const lockTimeoutMs = lockTimeoutMinutes * 60 * 1000;

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
      id: true,
      completedAt: true,
      createdAt: true,
    },
  });
  const completedAt = existingRow?.completedAt ?? null;

  if (completedAt) {
    return { acquired: false, alreadyCompleted: true, inProgress: false };
  }

  if (existingRow) {
    const ageMs = Date.now() - existingRow.createdAt.getTime();
    const isStale = ageMs >= lockTimeoutMs;

    if (isStale) {
      const takeover = await prisma.cronJobRun.updateMany({
        where: {
          id: existingRow.id,
          completedAt: null,
          createdAt: existingRow.createdAt,
        },
        data: {
          createdAt: new Date(),
        },
      });

      if (takeover.count > 0) {
        return { acquired: true, alreadyCompleted: false, inProgress: false };
      }
    }
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
      failedAt: null,
      errorMessage: null,
    },
  });
}

async function markMonthlyJobFailed(jobName: string, year: number, month: number, error: unknown) {
  const message =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : typeof error === "string"
        ? error
        : "Unknown rollover error";

  await prisma.cronJobRun.updateMany({
    where: {
      jobName,
      runYear: year,
      runMonth: month,
      completedAt: null,
    },
    data: {
      failedAt: new Date(),
      errorMessage: message.slice(0, 1000),
    },
  });
}

async function runMonthlyStatusRollover(year: number, month: number, clubId: string) {
  const lock = await acquireMonthlyJobLock(`${STATUS_ROLLOVER_JOB}:${clubId}`, year, month);

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

  try {
    const currentMonthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const previousMonthStart = new Date(Date.UTC(year, month - 2, 1, 0, 0, 0, 0));
    const nextMonthStart = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));

    const pausedCurrentMonthRows = await prisma.paymentWaiver.findMany({
    where: {
      player: {
        clubId,
      },
      waivedFor: {
        gte: currentMonthStart,
        lt: nextMonthStart,
      },
    },
    distinct: ["playerId"],
    select: { playerId: true },
  });
    const pausedCurrentMonthIds = pausedCurrentMonthRows.map((row) => row.playerId);

    const paidCurrentMonthRows = await prisma.paymentLog.findMany({
    where: {
      player: {
        clubId,
      },
      paidFor: {
        gte: currentMonthStart,
        lt: nextMonthStart,
      },
    },
    distinct: ["playerId"],
    select: { playerId: true },
  });

    const paidCurrentMonthIds = new Set(paidCurrentMonthRows.map((row) => row.playerId));
    const paidCurrentMonthIdList = Array.from(paidCurrentMonthIds);
    const excludedFromRolloverIds = Array.from(
      new Set([...pausedCurrentMonthIds, ...paidCurrentMonthIdList]),
    );

    const forcedToPaidResult = await prisma.player.updateMany({
    where: {
      id: {
        in: paidCurrentMonthIdList,
        ...(pausedCurrentMonthIds.length > 0 ? { notIn: pausedCurrentMonthIds } : {}),
      },
      clubId,
      status: {
        in: ["warning", "overdue"],
      },
    },
    data: { status: "paid" },
  });

    const [paidRows, warningRows] = await Promise.all([
      prisma.player.findMany({
        where: {
          clubId,
          status: "paid",
          firstBillingMonth: {
            not: null,
            lte: currentMonthStart,
          },
          ...(excludedFromRolloverIds.length > 0
            ? { id: { notIn: excludedFromRolloverIds } }
            : {}),
        },
        select: { id: true },
      }),
      prisma.player.findMany({
        where: {
          clubId,
          status: "warning",
          firstBillingMonth: {
            not: null,
            lte: previousMonthStart,
          },
          ...(excludedFromRolloverIds.length > 0
            ? { id: { notIn: excludedFromRolloverIds } }
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
            where: { id: { in: [] } },
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
            where: { id: { in: [] } },
            data: { status: "overdue" },
          }),
    ]);

    await markMonthlyJobCompleted(`${STATUS_ROLLOVER_JOB}:${clubId}`, year, month);

    return {
      phase: "executed" as const,
      forcedToPaid: forcedToPaidResult.count,
      paidToWarning: paidToWarningResult.count,
      warningToOverdue: warningToOverdueResult.count,
    };
  } catch (error) {
    await markMonthlyJobFailed(`${STATUS_ROLLOVER_JOB}:${clubId}`, year, month, error);
    throw error;
  }
}

export async function runMonthlyOverduePaymentReminder(
    now = new Date(),
    options?: { ignoreSchedule?: boolean }
): Promise<MonthlyOverduePaymentReminderResult> {
  const schedulerTimeZone = DEFAULT_TIME_ZONE;
  const nowIso = now.toISOString();
  const clubs = await prisma.club.findMany({
    select: {
      id: true,
      overdueDay: true,
      overdueHour: true,
      overdueMinute: true,
    },
  });

  if (clubs.length === 0) {
    return {
      success: true,
      skipped: true,
      reason: "No clubs configured.",
      timeZone: schedulerTimeZone,
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

  const eligibleClubs = clubs.filter((club) => {
    if (options?.ignoreSchedule) {
      return true;
    }
    const { day, hour, minute } = getDatePartsInTimeZone(now, schedulerTimeZone);
    const runDay = Number.isInteger(club.overdueDay) ? club.overdueDay : DEFAULT_RUN_DAY;
    const runHour = Number.isInteger(club.overdueHour) ? club.overdueHour : DEFAULT_RUN_HOUR;
    const runMinute = Number.isInteger(club.overdueMinute) ? club.overdueMinute : DEFAULT_RUN_MINUTE;
    return shouldRunAtScheduledTime(day, hour, minute, runDay, runHour, runMinute);
  });

  if (eligibleClubs.length === 0) {
    return {
      success: true,
      skipped: true,
      reason: "No clubs are scheduled for overdue reminders at this time.",
      timeZone: schedulerTimeZone,
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

  let previousMonthIso = "";
  let targetMemberCount = 0;
  let alreadyNotifiedCount = 0;
  let inProgressCount = 0;
  const rolloverAgg = {
    forcedToPaid: 0,
    paidToWarning: 0,
    warningToOverdue: 0,
  };

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

    const statusRollover = await runMonthlyStatusRollover(year, month, club.id);
    if (statusRollover.phase === "in_progress") {
      inProgressCount += 1;
      continue;
    }
    rolloverAgg.forcedToPaid += statusRollover.forcedToPaid;
    rolloverAgg.paidToWarning += statusRollover.paidToWarning;
    rolloverAgg.warningToOverdue += statusRollover.warningToOverdue;

    const previousMonthStart = new Date(Date.UTC(year, month - 2, 1, 0, 0, 0, 0));
    previousMonthIso = previousMonthStart.toISOString();
    const notificationMonthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const notificationMonthEnd = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));

    const [eligibleMembers, alreadySentRows] = await Promise.all([
      prisma.player.findMany({
        where: {
          clubId: club.id,
          isActive: true,
          status: "overdue",
          paymentWaivers: {
            none: {
              waivedFor: {
                gte: notificationMonthStart,
                lt: notificationMonthEnd,
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
            gte: notificationMonthStart,
            lt: notificationMonthEnd,
          },
          player: {
            clubId: club.id,
          },
        },
        distinct: ["playerId"],
        select: { playerId: true },
      }),
    ]);

    const alreadySentIds = new Set(alreadySentRows.map((row) => row.playerId));
    const targetMembers = eligibleMembers.filter((member) => !alreadySentIds.has(member.id));
    targetMemberCount += targetMembers.length;
    alreadyNotifiedCount += alreadySentIds.size;

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
          await saveMemberNotificationHistory(member.id, REMINDER_TYPE, payload);
          const historySaved = 1;

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
    reason:
      targetMemberCount === 0
        ? inProgressCount > 0
          ? "Status rollover is currently in progress in another run."
          : "No overdue members to notify this cycle."
        : undefined,
    timeZone: schedulerTimeZone,
    nowIso,
    previousMonthIso,
    targetMembers: targetMemberCount,
    alreadyNotifiedThisMonth: alreadyNotifiedCount,
    historySaved,
    statusRollover: {
      phase: inProgressCount > 0 && rolloverAgg.forcedToPaid + rolloverAgg.paidToWarning + rolloverAgg.warningToOverdue === 0
        ? "in_progress"
        : "executed",
      forcedToPaid: rolloverAgg.forcedToPaid,
      paidToWarning: rolloverAgg.paidToWarning,
      warningToOverdue: rolloverAgg.warningToOverdue,
    },
    pushSummary,
  };
}
