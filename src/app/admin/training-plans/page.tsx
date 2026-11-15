import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyAdminToken } from "@/lib/adminAuth";
import { canAccessTrainingClub, findTrainingPlanCoachGroup, UUID_RE } from "@/lib/exercise/access";
import { listTrainingPlanCategories } from "@/lib/exercise/categories";
import { countTrainingPlansByScope, listTrainingPlanCoaches, listTrainingPlans } from "@/lib/exercise/queries";
import { trainingPlanSearch } from "@/lib/exercise/planLocation";
import TrainingPlansClient from "./page.client";

type TrainingPlansSearchParams = {
  clubId?: string | string[];
  category?: string | string[];
  scope?: string | string[];
  coachId?: string | string[];
  coachGroupId?: string | string[];
  sort?: string | string[];
  view?: string | string[];
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

  const scope = firstParam(resolvedSearchParams.scope) === "mine" ? "mine" : "club";
  const oldestFirst = firstParam(resolvedSearchParams.sort) === "oldest";
  const listView = firstParam(resolvedSearchParams.view) === "list";
  const requestedCategory = firstParam(resolvedSearchParams.category).toLowerCase();
  const categoryFilter = requestedCategory === "uncategorized" || UUID_RE.test(requestedCategory)
    ? requestedCategory
    : "";
  const requestedCoach = firstParam(resolvedSearchParams.coachId).toLowerCase();
  const coachFilter = scope === "club" && UUID_RE.test(requestedCoach) ? requestedCoach : "";
  const requestedCoachGroupId = firstParam(resolvedSearchParams.coachGroupId);
  const [categories, result, coachGroup, coaches, scopeCounts] = defaultClubId
    ? await Promise.all([
        listTrainingPlanCategories(defaultClubId),
        listTrainingPlans(defaultClubId, null, categoryFilter, scope === "mine" ? session.sub : undefined, coachFilter, oldestFirst),
        findTrainingPlanCoachGroup(defaultClubId, requestedCoachGroupId),
        scope === "club" ? listTrainingPlanCoaches(defaultClubId) : [],
        countTrainingPlansByScope(defaultClubId, session.sub),
      ])
    : [[], { plans: [], nextCursor: null }, null, [], { club: 0, mine: 0 }] as const;
  if (requestedCoachGroupId && !coachGroup) notFound();
  const invalidCategory = categoryFilter && categoryFilter !== "uncategorized" &&
    !categories.some((category) => category.id === categoryFilter);
  const invalidCoach = coachFilter && !coaches.some((coach) => coach.id === coachFilter);
  if (invalidCategory || invalidCoach) {
    const params = trainingPlanSearch(defaultClubId, coachGroup?.id);
    if (scope === "mine") params.set("scope", scope);
    if (categoryFilter && !invalidCategory) params.set("category", categoryFilter);
    if (coachFilter && !invalidCoach) params.set("coachId", coachFilter);
    if (oldestFirst) params.set("sort", "oldest");
    if (listView) params.set("view", "list");
    redirect(`/admin/training-plans?${params}`);
  }
  const { plans: initialPlans, nextCursor } = result;

  return (
    <TrainingPlansClient
      key={`${defaultClubId}:${coachGroup?.id ?? ""}:${categoryFilter}:${scope}:${coachFilter}:${oldestFirst}`}
      coaches={coaches}
      coachFilter={coachFilter}
      scope={scope}
      oldestFirst={oldestFirst}
      isAdmin={session.roles.includes("admin")}
      scopeCounts={scopeCounts}
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
