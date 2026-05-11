import { prisma } from "@/lib/db";
import { saveAdminNotificationHistory } from "@/lib/push/adminHistory";
import { sendPushToClubAdmins } from "@/lib/push/adminService";
import { buildNotificationPayload } from "@/lib/push/templates";

/**
 * When a member enables Web Push (typically after installing the PWA and granting permission),
 * notify club admins (club-wide push subscriptions) and coaches subscribed to each coach group
 * the player belongs to.
 */
export async function notifyMemberPushEnabled(input: { playerId: string }) {
  const player = await prisma.player.findUnique({
    where: { id: input.playerId },
    select: {
      id: true,
      fullName: true,
      clubId: true,
      coachGroups: { select: { id: true } },
    },
  });

  if (!player) {
    return;
  }

  const memberName = player.fullName.trim();
  const adminMembersUrl = `/admin/members?clubId=${encodeURIComponent(player.clubId)}`;
  const pushPayload = buildNotificationPayload({
    type: "member_push_enabled",
    memberName: memberName || undefined,
    url: adminMembersUrl,
  });

  try {
    await saveAdminNotificationHistory({
      clubId: player.clubId,
      playerId: player.id,
      type: "member_push_enabled",
      payload: pushPayload,
    });
  } catch (error) {
    console.error("member_push_enabled: admin notification history error:", error);
  }

  try {
    await sendPushToClubAdmins(player.clubId, pushPayload, null);
  } catch (error) {
    console.error("member_push_enabled: admin push error:", error);
  }

  const groupIds = [...new Set(player.coachGroups.map((g) => g.id))];
  for (const coachGroupId of groupIds) {
    try {
      await sendPushToClubAdmins(player.clubId, pushPayload, coachGroupId);
    } catch (error) {
      console.error("member_push_enabled: coach group push error:", error, coachGroupId);
    }
  }

}
