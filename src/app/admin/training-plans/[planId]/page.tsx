import BackLink from "../BackLink";
import { ArrowLeft, Box, Edit2, Ellipsis, History, Info, Layers, Plus, UserRound } from "lucide-react";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { verifyAdminToken } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";
import { canAccessTrainingClub, UUID_RE } from "@/lib/exercise/access";
import { getPitchQuadrants, isInPitchQuadrants, isV2, validateExercise } from "@/lib/exercise/model";
import { countEquipment, FOOTBALL_EQUIPMENT, FOOTBALL_LABELS } from "@/lib/exercise/football";
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
  const quadrants = layout ? getPitchQuadrants(layout) : [];
  const counts = countEquipment(layout?.objects.filter((object) => isInPitchQuadrants(object, quadrants)) ?? []);
  const equipment = FOOTBALL_EQUIPMENT.types
    .map((type) => ({ type, count: counts[type] ?? 0 }))
    .filter(({ count }) => count > 0);
  const equipmentTotal = equipment.reduce((total, { count }) => total + count, 0);
  const category = plan.category && (plan.category.clubId === null || plan.category.clubId === club)
    ? plan.category.name : "Без категория";
  const updated = new Intl.DateTimeFormat("bg-BG", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Sofia",
  }).format(plan.updatedAt);
  const search = trainingPlanSearch(club, UUID_RE.test(coachGroupId ?? "") ? coachGroupId : undefined);
  const listHref = `/admin/training-plans?${search}`;

  const reviewHref = `/admin/training-plans/${planId}?${search}`;
  const editorHref = `/admin/training-plans/${planId}/konva?${search}`;
  const details = (
    <>
      <section className="tp-review-detail-card" aria-labelledby="plan-description">
        <header>
          <h2 id="plan-description"><Info size={22} aria-hidden="true" /> Описание</h2>
          {layout && (
            <Link className="tp-icon-btn" href={`${editorHref}&panel=description`} aria-label="Редактирай описанието">
              <Edit2 size={17} aria-hidden="true" />
            </Link>
          )}
        </header>
        <p className="tp-review-description">{plan.description || "Без описание"}</p>
      </section>
      <section className="tp-review-detail-card" aria-labelledby="plan-information">
        <h2 id="plan-information"><Layers size={22} aria-hidden="true" /> Информация</h2>
        <dl>
          <div>
            <dt><UserRound size={18} aria-hidden="true" /> Създал</dt>
            <dd>{plan.creatorName ?? "Няма записан автор"}</dd>
          </div>
          <div>
            <dt><History size={18} aria-hidden="true" /> Обновен</dt>
            <dd><time dateTime={plan.updatedAt.toISOString()}>{updated}</time></dd>
          </div>
        </dl>
      </section>
      {layout && (
        <section className="tp-review-detail-card tp-review-equipment" aria-labelledby="plan-equipment">
          <header>
            <h2 id="plan-equipment"><Box size={22} aria-hidden="true" /> {FOOTBALL_EQUIPMENT.title} ({equipmentTotal})</h2>
            <Link className="tp-primary-btn" href={`${editorHref}&panel=equipment`}>
              <Plus size={17} aria-hidden="true" /> Добави
            </Link>
          </header>
          {equipment.length > 0 ? (
            <dl>
              {equipment.map(({ type, count }) => (
                <div key={type}>
                  <dt>{FOOTBALL_LABELS[type]}</dt>
                  <dd>{count}</dd>
                </div>
              ))}
            </dl>
          ) : <p>Няма поставени пособия.</p>}
        </section>
      )}
    </>
  );

  return (
    <main className="tp-page tp-review">
      <div className="tp-inner">
        <BackLink className="tp-back-btn" href={listHref}>
          <ArrowLeft size={16} aria-hidden="true" /> Към упражненията
        </BackLink>
        <header className="tp-review-heading">
          <h1 className="tp-title"><Layers aria-hidden="true" />{plan.title}</h1>
          <div className="tp-review-actions">
            {layout && (
              <Link className="tp-primary-btn" href={editorHref}>
                <Edit2 size={18} aria-hidden="true" /> Редактирай
              </Link>
            )}
            <details className="tp-card-menu tp-review-menu">
              <summary aria-label="Още действия" title="Още действия"><Ellipsis size={20} /></summary>
              <Link href={reviewHref} target="_blank" rel="noopener">Отвори в нов раздел</Link>
            </details>
          </div>
          <span className="tp-category-label">{category}</span>
        </header>
        <ReviewPreview
          exercise={layout}
          fallback={drawing ? "Запазеното игрище не може да се покаже." :
            "Планът е от стария редактор. Изберете „Копирай в новия редактор“ от списъка, за да отворите чертежа."}
          details={details}
        />
      </div>
    </main>
  );
}
