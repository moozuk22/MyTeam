import { prisma } from "@/lib/db";
import { saveMemberNotificationHistory } from "@/lib/push/history";
import { sendPushToMember } from "@/lib/push/service";
import type { PushNotificationPayload } from "@/lib/push/types";

const MEMBER_PROCESSING_CONCURRENCY = 4;

export interface MatchScheduleNotificationSummary {
  targetedMembers: number;
  total: number;
  sent: number;
  failed: number;
  deactivated: number;
  historySaved: number;
}

export interface MatchScheduleSnapshot {
  opponent: string;
  location: string;
  matchDate: string;
  matchTime: string;
  isHome: boolean;
}

function emptySummary(): MatchScheduleNotificationSummary {
  return {
    targetedMembers: 0,
    total: 0,
    sent: 0,
    failed: 0,
    deactivated: 0,
    historySaved: 0,
  };
}

function formatBgDate(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString("bg-BG", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatMatchDateTime(match: MatchScheduleSnapshot) {
  return `${formatBgDate(match.matchDate)} от ${match.matchTime}`;
}

function formatVenue(match: MatchScheduleSnapshot) {
  const venueType = match.isHome ? "домакински" : "гостуващ";
  return `${venueType} мач, ${match.location}`;
}

function buildCreatedMessage(match: MatchScheduleSnapshot) {
  return `Насрочен е мач срещу ${match.opponent} на ${formatMatchDateTime(match)} (${formatVenue(match)}).`;
}

function buildUpdatedMessage(previous: MatchScheduleSnapshot, next: MatchScheduleSnapshot) {
  const base = `Промяна в графика за мачове: мачът срещу ${previous.opponent} на ${formatMatchDateTime(previous)}`;

  const dateOrTimeChanged = previous.matchDate !== next.matchDate || previous.matchTime !== next.matchTime;
  const opponentChanged = previous.opponent !== next.opponent;
  const locationChanged = previous.location !== next.location || previous.isHome !== next.isHome;

  if (dateOrTimeChanged && !opponentChanged && !locationChanged) {
    return `${base} беше преместен на ${formatMatchDateTime(next)}.`;
  }

  if (!dateOrTimeChanged && locationChanged && !opponentChanged) {
    return `${base} е с променено място: ${formatVenue(next)}.`;
  }

  if (!dateOrTimeChanged && opponentChanged && !locationChanged) {
    return `${base} е с нов съперник: ${next.opponent}.`;
  }

  return `${base} е обновен. Нови данни: срещу ${next.opponent}, ${formatMatchDateTime(next)} (${formatVenue(next)}).`;
}

function buildMatchSchedulePayload(input: {
  action: "created" | "updated";
  previousMatch?: MatchScheduleSnapshot;
  match: MatchScheduleSnapshot;
}): PushNotificationPayload {
  const body =
    input.action === "updated" && input.previousMatch
      ? buildUpdatedMessage(input.previousMatch, input.match)
      : buildCreatedMessage(input.match);

  return {
    title: "График за мачове",
    body,
    icon: "/myteam-logo.webp",
    badge: "/myteam-logo.webp",
    tag: "match-schedule-updated",
    data: { type: "match_schedule" },
  };
}

export function hasMatchScheduleChanged(previous: MatchScheduleSnapshot, next: MatchScheduleSnapshot) {
  return (
    previous.opponent !== next.opponent ||
    previous.location !== next.location ||
    previous.matchDate !== next.matchDate ||
    previous.matchTime !== next.matchTime ||
    previous.isHome !== next.isHome
  );
}

export async function sendMatchScheduleNotifications(input: {
  clubId: string;
  action: "created" | "updated";
  previousMatch?: MatchScheduleSnapshot;
  match: MatchScheduleSnapshot;
}): Promise<MatchScheduleNotificationSummary> {
  const members = await prisma.player.findMany({
    where: {
      clubId: input.clubId,
      isActive: true,
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
  });

  const summary = emptySummary();
  summary.targetedMembers = members.length;

  if (members.length === 0) {
    return summary;
  }

  const payloadTemplate = buildMatchSchedulePayload(input);

  for (let index = 0; index < members.length; index += MEMBER_PROCESSING_CONCURRENCY) {
    const batch = members.slice(index, index + MEMBER_PROCESSING_CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (member) => {
        const payload: PushNotificationPayload = {
          ...payloadTemplate,
          url: member.cards[0] ? `/member/${member.cards[0].cardCode}` : "/",
        };

        let historySaved = 0;
        try {
          await saveMemberNotificationHistory(member.id, "match_schedule", payload);
          historySaved = 1;
        } catch (error) {
          console.error("Match schedule notification history save failed:", error);
        }

        try {
          const push = await sendPushToMember(member.id, payload);
          return { ...push, historySaved };
        } catch (error) {
          console.error("Match schedule push send failed:", error);
          return {
            total: 0,
            sent: 0,
            failed: 1,
            deactivated: 0,
            historySaved,
          };
        }
      }),
    );

    for (const result of results) {
      summary.total += result.total;
      summary.sent += result.sent;
      summary.failed += result.failed;
      summary.deactivated += result.deactivated;
      summary.historySaved += result.historySaved;
    }
  }

  return summary;
}
