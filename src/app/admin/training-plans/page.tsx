import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyAdminToken } from "@/lib/adminAuth";
import { canAccessTrainingClub, findTrainingPlanCoachGroup, UUID_RE } from "@/lib/exercise/access";
import { listTrainingPlanCategories } from "@/lib/exercise/categories";
import { listTrainingPlans } from "@/lib/exercise/queries";
import { trainingPlanSearch } from "@/lib/exercise/planLocation";
import TrainingPlansClient from "./page.client";

type TrainingPlansSearchParams = {
  clubId?: string | string[];
  category?: string | string[];
  coachGroupId?: string | string[];
};

function firstParam(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : (value ?? "")).trim();
}

export default async function TrainingPlansPage({
  searchParams,
}: {
  searchParams: Promise<TrainingPlansSearchParams>;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_session")?.value;
  if (!token) redirect("/admin/login");

  const session = await verifyAdminToken(token);
  if (!session) redirect("/admin/login");

  const clubRows = await prisma.club.findMany({
    where:
      !session.roles.includes("admin") && session.defaultClubId
        ? { id: session.defaultClubId }
        : {},
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const clubs = clubRows.filter((club) => canAccessTrainingClub(session, club.id));
  const resolvedSearchParams = await searchParams;
  const requestedClubId = firstParam(resolvedSearchParams.clubId);
  const defaultClubId =
    (requestedClubId &&
      clubs.some((club) => club.id === requestedClubId) &&
      requestedClubId) ||
    (session.defaultClubId &&
      clubs.some((club) => club.id === session.defaultClubId) &&
      session.defaultClubId) ||
    clubs[0]?.id ||
    "";

  const requestedCategory = firstParam(resolvedSearchParams.category).toLowerCase();
  const categoryFilter = requestedCategory === "uncategorized" || UUID_RE.test(requestedCategory)
    ? requestedCategory
    : "";
  const requestedCoachGroupId = firstParam(resolvedSearchParams.coachGroupId);
  const [categories, result, coachGroup] = defaultClubId
    ? await Promise.all([
        listTrainingPlanCategories(defaultClubId),
        listTrainingPlans(defaultClubId, null, categoryFilter),
        findTrainingPlanCoachGroup(defaultClubId, requestedCoachGroupId),
      ])
    : [[], { plans: [], nextCursor: null }, null] as const;
  if (requestedCoachGroupId && !coachGroup) notFound();
  if (categoryFilter && categoryFilter !== "uncategorized" &&
      !categories.some((category) => category.id === categoryFilter)) {
    redirect(`/admin/training-plans?${trainingPlanSearch(defaultClubId, coachGroup?.id)}`);
  }
  const { plans: initialPlans, nextCursor } = result;

  return (
    <TrainingPlansClient
      key={`${defaultClubId}:${coachGroup?.id ?? ""}:${categoryFilter}`}
      coachGroupId={coachGroup?.id}
      clubs={clubs}
      initialCategories={categories}
      categoryFilter={categoryFilter}
      defaultClubId={defaultClubId}
      initialCursor={nextCursor}
      initialPlans={initialPlans.map((plan) => ({
        ...plan,
        createdAt: plan.createdAt.toISOString(),
        updatedAt: plan.updatedAt.toISOString(),
      }))}
    />
  );
}
