import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { TRAINING_UUID_PATTERN } from "@/lib/trainingPlans";
export type TrainingPlanSummary = {
  id: string;
  title: string;
  description: string | null;
  categoryId: string | null;
  creatorName: string | null;
  createdAt: Date;
  updatedAt: Date;
  layoutVersion: number;
};
export function listTrainingPlanCoaches(clubId: string) {
  return prisma.coachGroup.findMany({
    where: { clubId, trainingPlans: { some: { clubId } } },
    select: {
      id: true,
      name: true,
      _count: { select: { trainingPlans: { where: { clubId } } } },
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
}

export async function countTrainingPlansByScope(clubId: string, userId: string) {
  const [club, mine] = await Promise.all([
    prisma.trainingPlan.count({ where: { clubId } }),
    TRAINING_UUID_PATTERN.test(userId)
      ? prisma.trainingPlan.count({ where: { clubId, createdByUserId: userId } })
      : 0,
  ]);
  return { club, mine };
}

/** Read only the JSON version, never the potentially large drawing, for list cards. */
export async function listTrainingPlans(
  clubId: string,
  cursor?: string | null,
  category?: string,
  creatorUserId?: string,
  coachId?: string,
  oldestFirst = false,
  search = "",
) {
  if (creatorUserId !== undefined && !TRAINING_UUID_PATTERN.test(creatorUserId)) {
    return { plans: [], nextCursor: null };
  }
  const creatorFilter = creatorUserId === undefined
    ? Prisma.empty
    : Prisma.sql`AND created_by_user_id = ${creatorUserId}::uuid`;
  const coachFilter = coachId
    ? Prisma.sql`AND created_by_coach_group_id = ${coachId}::uuid`
    : Prisma.empty;
  const cursorOperator = oldestFirst ? Prisma.sql`>` : Prisma.sql`<`;
  const direction = oldestFirst ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  const cursorFilter = cursor
    ? Prisma.sql`AND (updated_at, id) ${cursorOperator} (
    SELECT updated_at, id FROM training_plans WHERE id = ${cursor}::uuid AND club_id = ${clubId}::uuid
  )`
    : Prisma.empty;
  const categoryFilter = !category
    ? Prisma.empty
    : category === "uncategorized"
      ? Prisma.sql`AND category_id IS NULL`
      : Prisma.sql`AND category_id = ${category}::uuid`;
  const searchFilter = search.trim()
    ? Prisma.sql`AND strpos(lower(title), lower(${search.trim()})) > 0`
    : Prisma.empty;
  const rows = await prisma.$queryRaw<TrainingPlanSummary[]>(Prisma.sql`
    SELECT id, title, description, category_id AS "categoryId", creator_name AS "creatorName",
      created_at AS "createdAt", updated_at AS "updatedAt",
      CASE WHEN layout->>'version' = '2' THEN 2 ELSE 1 END AS "layoutVersion"
    FROM training_plans WHERE club_id = ${clubId}::uuid ${categoryFilter} ${creatorFilter} ${coachFilter} ${cursorFilter} ${searchFilter}
    ORDER BY updated_at ${direction}, id ${direction} LIMIT 51
  `);
  const plans = rows.slice(0, 50);
  return { plans, nextCursor: rows.length > 50 ? plans.at(-1)!.id : null };
}
