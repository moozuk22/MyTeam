import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyAdminToken } from "@/lib/adminAuth";
import { DEFAULT_LAYOUT, PlanLayout, validateLayout } from "@/lib/trainingPlans";
import TrainingPlanEditorClient from "./page.client";

type TrainingPlanEditorSearchParams = {
  clubId?: string | string[];
};

function firstParam(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value ?? "").trim();
}

export default async function TrainingPlanEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ planId: string }>;
  searchParams: Promise<TrainingPlanEditorSearchParams>;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_session")?.value;
  if (!token) redirect("/admin/login");

  const session = await verifyAdminToken(token);
  if (!session) redirect("/admin/login");

  const { planId } = await params;
  const resolvedSearchParams = await searchParams;
  const clubId = firstParam(resolvedSearchParams.clubId);
  if (!clubId) notFound();

  const plan = await prisma.trainingPlan.findFirst({
    where: { id: planId, clubId },
    select: {
      id: true,
      clubId: true,
      title: true,
      description: true,
      layout: true,
      updatedAt: true,
      createdAt: true,
    },
  });

  if (!plan) notFound();

  const layout: PlanLayout = validateLayout(plan.layout) ? DEFAULT_LAYOUT : (plan.layout as unknown as PlanLayout);

  return (
    <TrainingPlanEditorClient
      clubId={clubId}
      plan={{
        id: plan.id,
        clubId: plan.clubId,
        title: plan.title,
        description: plan.description,
        layout,
        createdAt: plan.createdAt.toISOString(),
        updatedAt: plan.updatedAt.toISOString(),
      }}
    />
  );
}
