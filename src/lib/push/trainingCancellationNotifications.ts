import { prisma } from "@/lib/db";
import { buildNotificationPayload } from "@/lib/push/templates";
import { sendPushToMember } from "@/lib/push/service";
import { saveMemberNotificationHistory } from "@/lib/push/history";

const MEMBER_PROCESSING_CONCURRENCY = 4;

export async function sendTrainingCancellationNotifications(input: {
  clubId: string;
  trainingDate: string;
  teamGroup?: number | null;
  trainingGroupId?: string | null;
  customTrainingGroupId?: string | null;
}): Promise<void> {
  const { clubId, trainingDate, teamGroup, trainingGroupId, customTrainingGroupId } = input;

  let playerIds: string[];

  if (customTrainingGroupId) {
    const group = await prisma.clubCustomTrainingGroup.findUnique({
      where: { id: customTrainingGroupId },
      select: { players: { select: { playerId: true } } },
    });
    playerIds = (group?.players ?? []).map((p) => p.playerId);
  } else if (trainingGroupId) {
    const group = await prisma.clubTrainingScheduleGroup.findUnique({
      where: { id: trainingGroupId },
      select: { teamGroups: true },
    });
    const teamGroups = group?.teamGroups ?? [];
    if (teamGroups.length === 0) {
      return;
    }
    const players = await prisma.player.findMany({
      where: { clubId, isActive: true, teamGroup: { in: teamGroups } },
      select: { id: true },
    });
    playerIds = players.map((p) => p.id);
  } else if (teamGroup !== null && teamGroup !== undefined && Number.isInteger(teamGroup)) {
    const players = await prisma.player.findMany({
      where: { clubId, isActive: true, teamGroup },
      select: { id: true },
    });
    playerIds = players.map((p) => p.id);
  } else {
    const players = await prisma.player.findMany({
      where: { clubId, isActive: true },
      select: { id: true },
    });
    playerIds = players.map((p) => p.id);
  }

  if (playerIds.length === 0) {
    return;
  }

  const members = await prisma.player.findMany({
    where: { id: { in: playerIds } },
    select: {
      id: true,
      cards: {
        where: { isActive: true },
        select: { cardCode: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  const [year, month, day] = trainingDate.split("-").map(Number);
  const formattedDate = new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("bg-BG", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });

  for (let i = 0; i < members.length; i += MEMBER_PROCESSING_CONCURRENCY) {
    const batch = members.slice(i, i + MEMBER_PROCESSING_CONCURRENCY);
    await Promise.all(
      batch.map(async (member) => {
        const url = member.cards[0] ? `/member/${member.cards[0].cardCode}` : "/";
        const payload = buildNotificationPayload({
          type: "training_cancelled",
          trainingDate: formattedDate,
          url,
        });

        try {
          await saveMemberNotificationHistory(member.id, "training_cancelled", payload);
        } catch (error) {
          console.error("Training cancellation notification history save failed:", error);
        }

        try {
          await sendPushToMember(member.id, payload);
        } catch (error) {
          console.error("Training cancellation push send failed:", error);
        }
      }),
    );
  }
}
