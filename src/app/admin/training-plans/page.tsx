import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyAdminToken } from "@/lib/adminAuth";
import TrainingPlansClient from "./page.client";

type TrainingPlansSearchParams = {
  clubId?: string | string[];
};

function firstParam(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value ?? "").trim();
}

export default async function TrainingPlansPage(
  { searchParams }: { searchParams: Promise<TrainingPlansSearchParams> },
) {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_session")?.value;
  if (!token) redirect("/admin/login");

  const session = await verifyAdminToken(token);
  if (!session) redirect("/admin/login");

  const clubs = await prisma.club.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const resolvedSearchParams = await searchParams;
  const requestedClubId = firstParam(resolvedSearchParams.clubId);
  const defaultClubId =
    (requestedClubId && clubs.some((club) => club.id === requestedClubId) && requestedClubId) ||
    (session.defaultClubId && clubs.some((club) => club.id === session.defaultClubId) && session.defaultClubId) ||
    clubs[0]?.id ||
    "";

  const initialPlans = defaultClubId
    ? await prisma.trainingPlan.findMany({
        where: { clubId: defaultClubId },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          title: true,
          description: true,
          updatedAt: true,
          createdAt: true,
        },
      })
    : [];

  return (
    <TrainingPlansClient
      clubs={clubs}
      defaultClubId={defaultClubId}
      initialPlans={initialPlans.map((plan) => ({
        ...plan,
        createdAt: plan.createdAt.toISOString(),
        updatedAt: plan.updatedAt.toISOString(),
      }))}
    />
  );
}
