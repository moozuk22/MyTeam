import BackLink from "../../BackLink";
import { readEditableTrainingPlan } from "@/lib/exercise/imageStorage";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
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
  searchParams: Promise<{ clubId?: string; coachGroupId?: string; panel?: string }>;
}) {
  const token = (await cookies()).get("admin_session")?.value;
  const session = token ? await verifyAdminToken(token) : null;
  if (!session) redirect("/admin/login");
  const { planId } = await params;
  const { clubId, coachGroupId, panel } = await searchParams;
  if (
    !clubId ||
    !UUID_RE.test(clubId) ||
    !UUID_RE.test(planId) ||
    !canAccessTrainingClub(session, clubId)
  )
    notFound();
  const groupContext = UUID_RE.test(coachGroupId ?? "") ? coachGroupId : undefined;
  const plan = await readEditableTrainingPlan(clubId, planId);
  if (!plan) notFound();
  const layout = isV2(plan.layout) ? plan.layout : null;
  const error = layout
    ? validateExercise(layout)
    : "Планът е създаден със стария редактор. Изберете „Копирай в новия редактор“ от списъка с планове, за да редактирате копието.";
  if (!layout || error)
    return (
      <main>
        <h1>Упражнението не може да се отвори</h1>
        <p>{error}</p>
        <BackLink href={`/admin/training-plans?${trainingPlanSearch(clubId, groupContext)}`}>
          Назад към плановете
        </BackLink>
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
      initialPanel={panel === "description" || panel === "equipment" ? panel : undefined}
    />
  );
}
