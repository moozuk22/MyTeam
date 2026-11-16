"use client";

import { useCallback, useId, useRef, useState } from "react";
import { Edit2, Plus, SlidersHorizontal, Trash2, X } from "lucide-react";

export type CategoryOption = { id: string; name: string; clubId?: string | null };

type CategoryAction =
  | { type: "add" }
  | { type: "edit" | "delete"; category: CategoryOption };

export default function CategoryManager({
  categories,
  clubId,
  disabled,
  onSave,
  onDelete,
}: {
  categories: readonly CategoryOption[];
  clubId: string;
  disabled: boolean;
  onSave: (category: CategoryOption) => void;
  onDelete: (id: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useId();
  const [action, setAction] = useState<CategoryAction | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  function choose(next: CategoryAction | null) {
    setAction(next);
    setName(next?.type === "edit" ? next.category.name : "");
    setError("");
    setFeedback("");
  }

  const focusAction = useCallback((element: HTMLElement | null) => {
    element?.focus();
  }, []);

  async function submit() {
    if (!action || busy) return;
    const deleting = action.type === "delete";
    const adding = action.type === "add";
    const endpoint = `/api/admin/clubs/${clubId}/training-plans/categories`;
    const fallback = deleting ? "Грешка при изтриване на категорията." : "Грешка при запазване на категорията.";
    setBusy(true);
    setError("");
    try {
      const response = await fetch(adding ? endpoint : `${endpoint}/${action.category.id}`, deleting
        ? { method: "DELETE" }
        : {
            method: adding ? "POST" : "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name }),
          });
      const result = await response.json().catch(() => null);
      if (!response.ok || (deleting ? !result?.success : !result?.category))
        throw new Error(result?.error || fallback);

      choose(null);
      setFeedback(deleting ? "Категорията е изтрита." : "Категорията е запазена.");
      if (deleting) {
        onDelete(action.category.id);
      } else {
        onSave({
          ...result.category,
          clubId: adding && response.status === 200 ? result.category.clubId : clubId,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : fallback);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="tp-secondary-btn tp-manage-categories" disabled={disabled} onClick={() => dialog.current?.showModal()}>
        <SlidersHorizontal size={18} aria-hidden="true" />
        Управление на категориите
      </button>
      <dialog
        ref={dialog}
        className="tp-modal tp-category-manager"
        aria-labelledby={heading}
        onCancel={(event) => {
          if (busy) event.preventDefault();
        }}
        onClose={() => choose(null)}
      >
        <div className="tp-modal-header">
          <h2 id={heading}>Категории</h2>
          <button type="button" className="tp-icon-btn" aria-label="Затвори" disabled={busy} onClick={() => dialog.current?.close()}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {action ? (
          <form onSubmit={(event) => { event.preventDefault(); void submit(); }}>
            {action.type === "delete" ? (
              <p>Да изтрием ли „{action.category.name}“? Плановете в тази категория ще останат без категория.</p>
            ) : (
              <label className="tp-field">
                <span>{action.type === "add" ? "Нова категория" : "Име на категорията"}</span>
                <input
                  ref={focusAction}
                  value={name}
                  required
                  maxLength={60}
                  disabled={busy}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
            )}
            {error && <p className="tp-error" role="alert">{error}</p>}
            <div className="tp-modal-actions">
              <button className="tp-secondary-btn" type="button" ref={action.type === "delete" ? focusAction : undefined} disabled={busy} onClick={() => choose(null)}>Отказ</button>
              <button
                className={action.type === "delete" ? "tp-danger-btn" : "tp-primary-btn"}
                type="submit"
                disabled={busy || (action.type !== "delete" && !name.trim())}
              >
                {action.type === "delete" ? (busy ? "Изтриване…" : "Изтрий") : (busy ? "Записване…" : "Запази")}
              </button>
            </div>
          </form>
        ) : (
          <>
            <button type="button" className="tp-primary-btn tp-category-add" ref={focusAction} onClick={() => choose({ type: "add" })}>
              <Plus size={16} aria-hidden="true" />
              Нова категория
            </button>
            {feedback && <p role="status">{feedback}</p>}
            <ul className="tp-category-list">
              {categories.map((category) => (
                <li key={category.id}>
                  <span>{category.name}</span>
                  {category.clubId === clubId ? (
                    <div>
                      <button type="button" className="tp-icon-btn" aria-label={`Преименувай ${category.name}`} onClick={() => choose({ type: "edit", category })}>
                        <Edit2 size={16} aria-hidden="true" />
                      </button>
                      <button type="button" className="tp-icon-btn" aria-label={`Изтрий ${category.name}`} onClick={() => choose({ type: "delete", category })}>
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </div>
                  ) : <small>Стандартна</small>}
                </li>
              ))}
            </ul>
          </>
        )}
      </dialog>
    </>
  );
}
