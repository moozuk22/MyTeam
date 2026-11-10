import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
export type TrainingPlanSummary = {
  id: string;
  title: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  layoutVersion: number;
};
/** Read only the JSON version, never the potentially large drawing, for list cards. */
export async function listTrainingPlans(
  clubId: string,
  cursor?: string | null,
) {
  const cursorFilter = cursor
    ? Prisma.sql`AND (updated_at, id) < (
    SELECT updated_at, id FROM training_plans WHERE id = ${cursor}::uuid AND club_id = ${clubId}::uuid
  )`
    : Prisma.empty;
  const rows = await prisma.$queryRaw<TrainingPlanSummary[]>(Prisma.sql`
    SELECT id, title, description, created_at AS "createdAt", updated_at AS "updatedAt",
      CASE WHEN layout->>'version' = '2' THEN 2 ELSE 1 END AS "layoutVersion"
    FROM training_plans WHERE club_id = ${clubId}::uuid ${cursorFilter}
    ORDER BY updated_at DESC, id DESC LIMIT 51
  `);
  const plans = rows.slice(0, 50);
  return { plans, nextCursor: rows.length > 50 ? plans.at(-1)!.id : null };
}
