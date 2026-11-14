import { ArrowLeft, Edit2 } from "lucide-react";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { verifyAdminToken } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";
import { canAccessTrainingClub, UUID_RE } from "@/lib/exercise/access";
import { isV2, validateExercise } from "@/lib/exercise/model";
import { trainingPlanSearch } from "@/lib/exercise/planLocation";
import ReviewPreview from "./ReviewPreview";
import "../page.css";

export default async function TrainingPlanReview({
  params,
  searchParams,
}: {
  params: Promise<{ planId: string }>;
  searchParams: Promise<{ clubId?: string | string[]; coachGroupId?: string }>;
}) {
  const token = (await cookies()).get("admin_session")?.value;
  const session = token ? await verifyAdminToken(token) : null;
  if (!session) redirect("/admin/login");

  const [{ planId }, { clubId, coachGroupId }] = await Promise.all([params, searchParams]);
  const club = (Array.isArray(clubId) ? clubId[0] : clubId)?.trim() ?? "";
  if (!UUID_RE.test(club) || !UUID_RE.test(planId) || !canAccessTrainingClub(session, club))
    notFound();

  const plan = await prisma.trainingPlan.findFirst({
    where: { id: planId, clubId: club },
    select: {
      title: true,
      description: true,
      creatorName: true,
      updatedAt: true,
      layout: true,
      category: { select: { name: true, clubId: true } },
    },
  });
  if (!plan) notFound();

  const drawing = isV2(plan.layout) ? plan.layout : null;
  const layout = drawing && !validateExercise(drawing) ? drawing : null;
  const category = plan.category && (plan.category.clubId === null || plan.category.clubId === club)
    ? plan.category.name : "Без категория";
  const updated = new Intl.DateTimeFormat("bg-BG", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Sofia",
  }).format(plan.updatedAt);
  const search = trainingPlanSearch(club, UUID_RE.test(coachGroupId ?? "") ? coachGroupId : undefined);
  const listHref = `/admin/training-plans?${search}`;

  return (
    <main className="tp-page">
      <div className="tp-inner">
        <nav className="tp-review-actions" aria-label="Действия за плана">
          <Link className="tp-back-btn" href={listHref}>
            <ArrowLeft size={16} aria-hidden="true" />
            Към плановете
          </Link>
          {layout && (
            <Link className="tp-primary-btn" href={`/admin/training-plans/${planId}/konva?${search}`}>
              <Edit2 size={16} aria-hidden="true" />
              Редактирай
            </Link>
          )}
        </nav>
        <header className="tp-review-heading">
          <h1 className="tp-title">{plan.title}</h1>
          <span className="tp-category-label">{category}</span>
        </header>
        <div className="tp-review-layout">
          {layout ? (
            <section className="tp-card-preview tp-review-preview" aria-label="Преглед на запазеното игрище">
              <ReviewPreview exercise={layout} />
            </section>
          ) : (
            <p className="tp-review-fallback">
              {drawing ? "Запазеното игрище не може да се покаже." :
                "Планът е от стария редактор. Изберете „Копирай в новия редактор“ от списъка, за да отворите чертежа."}
            </p>
          )}
          <section className="tp-review-details" aria-label="Детайли на плана">
            <h2>Описание</h2>
            <p className="tp-review-description">{plan.description || "Без описание"}</p>
            <dl>
              <dt>Създал</dt>
              <dd>{plan.creatorName ?? "Няма записан автор"}</dd>
              <dt>Обновен</dt>
              <dd><time dateTime={plan.updatedAt.toISOString()}>{updated}</time></dd>
            </dl>
          </section>
        </div>
      </div>
    </main>
  );
}
