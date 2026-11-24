import { prisma } from "@/lib/db";
import { formatWeekRange } from "@/lib/exercise/microcycle";
import { saveAdminNotificationHistory } from "@/lib/push/adminHistory";
import { sendPushToClubAdmins } from "@/lib/push/adminService";

export const MICROCYCLE_NOTIFICATION_TYPE = "training_microcycle";

/** Opens the microcycle of the group and week on the read-only page of the coach group. */
export function microcycleUrl(clubId: string, coachGroupId: string, week: string, groupKey: string) {
  return `/admin/training-plans/microcycles?${new URLSearchParams({ clubId, coachGroupId, week, groupKey })}`;
}

/**
 * Tells the coaches that groups got a new microcycle for the week.
 * Only custom groups have a coach group. Each coach group gets one notification for all its groups.
 * A failure is logged and does not stop the other coach groups.
 */
export async function notifyNewMicrocycle(clubId: string, week: string, groupKeys: string[]) {
  const ids = groupKeys.filter(key => key.startsWith("custom:")).map(key => key.slice("custom:".length));
  if (!ids.length) return;
  let groups: { id: string; name: string; coachGroupId: string | null }[];
  try {
    groups = await prisma.clubCustomTrainingGroup.findMany({
      where: { clubId, id: { in: ids }, coachGroupId: { not: null } },
      select: { id: true, name: true, coachGroupId: true },
    });
  } catch (error) {
    console.error("Microcycle notification groups failed", error instanceof Error ? error.name : "unknown");
    return;
  }
  const byCoach = new Map<string, { id: string; name: string }[]>();
  for (const group of groups) byCoach.set(group.coachGroupId!, [...byCoach.get(group.coachGroupId!) ?? [], group]);
  const range = formatWeekRange(week);
  // One coach group at a time keeps the database connections and push requests bounded.
  for (const [coachGroupId, coachGroups] of byCoach) {
    const names = coachGroups.map(g => g.name).sort((a, b) => a.localeCompare(b, "bg", { numeric: true }));
    const first = coachGroups.find(g => g.name === names[0])!;
    const payload = {
      title: "Нов микроцикъл",
      body: `${names.join(", ")} · ${range}`,
      url: microcycleUrl(clubId, coachGroupId, week, `custom:${first.id}`),
      icon: "/myteam-logo.webp",
      badge: "/myteam-logo.webp",
      tag: `microcycle-${week}-${coachGroupId}`,
      data: { type: MICROCYCLE_NOTIFICATION_TYPE, clubId, week },
    };
    try {
      await saveAdminNotificationHistory({ clubId, coachGroupId, type: MICROCYCLE_NOTIFICATION_TYPE, payload });
      await sendPushToClubAdmins(clubId, payload, coachGroupId);
    } catch (error) {
      console.error("Microcycle notification failed", error instanceof Error ? error.name : "unknown");
    }
  }
}
