import { prisma } from "@/lib/db";
export async function microcycleGroups(clubId: string, coachGroupId?: string) {
  const club = await prisma.club.findUnique({ where: { id: clubId }, select: { trainingGroupMode: true, name: true, imageUrl: true, emblemUrl: true } });
  if (!club) return null;
  const groups = coachGroupId || club.trainingGroupMode === "custom_group"
    ? (await prisma.clubCustomTrainingGroup.findMany({ where: { clubId, ...(coachGroupId ? { coachGroupId } : {}) }, select: { id: true, name: true }, orderBy: { name: "asc" } })).map(g => ({ key: `custom:${g.id}`, name: g.name }))
    : (await prisma.clubTrainingScheduleGroup.findMany({ where: { clubId }, select: { id: true, name: true }, orderBy: { name: "asc" } })).map(g => ({ key: `training:${g.id}`, name: g.name }));
  return { club, groups };
}
