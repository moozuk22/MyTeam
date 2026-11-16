import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { verifyAdminToken } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";
import { canAccessTrainingClub, findTrainingPlanCoachGroup, UUID_RE } from "@/lib/exercise/access";
import { listTrainingPlanCategories } from "@/lib/exercise/categories";
import { EMPTY_EXERCISE } from "@/lib/exercise/model";
import EditorLoader from "../[planId]/konva/EditorLoader";

export default async function NewTrainingPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ clubId?: string; category?: string; coachGroupId?: string }>;
}) {
  const token = (await cookies()).get("admin_session")?.value;
  const session = token ? await verifyAdminToken(token) : null;
  if (!session) redirect("/admin/login");

  const { clubId, category, coachGroupId } = await searchParams;
  if (typeof clubId !== "string" || !UUID_RE.test(clubId) || !canAccessTrainingClub(session, clubId))
    notFound();

  const [club, categories, coachGroup] = await Promise.all([
    prisma.club.findUnique({ where: { id: clubId }, select: { id: true } }),
    listTrainingPlanCategories(clubId),
    findTrainingPlanCoachGroup(clubId, coachGroupId),
  ]);
  if (!club || (coachGroupId !== undefined && !coachGroup)) notFound();

  return (
    <EditorLoader
      plan={{
        id: null,
        title: "",
        categoryId: categories.find(({ id }) => id === category)?.id ?? null,
        layout: EMPTY_EXERCISE,
        updatedAt: new Date(0).toISOString(),
      }}
      categories={categories}
      clubId={clubId}
      coachGroupId={coachGroup?.id}
      userId={session.sub}
    />
  );
}
