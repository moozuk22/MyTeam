"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  ClipboardList,
  Copy,
  Edit2,
  Ellipsis,
  Layers,
  LayoutGrid,
  List,
  RefreshCw,
  ScanLine,
  Plus,
  Trash2,
  UserRound,
  Waypoints,
} from "lucide-react";
import FinanceSkeleton from "@/app/admin/members/_components/FinanceSkeleton";
import { trainingPlanSearch } from "@/lib/exercise/planLocation";
import type { Exercise } from "@/lib/exercise/model";
import CategoryManager, { type CategoryOption } from "./CategoryManager";
import "./page.css";

const PlanPreview = dynamic(() => import("./PlanPreview"), {
  ssr: false,
  loading: () => <div className="tp-preview-skeleton" />,
});

type ClubOption = {
  id: string;
  name: string;
};

function labelWithCount(label: string, count?: number) {
  return count === undefined ? label : `${label} (${count})`;
}

type TrainingPlanSummary = {
  id: string;
  title: string;
  description: string | null;
  categoryId: string | null;
  creatorName?: string | null;
  createdAt: string;
  updatedAt: string;
  layoutVersion?: number;
};

export default function TrainingPlansClient({
  clubs,
  defaultClubId,
  initialPlans,
  initialCategories,
  categoryFilter = "",
  scope,
  scopeCounts,
  coaches,
  coachFilter,
  coachGroupId,
  oldestFirst = false,
  initialCursor = null,
}: {
  clubs: ClubOption[];
  defaultClubId: string;
  initialPlans: TrainingPlanSummary[];
  initialCategories: readonly CategoryOption[];
  categoryFilter?: string;
  scope: "mine" | "club";
  scopeCounts?: { mine: number; club: number };
  coaches: readonly (ClubOption & { _count?: { trainingPlans: number } })[];
  coachFilter: string;
  coachGroupId?: string;
  oldestFirst?: boolean;
  initialCursor?: string | null;
}) {
  const router = useRouter();
  const selectedClubId = defaultClubId;
  const listView = useSearchParams().get("view") === "list";
  const [plans, setPlans] = useState<TrainingPlanSummary[]>(initialPlans);
  const [categories, setCategories] = useState(initialCategories);
  const [serverPlans, setServerPlans] = useState(initialPlans);
  const [isFiltering, startFiltering] = useTransition();
  const [nextCursor, setNextCursor] = useState(initialCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const gridRef = useRef<HTMLElement>(null);
  const [previews, setPreviews] = useState<Record<string, Exercise | null>>({});

  if (serverPlans !== initialPlans) {
    setServerPlans(initialPlans);
    setPlans(initialPlans);
    setNextCursor(initialCursor);
    setCategories(initialCategories);
  }

  const canCloseDialog = useEffectEvent(() => !isDeleting);
  const deleteDialogRef = useRef<HTMLDivElement>(null);
  const dialogTrigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!confirmDeleteId) return;
    const dialog = deleteDialogRef.current;
    if (!dialog) return;
    dialog.querySelector<HTMLButtonElement>("button")?.focus();
    const handle = (event: KeyboardEvent) => {
      if (event.key === "Escape" && canCloseDialog()) {
        event.preventDefault();
        setConfirmDeleteId(null);
      }
      if (event.key !== "Tab") return;
      const elements = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex='0']",
        ),
      );
      const first = elements[0],
        last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", handle);
    return () => {
      document.removeEventListener("keydown", handle);
      dialogTrigger.current?.focus();
    };
  }, [confirmDeleteId]);

  const selectedClub = useMemo(
    () => clubs.find((club) => club.id === selectedClubId) ?? null,
    [clubs, selectedClubId],
  );
  const planToDelete = useMemo(
    () => plans.find((plan) => plan.id === confirmDeleteId) ?? null,
    [confirmDeleteId, plans],
  );

  const categoryNames = new Map(categories.map(({ id, name }) => [id, name]));
  const visiblePlans = plans.filter((plan) => matchesCategory(plan, categoryFilter));

  useEffect(() => {
    const pending = gridRef.current?.querySelectorAll<HTMLElement>("[data-preview-id]");
    if (!pending?.length) return;
    const controller = new AbortController();
    const observer = new IntersectionObserver((entries) => {
      const targets = entries.filter(({ isIntersecting }) => isIntersecting)
        .map(({ target }) => target as HTMLElement);
      for (const target of targets) observer.unobserve(target);
      for (let offset = 0; offset < targets.length; offset += 50) {
        const batch = targets.slice(offset, offset + 50);
        void loadPreviews(batch);
      }
    }, { rootMargin: "160px" });
    async function loadPreviews(batch: HTMLElement[]) {
      const requested = batch.map(({ dataset }) => ({
        id: dataset.previewId!,
        key: dataset.previewKey!,
      }));
      const params = new URLSearchParams({ ids: requested.map(({ id }) => id).join(",") });
      const layouts = new Map<string, Exercise>();
      try {
        const response = await fetch(`/api/admin/clubs/${selectedClubId}/training-plans/previews?${params}`, {
          signal: controller.signal,
        });
        if (response.ok) {
          const data: { previews: { id: string; layout: Exercise }[] } = await response.json();
          for (const { id, layout } of data.previews) layouts.set(id, layout);
        }
      } catch {
        // A preview failure leaves the plan card and its actions usable.
      }
      if (!controller.signal.aborted)
        setPreviews((current) => ({
          ...current,
          ...Object.fromEntries(requested.map(({ id, key }) => [key, layouts.get(id) ?? null])),
        }));
    }
    pending.forEach((element) => observer.observe(element));
    return () => {
      observer.disconnect();
      controller.abort();
    };
  }, [plans, categoryFilter, selectedClubId, isFiltering]);

  function changeFilter(
    { category = categoryFilter, nextScope = scope, coach = coachFilter, oldest = oldestFirst } = {},
    replace = false,
  ) {
    const params = trainingPlanSearch(selectedClubId, coachGroupId);
    if (category) params.set("category", category);
    if (nextScope === "mine") params.set("scope", nextScope);
    else if (coach) params.set("coachId", coach);
    if (oldest) params.set("sort", "oldest");
    if (listView) params.set("view", "list");
    startFiltering(() => {
      const url = `/admin/training-plans?${params}`;
      if (replace) router.replace(url, { scroll: false });
      else router.push(url, { scroll: false });
    });
  }

  function changeView(list: boolean) {
    const url = new URL(window.location.href);
    if (list) url.searchParams.set("view", "list");
    else url.searchParams.delete("view");
    window.history.replaceState(null, "", url);
  }

  function saveCategory(category: CategoryOption) {
    setCategories((current) => [...current.filter(({ id }) => id !== category.id), category]
      .sort((a, b) => a.name.localeCompare(b.name, "bg")));
  }

  function removeCategory(id: string) {
    setCategories((current) => current.filter((category) => category.id !== id));
    setPlans((current) => current.map((plan) =>
      plan.categoryId === id ? { ...plan, categoryId: null } : plan));
    if (categoryFilter === id) changeFilter({ category: "" }, true);
    else if (categoryFilter === "uncategorized") startFiltering(() => router.refresh());
  }

  async function loadMore() {
    if (!nextCursor || loadingMore || isFiltering) return;
    const params = new URLSearchParams({ cursor: nextCursor });
    if (scope === "mine") params.set("scope", scope);
    else if (coachFilter) params.set("coachId", coachFilter);
    if (categoryFilter) params.set("category", categoryFilter);
    if (oldestFirst) params.set("sort", "oldest");
    setLoadingMore(true);
    setError("");
    try {
      const res = await fetch(
        `/api/admin/clubs/${selectedClubId}/training-plans?${params}`,
        { cache: "no-store" },
      );
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Грешка при зареждане.");
      setPlans((prev) => [
        ...prev,
        ...payload.plans.filter(
          (p: TrainingPlanSummary) =>
            !prev.some((existing) => existing.id === p.id),
        ),
      ]);
      setNextCursor(payload.nextCursor ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Грешка при зареждане.");
    } finally {
      setLoadingMore(false);
    }
  }

  function openNewEditor() {
    const params = trainingPlanSearch(selectedClubId, coachGroupId);
    if (categoryFilter && categoryFilter !== "uncategorized")
      params.set("category", categoryFilter);
    router.push(`/admin/training-plans/new?${params}`);
  }

  async function duplicatePlan(plan: TrainingPlanSummary) {
    if (!selectedClubId || copying) return;
    setCopying(true);
    setError("");
    try {
      const res = await fetch(
        `/api/admin/clubs/${selectedClubId}/training-plans`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: `${plan.title.slice(0, 185)} — копие`,
            description: plan.description ?? "",
            sourcePlanId: plan.id,
            coachGroupId,
            editorVersion: 2,
          }),
        },
      );
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Грешка при копиране.");
      if (!oldestFirst && (!coachFilter || coachFilter === coachGroupId)) {
        setPlans((prev) => [payload.plan, ...prev]);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Грешка при копиране.");
    } finally {
      setCopying(false);
    }
  }

  async function deletePlan() {
    if (!selectedClubId || !confirmDeleteId) return;
    setIsDeleting(true);
    setError("");
    try {
      const res = await fetch(
        `/api/admin/clubs/${selectedClubId}/training-plans/${confirmDeleteId}`,
        {
          method: "DELETE",
        },
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(
          typeof payload.error === "string"
            ? payload.error
            : "Грешка при изтриване.",
        );
      setPlans((prev) => prev.filter((plan) => plan.id !== confirmDeleteId));
      setConfirmDeleteId(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Грешка при изтриване.");
    } finally {
      setIsDeleting(false);
    }
  }

  function openEditor(planId: string) {
    router.push(
      `/admin/training-plans/${encodeURIComponent(planId)}/konva?${trainingPlanSearch(selectedClubId, coachGroupId)}`,
    );
  }

  const location = trainingPlanSearch(selectedClubId, coachGroupId);
  const membersHref = `/admin/members?${location}`;

  return (
    <main className="tp-page tp-library">
      <div className="tp-inner">
        <header className="tp-header">
          <Link className="tp-back-btn" href={membersHref}>
            <ArrowLeft size={16} />
            <span>Назад</span>
          </Link>
          <div className="tp-heading">
            <h1 className="tp-title"><Waypoints aria-hidden="true" />Планове за тренировки</h1>
            <p>{selectedClub?.name ?? "Няма избран отбор"}</p>
          </div>
          <button
            className="tp-primary-btn"
            type="button"
            onClick={openNewEditor}
            disabled={!selectedClubId}
          >
            <Plus size={18} aria-hidden="true" />
            Нов план
          </button>
        </header>

        {selectedClubId && (
          <div className="tp-category-controls">
            <div className="tp-scope-controls" role="group" aria-label="Автор на плана">
              {(["mine", "club"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  className={scope === option ? "tp-primary-btn" : "tp-secondary-btn"}
                  aria-pressed={scope === option}
                  disabled={isFiltering}
                  onClick={() => {
                    if (scope !== option) changeFilter({ nextScope: option });
                  }}
                >
                  {option === "club" && <Waypoints size={20} aria-hidden="true" />}
                  <span>{option === "mine" ? "Моите" : "Клуб"}
                    {scopeCounts?.[option] !== undefined && <span className="tp-scope-count"> ({scopeCounts[option]})</span>}
                  </span>
                </button>
              ))}
            </div>
            <label className="tp-field tp-category-filter">
              <span><Layers size={17} aria-hidden="true" />Категория</span>
              <select
                value={categoryFilter}
                disabled={isFiltering}
                onChange={(event) => changeFilter({ category: event.target.value })}
              >
                <option value="">Всички категории</option>
                <option value="uncategorized">Без категория</option>
                {categories.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
              </select>
            </label>
            {scope === "club" && coaches.length > 0 && (
              <label className="tp-field tp-category-filter tp-coach-filter">
                <span><UserRound size={17} aria-hidden="true" />Треньор</span>
                <select
                  value={coachFilter}
                  disabled={isFiltering}
                  onChange={(event) => changeFilter({ coach: event.target.value })}
                >
                  <option value="">{labelWithCount("Всички треньори", scopeCounts?.club)}</option>
                  {coaches.map(({ id, name, _count }) => (
                    <option key={id} value={id}>{labelWithCount(name, _count?.trainingPlans)}</option>
                  ))}
                </select>
              </label>
            )}
            <CategoryManager
              categories={categories}
              clubId={selectedClubId}
              disabled={isFiltering || loadingMore || copying}
              onSave={saveCategory}
              onDelete={removeCategory}
            />
          </div>
        )}

        {error && !confirmDeleteId && <p className="tp-error" role="alert">{error}</p>}
        {selectedClubId && (
          <div className="tp-results-bar">
            <p className="tp-result-count" aria-live="polite">
              {!isFiltering && `${nextCursor ? "Показани " : ""}${visiblePlans.length} ${visiblePlans.length === 1 ? "план" : "плана"}`}
            </p>
            <div className="tp-view-controls" role="group" aria-label="Изглед">
              <button type="button" aria-label="Мрежа" aria-pressed={!listView} onClick={() => changeView(false)}><LayoutGrid size={18} /></button>
              <button type="button" aria-label="Списък" aria-pressed={listView} onClick={() => changeView(true)}><List size={20} /></button>
            </div>
            <select className="tp-sort" aria-label="Подредба" disabled={isFiltering}
              value={oldestFirst ? "oldest" : "latest"}
              onChange={(event) => changeFilter({ oldest: event.target.value === "oldest" })}
            >
              <option value="latest">Последно обновени</option>
              <option value="oldest">Най-отдавна обновени</option>
            </select>
          </div>
        )}

        <section className={listView ? "tp-grid tp-grid--list" : "tp-grid"} aria-busy={isFiltering} ref={gridRef}>
          {isFiltering ? (
            <div className="tp-grid-loading"><FinanceSkeleton variant="form" /></div>
          ) : visiblePlans.length === 0 ? (
            <div className="tp-empty">
              <ClipboardList size={28} />
              <p>{scope === "mine"
                ? categoryFilter ? "Нямате планове в тази категория." : "Все още нямате създадени планове."
                : coachFilter ? "Няма планове на този треньор за избрания филтър."
                : categoryFilter ? "Няма планове в тази категория." : "Все още няма планове за този отбор."}</p>
            </div>
          ) : (
            visiblePlans.map((plan) => {
              const previewKey = `${plan.id}:${plan.updatedAt}`;
              const preview = previews[previewKey];
              const reviewHref = `/admin/training-plans/${encodeURIComponent(plan.id)}?${location}`;
              return (
                <article className="tp-card" key={plan.id}>
                  <Link
                    className="tp-card-main"
                    href={reviewHref}
                    prefetch={false}
                  >
                    <div
                      className="tp-card-preview"
                      aria-hidden="true"
                      data-preview-id={plan.layoutVersion === 2 && preview === undefined ? plan.id : undefined}
                      data-preview-key={previewKey}
                    >
                      {preview ? <PlanPreview exercise={preview} /> :
                        plan.layoutVersion !== 2 || preview === null ? (
                          <div className="tp-preview-placeholder">
                            <ScanLine size={26} />
                            <span>{plan.layoutVersion !== 2 ? "Стар формат" : "Няма преглед"}</span>
                          </div>
                        ) : <div className="tp-preview-skeleton" />}
                    </div>
                    <div className="tp-card-info">
                      <span className="tp-category-label">
                        <Layers size={15} aria-hidden="true" />
                        {(plan.categoryId && categoryNames.get(plan.categoryId)) || "Без категория"}
                      </span>
                      <h2>{plan.title}</h2>
                      {plan.description && <p>{plan.description}</p>}
                      <div className="tp-card-meta">
                        {plan.creatorName && <span><UserRound size={16} aria-hidden="true" />Създал: {plan.creatorName}</span>}
                        <time dateTime={plan.updatedAt}><RefreshCw size={15} aria-hidden="true" />Обновен: {formatDate(plan.updatedAt)}</time>
                      </div>
                    </div>
                  </Link>
                  <details className="tp-card-menu" name="training-plan-actions" onKeyDown={(event) => {
                    if (event.key !== "Escape" || !event.currentTarget.open) return;
                    event.currentTarget.open = false;
                    event.currentTarget.querySelector("summary")?.focus();
                  }} onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;
                  }}>
                    <summary title="Още действия" aria-label={`Още действия за ${plan.title}`}><Ellipsis size={19} /></summary>
                    <Link href={reviewHref} prefetch={false}>Преглед на плана</Link>
                  </details>
                  <div className="tp-card-actions">
                    {plan.layoutVersion === 2 && (
                      <button
                        type="button"
                        className="tp-card-edit"
                        onClick={() => openEditor(plan.id)}
                        title="Редактирай плана"
                        aria-label="Редактирай плана"
                      >
                        <Edit2 size={16} />
                        <span>Редактирай</span>
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={copying}
                      onClick={() => void duplicatePlan(plan)}
                      title={plan.layoutVersion === 2 ? "Дублирай" : "Копирай в новия редактор"}
                      aria-label={plan.layoutVersion === 2 ? "Дублирай" : "Копирай в новия редактор"}
                    >
                      <Copy size={16} />
                      {plan.layoutVersion === 2 ? <span>Дублирай</span> : "Копирай в новия редактор"}
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        dialogTrigger.current = event.currentTarget;
                        setConfirmDeleteId(plan.id);
                      }}
                      title="Изтрий"
                      aria-label="Изтрий"
                    >
                      <Trash2 size={16} />
                      <span>Изтрий</span>
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </section>
        {nextCursor && !isFiltering && (
          <button
            type="button"
            className="tp-secondary-btn tp-load-more"
            disabled={loadingMore}
            onClick={() => void loadMore()}
          >
            {loadingMore ? "Показване…" : "Покажи още планове"}
          </button>
        )}
      </div>

      {confirmDeleteId && (
        <div
          className="tp-overlay"
          onClick={() => !isDeleting && setConfirmDeleteId(null)}
        >
          <div
            ref={deleteDialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Изтриване на план"
            className="tp-modal tp-modal--confirm"
            onClick={(event) => event.stopPropagation()}
          >
            <h2>Изтриване на план</h2>
            <p>
              Сигурни ли сте, че искате да изтриете “
              {planToDelete?.title ?? "този план"}”?
            </p>
            {error && <p className="tp-error" role="alert">{error}</p>}
            <div className="tp-modal-actions">
              <button
                className="tp-secondary-btn"
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                disabled={isDeleting}
              >
                Отказ
              </button>
              <button
                className="tp-danger-btn"
                type="button"
                onClick={() => void deletePlan()}
                disabled={isDeleting}
              >
                {isDeleting ? "Изтриване..." : "Изтрий"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function matchesCategory(plan: TrainingPlanSummary, filter: string) {
  if (!filter) return true;
  return filter === "uncategorized" ? !plan.categoryId : plan.categoryId === filter;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("bg-BG", {
    timeZone: "Europe/Sofia",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
