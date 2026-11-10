import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyAdminToken } from "@/lib/adminAuth";
import { canAccessTrainingClub, UUID_RE } from "@/lib/exercise/access";
import { isV2, validateExercise } from "@/lib/exercise/model";
import EditorLoader from "./EditorLoader";

export default async function KonvaPage({
  params,
  searchParams,
}: {
  params: Promise<{ planId: string }>;
  searchParams: Promise<{ clubId?: string }>;
}) {
  const token = (await cookies()).get("admin_session")?.value;
  const session = token ? await verifyAdminToken(token) : null;
  if (!session) redirect("/admin/login");
  const { planId } = await params;
  const { clubId } = await searchParams;
  if (
    !clubId ||
    !UUID_RE.test(clubId) ||
    !UUID_RE.test(planId) ||
    !canAccessTrainingClub(session, clubId)
  )
    notFound();
  const plan = await prisma.trainingPlan.findFirst({
    where: { id: planId, clubId },
    select: {
      id: true,
      title: true,
      description: true,
      layout: true,
      updatedAt: true,
    },
  });
  if (!plan) notFound();
  if (!isV2(plan.layout))
    redirect(`/admin/training-plans/${planId}?clubId=${clubId}`);
  const error = validateExercise(plan.layout);
  if (error)
    return (
      <main>
        <h1>Упражнението не може да се отвори</h1>
        <p>{error}</p>
        <a href={`/admin/training-plans?clubId=${clubId}`}>
          Назад към плановете
        </a>
      </main>
    );
  return (
    <EditorLoader
      plan={{
        ...plan,
        layout: plan.layout,
        updatedAt: plan.updatedAt.toISOString(),
      }}
      clubId={clubId}
      userId={session.sub}
    />
  );
}
