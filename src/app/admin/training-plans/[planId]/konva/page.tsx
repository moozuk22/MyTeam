import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyAdminToken } from "@/lib/adminAuth";
import { canAccessTrainingClub, UUID_RE } from "@/lib/exercise/access";
import { listTrainingPlanCategories } from "@/lib/exercise/categories";
import { isV2, validateExercise } from "@/lib/exercise/model";
import { trainingPlanSearch } from "@/lib/exercise/planLocation";
import EditorLoader from "./EditorLoader";

export default async function KonvaPage({
  params,
  searchParams,
}: {
  params: Promise<{ planId: string }>;
  searchParams: Promise<{ clubId?: string; coachGroupId?: string }>;
}) {
  const token = (await cookies()).get("admin_session")?.value;
  const session = token ? await verifyAdminToken(token) : null;
  if (!session) redirect("/admin/login");
  const { planId } = await params;
  const { clubId, coachGroupId } = await searchParams;
  if (
    !clubId ||
    !UUID_RE.test(clubId) ||
    !UUID_RE.test(planId) ||
    !canAccessTrainingClub(session, clubId)
  )
    notFound();
  const groupContext = UUID_RE.test(coachGroupId ?? "") ? coachGroupId : undefined;
  const plan = await prisma.trainingPlan.findFirst({
    where: { id: planId, clubId },
    select: {
      id: true,
      title: true,
      description: true,
      categoryId: true,
      layout: true,
      updatedAt: true,
    },
  });
  if (!plan) notFound();
  const layout = isV2(plan.layout) ? plan.layout : null;
  const error = layout
    ? validateExercise(layout)
    : "Планът е създаден със стария редактор. Изберете „Копирай в Konva“ от списъка с планове, за да редактирате копието.";
  if (!layout || error)
    return (
      <main>
        <h1>Упражнението не може да се отвори</h1>
        <p>{error}</p>
        <a href={`/admin/training-plans?${trainingPlanSearch(clubId, groupContext)}`}>
          Назад към плановете
        </a>
      </main>
    );
  return (
    <EditorLoader
      plan={{
        ...plan,
        layout,
        updatedAt: plan.updatedAt.toISOString(),
      }}
      categories={await listTrainingPlanCategories(clubId)}
      clubId={clubId}
      coachGroupId={groupContext}
      userId={session.sub}
    />
  );
}
