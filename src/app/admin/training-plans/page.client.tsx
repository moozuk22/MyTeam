"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ClipboardList,
  Copy,
  Edit2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import FinanceSkeleton from "@/app/admin/members/_components/FinanceSkeleton";
import "./page.css";

type ClubOption = {
  id: string;
  name: string;
};

type TrainingPlanSummary = {
  id: string;
  title: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  layoutVersion?: number;
};

type PlanModalMode = "create" | "edit";

export default function TrainingPlansClient({
  clubs,
  defaultClubId,
  initialPlans,
  initialCursor = null,
}: {
  clubs: ClubOption[];
  defaultClubId: string;
  initialPlans: TrainingPlanSummary[];
  initialCursor?: string | null;
}) {
  const router = useRouter();
  const selectedClubId = defaultClubId;
  const [plans, setPlans] = useState<TrainingPlanSummary[]>(initialPlans);
  const [isLoading, setIsLoading] = useState(false);
  const [nextCursor, setNextCursor] = useState(initialCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [modalMode, setModalMode] = useState<PlanModalMode | null>(null);
  const [editingPlan, setEditingPlan] = useState<TrainingPlanSummary | null>(
    null,
  );
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formError, setFormError] = useState("");
  const [createVersion, setCreateVersion] = useState(1);
  const [copying, setCopying] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const dialogTrigger = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!modalMode && !confirmDeleteId) return;
    const dialog = document.querySelector<HTMLElement>(".tp-modal");
    if (!dialog) return;
    (
      dialog.querySelector<HTMLElement>("input") ??
      dialog.querySelector<HTMLElement>("button")
    )?.focus();
    const handle = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSaving && !isDeleting) {
        event.preventDefault();
        setModalMode(null);
        setConfirmDeleteId(null);
      }
      if (event.key !== "Tab") return;
      const elements = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input, textarea, [tabindex='0']",
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
  }, [modalMode, confirmDeleteId, isSaving, isDeleting]);

  const selectedClub = useMemo(
    () => clubs.find((club) => club.id === selectedClubId) ?? null,
    [clubs, selectedClubId],
  );
  const planToDelete = useMemo(
    () => plans.find((plan) => plan.id === confirmDeleteId) ?? null,
    [confirmDeleteId, plans],
  );

  useEffect(() => {
    if (!selectedClubId) {
      setPlans([]);
      return;
    }

    if (selectedClubId === defaultClubId) {
      setPlans(initialPlans);
      setNextCursor(initialCursor);
      return;
    }

    let cancelled = false;
    async function loadPlans() {
      setIsLoading(true);
      setError("");
      try {
        const res = await fetch(
          `/api/admin/clubs/${selectedClubId}/training-plans`,
          { cache: "no-store" },
        );
        const payload = await res.json().catch(() => ({}));
        if (!res.ok)
          throw new Error(
            typeof payload.error === "string"
              ? payload.error
              : "Грешка при зареждане.",
          );
        if (!cancelled)
          setPlans(Array.isArray(payload.plans) ? payload.plans : []);
      } catch (err) {
        if (!cancelled) {
          setPlans([]);
          setError(
            err instanceof Error ? err.message : "Грешка при зареждане.",
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadPlans();
    return () => {
      cancelled = true;
    };
  }, [defaultClubId, initialPlans, initialCursor, selectedClubId]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setError("");
    try {
      const res = await fetch(
        `/api/admin/clubs/${selectedClubId}/training-plans?cursor=${encodeURIComponent(nextCursor)}`,
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

  function openCreateModal(version = 1) {
    dialogTrigger.current = document.activeElement as HTMLElement;
    setCreateVersion(version);
    setModalMode("create");
    setEditingPlan(null);
    setFormTitle("");
    setFormDescription("");
    setFormError("");
  }

  function openEditModal(plan: TrainingPlanSummary) {
    dialogTrigger.current = document.activeElement as HTMLElement;
    setModalMode("edit");
    setEditingPlan(plan);
    setFormTitle(plan.title);
    setFormDescription(plan.description ?? "");
    setFormError("");
  }

  function closeModal() {
    if (isSaving) return;
    setModalMode(null);
    setEditingPlan(null);
    setFormError("");
  }

  async function savePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedClubId) return;

    const title = formTitle.trim();
    const description = formDescription.trim();
    if (!title) {
      setFormError("Името е задължително.");
      return;
    }
    if (title.length > 200) {
      setFormError("Името е твърде дълго.");
      return;
    }
    if (description.length > 1000) {
      setFormError("Описанието е твърде дълго.");
      return;
    }

    setIsSaving(true);
    setFormError("");
    try {
      const isEdit = modalMode === "edit" && editingPlan;
      const res = await fetch(
        isEdit
          ? `/api/admin/clubs/${selectedClubId}/training-plans/${editingPlan.id}`
          : `/api/admin/clubs/${selectedClubId}/training-plans`,
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            description,
            ...(isEdit
              ? { expectedUpdatedAt: editingPlan.updatedAt }
              : { editorVersion: createVersion }),
          }),
        },
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(
          typeof payload.error === "string"
            ? payload.error
            : "Грешка при запис.",
        );
      const nextPlan = payload.plan as TrainingPlanSummary | undefined;
      if (!nextPlan) throw new Error("Невалиден отговор от сървъра.");
      setPlans((prev) => {
        if (isEdit) {
          return prev.map((plan) =>
            plan.id === nextPlan.id ? { ...plan, ...nextPlan } : plan,
          );
        }
        return [nextPlan, ...prev];
      });
      setModalMode(null);
      setEditingPlan(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Грешка при запис.");
    } finally {
      setIsSaving(false);
    }
  }

  async function duplicatePlan(plan: TrainingPlanSummary, convert = false) {
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
            editorVersion: convert ? 2 : (plan.layoutVersion ?? 1),
          }),
        },
      );
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Грешка при копиране.");
      setPlans((prev) => [payload.plan, ...prev]);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Грешка при изтриване.");
    } finally {
      setIsDeleting(false);
    }
  }

  function openEditor(planId: string) {
    router.push(
      `/admin/training-plans/${encodeURIComponent(planId)}${plans.find((p) => p.id === planId)?.layoutVersion === 2 ? "/konva" : ""}?clubId=${encodeURIComponent(selectedClubId)}`,
    );
  }

  return (
    <main className="tp-page">
      <div className="tp-dot-grid" aria-hidden="true" />
      <div className="tp-inner">
        <header className="tp-header">
          <button
            className="tp-back-btn"
            type="button"
            onClick={() =>
              router.push(
                `/admin/members?clubId=${encodeURIComponent(selectedClubId)}`,
              )
            }
          >
            <ArrowLeft size={16} />
            <span>Назад</span>
          </button>
          <div>
            <p className="tp-kicker">Шаблони</p>
            <h1 className="tp-title">Планове за тренировки</h1>
            <div className="tp-title-line" />
          </div>
        </header>

        <section className="tp-actions">
          <div>
            <h2>{selectedClub?.name ?? "Няма избран отбор"}</h2>
            <p>{plans.length === 1 ? "1 план" : `${plans.length} плана`}</p>
          </div>
          <button
            className="tp-primary-btn"
            type="button"
            onClick={() => openCreateModal()}
            disabled={!selectedClubId}
          >
            <Plus size={18} />
            <span>Нов план</span>
          </button>
          <button
            className="tp-primary-btn"
            type="button"
            onClick={() => openCreateModal(2)}
            disabled={!selectedClubId}
          >
            Нов план — Konva
          </button>
        </section>

        {error && <p className="tp-error">{error}</p>}

        <section className="tp-grid" aria-busy={isLoading}>
          {isLoading ? (
            <FinanceSkeleton variant="form" />
          ) : plans.length === 0 ? (
            <div className="tp-empty">
              <ClipboardList size={28} />
              <p>Все още няма планове за този отбор.</p>
            </div>
          ) : (
            plans.map((plan) => (
              <article className="tp-card" key={plan.id}>
                <div
                  className="tp-card-main"
                  onClick={() => openEditor(plan.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openEditor(plan.id);
                    }
                  }}
                >
                  <h3>{plan.title}</h3>
                  <span>
                    {plan.layoutVersion === 2 ? "Konva" : "HTML/CSS — оригинал"}
                  </span>
                  <p>{plan.description || "Без описание"}</p>
                  <span>Обновен: {formatDate(plan.updatedAt)}</span>
                </div>
                <div className="tp-card-actions">
                  <button
                    type="button"
                    onClick={() => openEditor(plan.id)}
                    title="Редактирай диаграмата"
                  >
                    <Edit2 size={16} />
                    <span>Редактирай</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditModal(plan)}
                    title="Редактирай име и описание"
                    aria-label="Редактирай име и описание"
                  >
                    <ClipboardList size={16} />
                    <span>Детайли</span>
                  </button>
                  <button
                    type="button"
                    disabled={copying}
                    onClick={() => void duplicatePlan(plan)}
                    title="Дублирай"
                  >
                    <Copy size={16} />
                    <span>Дублирай</span>
                  </button>
                  {plan.layoutVersion !== 2 && (
                    <button
                      type="button"
                      disabled={copying}
                      onClick={() => void duplicatePlan(plan, true)}
                    >
                      Копирай в Konva
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      dialogTrigger.current =
                        document.activeElement as HTMLElement;
                      setConfirmDeleteId(plan.id);
                    }}
                    title="Изтрий"
                  >
                    <Trash2 size={16} />
                    <span>Изтрий</span>
                  </button>
                </div>
              </article>
            ))
          )}
        </section>
        {nextCursor && (
          <button
            type="button"
            className="tp-secondary-btn"
            disabled={loadingMore}
            onClick={() => void loadMore()}
          >
            {loadingMore ? "Показване…" : "Покажи още планове"}
          </button>
        )}
      </div>

      {modalMode && (
        <div className="tp-overlay" onClick={closeModal}>
          <form
            className="tp-modal"
            role="dialog"
            aria-modal="true"
            aria-label={
              modalMode === "create"
                ? createVersion === 2
                  ? "Нов план — Konva"
                  : "Нов план — HTML/CSS"
                : "Редакция на план"
            }
            onSubmit={savePlan}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="tp-modal-header">
              <h2>
                {modalMode === "create"
                  ? createVersion === 2
                    ? "Нов план — Konva"
                    : "Нов план — HTML/CSS"
                  : "Редакция на план"}
              </h2>
              <button
                type="button"
                className="tp-icon-btn"
                onClick={closeModal}
                disabled={isSaving}
                aria-label="Затвори"
              >
                <X size={18} />
              </button>
            </div>
            <label className="tp-field">
              <span>Име</span>
              <input
                value={formTitle}
                maxLength={200}
                onChange={(event) => setFormTitle(event.target.value)}
                autoFocus
              />
            </label>
            <label className="tp-field">
              <span>Описание</span>
              <textarea
                value={formDescription}
                maxLength={1000}
                rows={5}
                onChange={(event) => setFormDescription(event.target.value)}
              />
            </label>
            {formError && <p className="tp-error">{formError}</p>}
            <div className="tp-modal-actions">
              <button
                type="button"
                className="tp-secondary-btn"
                onClick={closeModal}
                disabled={isSaving}
              >
                Отказ
              </button>
              <button
                type="submit"
                className="tp-primary-btn"
                disabled={isSaving}
              >
                {isSaving ? "Запазване..." : "Запази"}
              </button>
            </div>
          </form>
        </div>
      )}

      {confirmDeleteId && (
        <div
          className="tp-overlay"
          onClick={() => !isDeleting && setConfirmDeleteId(null)}
        >
          <div
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

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("bg-BG", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
