import { findTrainingPlanCoachGroup, UUID_RE } from "./access";
import { TrainingImageError, type TrainingImageTx } from "./imageStorage";
import { parseCycle } from "./microcycle";
import type { SessionTarget, TrainingReference } from "./trainingSession";

export const coachAuthor = (coachGroupId: string) => `coach-group:${coachGroupId.toLowerCase()}`;

export async function documentOwnerFilter(clubId: string, userId: string, coach: string | null) {
  if (!coach) return userId;
  const group = await findTrainingPlanCoachGroup(clubId, coach);
  return group ? { in: [userId, coachAuthor(group.id)] } : userId;
}

export async function trainingReference(db: TrainingImageTx, clubId: string, coach: string | null, target: SessionTarget, lock = false, userId?: string): Promise<TrainingReference> {
  if (!coach || !UUID_RE.test(coach) || !target.groupKey.startsWith("custom:"))
    throw new TrainingImageError("Отворете тренировката от връзката за треньора.", 403);
  if (lock) await db.$queryRaw`SELECT id FROM training_microcycles WHERE id = ${target.cycleId}::uuid AND club_id = ${clubId}::uuid FOR UPDATE`;
  const groupId = target.groupKey.split(":")[1];
  const group = await db.clubCustomTrainingGroup.findFirst({
    where: { id: groupId, clubId, coachGroupId: coach, coachGroup: { clubId } }, select: { name: true },
  });
  if (!group) throw new TrainingImageError("Тази група не е налична за треньора.", 403);
  const cycle = await db.trainingMicrocycle.findFirst({
    where: { id: target.cycleId, clubId, groupKey: target.groupKey, week: target.week },
    select: { content: true, documents: { where: { groupKey: target.groupKey, rowId: target.rowId }, select: { document: { select: { id: true, ownerId: true } } } } },
  });
  const content = cycle && parseCycle(cycle.content);
  const index = content?.rows.findIndex(row => row.id === target.rowId) ?? -1;
  if (!content || index < 0) throw new TrainingImageError("Групата или тренировката вече не е налична.", 410);
  const document = cycle?.documents[0]?.document;
  return {
    cells: content.rows[index].cells, sessionNumber: String(index + 1),
    group: group.name.length <= 100 ? group.name : "", microcycle: content.number.length <= 40 ? content.number : "",
    season: content.season.length <= 100 ? content.season : "", halfSeason: content.half.length <= 60 ? content.half : "",
    occupied: !!document, documentId: document && (document.ownerId === coachAuthor(coach) || document.ownerId === userId) ? document.id : null,
  };
}
