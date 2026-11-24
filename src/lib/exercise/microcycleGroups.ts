import { prisma } from "@/lib/db";
import { filterGroups, type FilterGroup } from "@/lib/exercise/microcycleGroupFilter";
/**
 * Groups for the microcycle page, in natural Bulgarian order ("Група 2" before "Група 10").
 * Custom groups carry their coach group, so the page can show them by coach.
 * `coachView` is true only for the full club view in custom-group mode; team groups have no coach link.
 */
export async function microcycleGroups(clubId: string, coachGroupId?: string) {
  const club = await prisma.club.findUnique({ where: { id: clubId }, select: { trainingGroupMode: true, name: true, imageUrl: true, emblemUrl: true } });
  if (!club) return null;
  const custom = Boolean(coachGroupId) || club.trainingGroupMode === "custom_group";
  const groups: FilterGroup[] = custom
    ? (await prisma.clubCustomTrainingGroup.findMany({ where: { clubId, ...(coachGroupId ? { coachGroupId } : {}) }, select: { id: true, name: true, coachGroup: { select: { id: true, name: true } } } }))
      .map(g => ({ key: `custom:${g.id}`, name: g.name, coach: g.coachGroup }))
    : (await prisma.clubTrainingScheduleGroup.findMany({ where: { clubId }, select: { id: true, name: true } })).map(g => ({ key: `training:${g.id}`, name: g.name }));
  return { club, groups: filterGroups(groups, ""), coachView: custom && !coachGroupId };
}
