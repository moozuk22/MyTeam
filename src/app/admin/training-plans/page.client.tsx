"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
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
import { DEFAULT_LAYOUT } from "@/lib/trainingPlans";
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
};

type PlanModalMode = "create" | "edit";

export default function TrainingPlansClient({
  clubs,
  defaultClubId,
  initialPlans,
}: {
  clubs: ClubOption[];
  defaultClubId: string;
  initialPlans: TrainingPlanSummary[];
}) {
  const router = useRouter();
  const selectedClubId = defaultClubId;
  const [plans, setPlans] = useState<TrainingPlanSummary[]>(initialPlans);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [modalMode, setModalMode] = useState<PlanModalMode | null>(null);
  const [editingPlan, setEditingPlan] = useState<TrainingPlanSummary | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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
      return;
    }

    let cancelled = false;
    async function loadPlans() {
      setIsLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/admin/clubs/${selectedClubId}/training-plans`, { cache: "no-store" });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(typeof payload.error === "string" ? payload.error : "Грешка при зареждане.");
        if (!cancelled) setPlans(Array.isArray(payload.plans) ? payload.plans : []);
      } catch (err) {
        if (!cancelled) {
          setPlans([]);
          setError(err instanceof Error ? err.message : "Грешка при зареждане.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadPlans();
    return () => {
      cancelled = true;
    };
  }, [defaultClubId, initialPlans, selectedClubId]);

  function openCreateModal() {
    setModalMode("create");
    setEditingPlan(null);
    setFormTitle("");
    setFormDescription("");
    setFormError("");
  }

  function openEditModal(plan: TrainingPlanSummary) {
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
          body: JSON.stringify({ title, description }),
        },
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof payload.error === "string" ? payload.error : "Грешка при запис.");
      const nextPlan = payload.plan as TrainingPlanSummary | undefined;
      if (!nextPlan) throw new Error("Невалиден отговор от сървъра.");
      setPlans((prev) => {
        if (isEdit) {
          return prev.map((plan) => (plan.id === nextPlan.id ? { ...plan, ...nextPlan } : plan));
        }
        return [nextPlan, ...prev];
      });
      closeModal();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Грешка при запис.");
    } finally {
      setIsSaving(false);
    }
  }

  async function duplicatePlan(plan: TrainingPlanSummary) {
    if (!selectedClubId) return;
    setError("");
    try {
      const detailRes = await fetch(`/api/admin/clubs/${selectedClubId}/training-plans/${plan.id}`, { cache: "no-store" });
      const detailPayload = await detailRes.json().catch(() => ({}));
      if (!detailRes.ok) throw new Error(typeof detailPayload.error === "string" ? detailPayload.error : "Грешка при копиране.");
      const sourcePlan = detailPayload.plan;
      const createRes = await fetch(`/api/admin/clubs/${selectedClubId}/training-plans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${plan.title} - копие`,
          description: plan.description ?? "",
          layout: sourcePlan?.layout ?? DEFAULT_LAYOUT,
        }),
      });
      const createPayload = await createRes.json().catch(() => ({}));
      if (!createRes.ok) throw new Error(typeof createPayload.error === "string" ? createPayload.error : "Грешка при копиране.");
      if (createPayload.plan) setPlans((prev) => [createPayload.plan, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Грешка при копиране.");
    }
  }

  async function deletePlan() {
    if (!selectedClubId || !confirmDeleteId) return;
    setIsDeleting(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/clubs/${selectedClubId}/training-plans/${confirmDeleteId}`, {
        method: "DELETE",
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof payload.error === "string" ? payload.error : "Грешка при изтриване.");
      setPlans((prev) => prev.filter((plan) => plan.id !== confirmDeleteId));
      setConfirmDeleteId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Грешка при изтриване.");
    } finally {
      setIsDeleting(false);
    }
  }

  function openEditor(planId: string) {
    router.push(`/admin/training-plans/${encodeURIComponent(planId)}?clubId=${encodeURIComponent(selectedClubId)}`);
  }

  return (
    <main className="tp-page">
      <div className="tp-dot-grid" aria-hidden="true" />
      <div className="tp-inner">
        <header className="tp-header">
          <button className="tp-back-btn" type="button" onClick={() => router.push(`/admin/members?clubId=${encodeURIComponent(selectedClubId)}`)}>
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
          <button className="tp-primary-btn" type="button" onClick={openCreateModal} disabled={!selectedClubId}>
            <Plus size={18} />
            <span>Нов план</span>
          </button>
        </section>

        {error && <p className="tp-error">{error}</p>}

        <section className="tp-grid" aria-busy={isLoading}>
          {isLoading ? (
            <div className="tp-empty">Зареждане...</div>
          ) : plans.length === 0 ? (
            <div className="tp-empty">
              <ClipboardList size={28} />
              <p>Все още няма планове за този отбор.</p>
            </div>
          ) : (
            plans.map((plan) => (
              <article className="tp-card" key={plan.id}>
                <div className="tp-card-main" onClick={() => openEditor(plan.id)} role="button" tabIndex={0}>
                  <h3>{plan.title}</h3>
                  <p>{plan.description || "Без описание"}</p>
                  <span>Обновен: {formatDate(plan.updatedAt)}</span>
                </div>
                <div className="tp-card-actions">
                  <button type="button" onClick={() => openEditor(plan.id)} title="Редактирай диаграмата">
                    <Edit2 size={16} />
                    <span>Edit</span>
                  </button>
                  <button type="button" onClick={() => openEditModal(plan)} title="Редактирай име и описание">
                    <ClipboardList size={16} />
                    <span>Details</span>
                  </button>
                  <button type="button" onClick={() => void duplicatePlan(plan)} title="Дублирай">
                    <Copy size={16} />
                    <span>Duplicate</span>
                  </button>
                  <button type="button" onClick={() => setConfirmDeleteId(plan.id)} title="Изтрий">
                    <Trash2 size={16} />
                    <span>Delete</span>
                  </button>
                </div>
              </article>
            ))
          )}
        </section>
      </div>

      {modalMode && (
        <div className="tp-overlay" onClick={closeModal}>
          <form className="tp-modal" onSubmit={savePlan} onClick={(event) => event.stopPropagation()}>
            <div className="tp-modal-header">
              <h2>{modalMode === "create" ? "Нов план" : "Редакция на план"}</h2>
              <button type="button" className="tp-icon-btn" onClick={closeModal} disabled={isSaving} aria-label="Затвори">
                <X size={18} />
              </button>
            </div>
            <label className="tp-field">
              <span>Име</span>
              <input value={formTitle} maxLength={200} onChange={(event) => setFormTitle(event.target.value)} autoFocus />
            </label>
            <label className="tp-field">
              <span>Описание</span>
              <textarea value={formDescription} maxLength={1000} rows={5} onChange={(event) => setFormDescription(event.target.value)} />
            </label>
            {formError && <p className="tp-error">{formError}</p>}
            <div className="tp-modal-actions">
              <button type="button" className="tp-secondary-btn" onClick={closeModal} disabled={isSaving}>
                Отказ
              </button>
              <button type="submit" className="tp-primary-btn" disabled={isSaving}>
                {isSaving ? "Запазване..." : "Запази"}
              </button>
            </div>
          </form>
        </div>
      )}

      {confirmDeleteId && (
        <div className="tp-overlay" onClick={() => !isDeleting && setConfirmDeleteId(null)}>
          <div className="tp-modal tp-modal--confirm" onClick={(event) => event.stopPropagation()}>
            <h2>Изтриване на план</h2>
            <p>Сигурни ли сте, че искате да изтриете “{planToDelete?.title ?? "този план"}”?</p>
            <div className="tp-modal-actions">
              <button className="tp-secondary-btn" type="button" onClick={() => setConfirmDeleteId(null)} disabled={isDeleting}>
                Отказ
              </button>
              <button className="tp-danger-btn" type="button" onClick={() => void deletePlan()} disabled={isDeleting}>
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
