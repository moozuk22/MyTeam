import { Prisma } from "@prisma/client";
import { prisma, withPrismaPoolRetry } from "@/lib/db";

export async function getPlayerPaymentReports(clubId: string, coachGroupId: string, customGroupId: string) {
  return withPrismaPoolRetry(() => prisma.$transaction(async (tx) => {
    const [players, archives] = await Promise.all([
      tx.player.findMany({
        where: {
          clubId,
          ...(coachGroupId ? { coachGroups: { some: { id: coachGroupId, clubId } } } : {}),
          ...(customGroupId ? { customTrainingGroups: { some: { groupId: customGroupId, group: { clubId } } } } : {}),
        },
        select: {
          id: true, fullName: true, teamGroup: true, paymentAmount: true,
          firstBillingMonth: true, isActive: true, reportActivity: true,
          club: { select: { paymentWorkflow: true } },
          paymentLogs: { select: { id: true, paidFor: true, paidAt: true, amount: true, currency: true } },
          paymentWaivers: { select: { waivedFor: true } },
        },
      }),
      tx.playerReportArchive.findMany({
        where: { clubId, ...(coachGroupId ? { coachGroupIds: { has: coachGroupId } } : {}), ...(customGroupId ? { customGroupIds: { has: customGroupId } } : {}) },
        select: { report: true },
      }),
    ]);
    return [...players, ...archives.map(({ report }) => report)];
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead }));
}
