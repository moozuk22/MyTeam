"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Printer, X } from "lucide-react";
import type { PlanContent, SavedDocument } from "@/lib/exercise/document";
import { documentRequest } from "../documents/documentRequest";

/** One training of the week. `documentId` is null for a plan of another author and undefined when the training has no plan. */
export type PrintTraining = { rowId: string; number: number; documentId: string | null | undefined };
export type PrintChoice = { week: boolean; documents: { rowId: string; number: number; content: PlanContent }[] };

type Loaded = Record<string, { content: PlanContent } | { error: string }>;

/** Lets the user choose the weekly microcycle and the plans of the trainings to print. Each item prints on a separate page. */
export default function PrintChoiceDialog({ pdf, endpoint, coachGroupId, weekLabel, trainings, onConfirm, onClose }: {
  pdf: boolean; endpoint: string; coachGroupId?: string; weekLabel: string; trainings: PrintTraining[];
  onConfirm: (choice: PrintChoice) => void; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [week, setWeek] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [loaded, setLoaded] = useState<Loaded>({});
  // The effect reads the loaded plans without a new load on each change.
  const loadedRef = useRef(loaded);
  useEffect(() => { loadedRef.current = loaded; }, [loaded]);
  const [attempt, setAttempt] = useState(0);
  const linked = trainings.filter((training): training is PrintTraining & { documentId: string } => !!training.documentId);

  useEffect(() => {
    const element = dialog.current;
    const trigger = globalThis.document.activeElement;
    element?.showModal();
    return () => {
      element?.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);

  const ids = linked.map((training) => training.documentId).join(",");
  useEffect(() => {
    const abort = new AbortController();
    // A week has at most 30 trainings, so the number of requests is bounded.
    for (const id of new Set(ids.split(",").filter(Boolean))) {
      // A retry loads only the plans that failed. The loaded plans stay selected and ready.
      const current = loadedRef.current[id];
      if (current && "content" in current) continue;
      void documentRequest<{ document: SavedDocument }>(`${endpoint}/${id}`, "План-конспектът не може да се зареди.", { signal: abort.signal }, coachGroupId)
        .then(({ document }) => { if (!abort.signal.aborted) setLoaded((current) => ({ ...current, [id]: { content: document.content } })); })
        .catch((failure: Error) => { if (!abort.signal.aborted) setLoaded((current) => ({ ...current, [id]: { error: failure.message } })); });
    }
    return () => abort.abort();
  }, [endpoint, coachGroupId, ids, attempt]);

  const entry = (training: PrintTraining & { documentId: string }) => loaded[training.documentId];
  const available = linked.filter((training) => { const value = entry(training); return value && "content" in value; });
  // "Избери всички" also selects the plans that still load. They join the print when they arrive.
  const selectable = linked.filter((training) => { const value = entry(training); return !value || "content" in value; });
  const waiting = selectable.some((training) => selected.has(training.rowId) && !entry(training));
  // Only plans that are loaded can print. The count and the confirmation use the same list.
  const chosen = available.filter((training) => selected.has(training.rowId));
  const allSelected = week && selectable.every((training) => selected.has(training.rowId));
  const count = (week ? 1 : 0) + selectable.filter((training) => selected.has(training.rowId)).length;
  const failed = linked.some((training) => { const value = entry(training); return value && "error" in value; });
  const toggle = (rowId: string) => setSelected((current) => { const next = new Set(current); if (!next.delete(rowId)) next.add(rowId); return next; });

  function confirm() {
    if (!count || waiting) return;
    onConfirm({ week, documents: chosen.map((training) => ({
      rowId: training.rowId, number: training.number,
      content: (loaded[training.documentId] as { content: PlanContent }).content,
    })) });
  }

  function trainingState(training: PrintTraining) {
    if (training.documentId === undefined) return "Няма план-конспект";
    if (training.documentId === null) return "Има план-конспект от друг автор";
    const value = loaded[training.documentId];
    if (!value) return null;
    return "error" in value ? value.error : value.content.session.title.trim() || "План-конспект";
  }

  return <dialog ref={dialog} className="tp-modal mc-print-dialog" aria-labelledby="mc-print-dialog-title"
    onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <div className="tp-modal-header">
      <h2 id="mc-print-dialog-title">{pdf ? "Какво да включим в PDF файла?" : "Какво да отпечатаме?"}</h2>
      <button type="button" className="tp-icon-btn" aria-label="Затвори" onClick={onClose}><X size={20} aria-hidden="true" /></button>
    </div>
    <p className="mc-print-note">Седмицата и всяка тренировка започват на отделна страница.</p>
    <button type="button" className="tp-secondary-btn mc-print-all"
      onClick={() => { const value = !allSelected; setWeek(value); setSelected(new Set(value ? selectable.map((training) => training.rowId) : [])); }}>
      {allSelected ? "Премахни избора" : "Избери всички"}
    </button>
    <fieldset className="mc-print-options">
      <legend className="td-sr-only">Страници за печат</legend>
      <label className="mc-print-option">
        <input type="checkbox" checked={week} onChange={(event) => setWeek(event.target.checked)} />
        <span><strong>Седмичен микроцикъл</strong><small>{weekLabel}</small></span>
      </label>
      {trainings.map((training) => {
        const state = trainingState(training);
        const ready = available.includes(training as PrintTraining & { documentId: string });
        const pending = state === null;
        return <label className="mc-print-option" key={training.rowId} aria-busy={state === null || undefined}>
          <input type="checkbox" disabled={!ready} checked={(ready || pending) && selected.has(training.rowId)} onChange={() => toggle(training.rowId)} />
          <span>
            <strong>Тренировка № {training.number}</strong>
            {state === null
              ? <span className="td-skeleton td-skeleton--meta" role="status" aria-label="Зареждане" />
              : <small>{state}</small>}
          </span>
        </label>;
      })}
    </fieldset>
    {failed && <div role="alert" className="td-feedback mc-print-error">Някои план-конспекти не могат да се заредят.
      <button type="button" className="tp-secondary-btn" onClick={() => {
        setLoaded((current) => Object.fromEntries(Object.entries(current).filter(([, value]) => "content" in value)));
        setAttempt((value) => value + 1);
      }}>Опитай отново</button>
    </div>}
    <div className="mc-print-actions">
      <button type="button" className="tp-secondary-btn" onClick={onClose}>Отказ</button>
      <button type="button" className="tp-primary-btn" disabled={!count || waiting} aria-busy={waiting || undefined} onClick={confirm}>
        {pdf ? <Download size={16} aria-hidden="true" /> : <Printer size={16} aria-hidden="true" />}
        {pdf ? "Изтегли PDF" : "Печат"}{count > 0 && ` (${count})`}
      </button>
    </div>
  </dialog>;
}
