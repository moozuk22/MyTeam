import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyAdminToken } from "@/lib/adminAuth";
import { listTrainingPlans } from "@/lib/exercise/queries";
import TrainingPlansClient from "./page.client";

type TrainingPlansSearchParams = {
  clubId?: string | string[];
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

  const clubs = await prisma.club.findMany({
    where:
      !session.roles.includes("admin") && session.defaultClubId
        ? { id: session.defaultClubId }
        : {},
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

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

  const { plans: initialPlans, nextCursor } = defaultClubId
    ? await listTrainingPlans(defaultClubId)
    : { plans: [], nextCursor: null };

  return (
    <TrainingPlansClient
      clubs={clubs}
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
