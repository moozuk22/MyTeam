import { prisma } from "@/lib/db";

/** True if another custom training group in the same club already uses this color. */
export async function isCustomTrainingGroupColorTakenInScope(input: {
  clubId: string;
  coachGroupId: string | null;
  color: string;
  excludeGroupId?: string;
}): Promise<boolean> {
  const row = await prisma.clubCustomTrainingGroup.findFirst({
    where: {
      clubId: input.clubId,
      color: input.color,
      ...(input.excludeGroupId ? { NOT: { id: input.excludeGroupId } } : {}),
    },
    select: { id: true },
  });
  return Boolean(row);
}
