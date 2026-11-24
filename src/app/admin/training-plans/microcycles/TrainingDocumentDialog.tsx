"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Eye, RefreshCw, Replace, Unlink, X } from "lucide-react";
import { useBrowserDialogs } from "@/components/admin/BrowserDialogProvider";
import { summarizeDocument, type SavedDocument } from "@/lib/exercise/document";
import { DocumentCardContent, formatUpdated } from "../documents/DocumentCard";
import { documentRequest } from "../documents/documentRequest";

type Loaded = { id: string; title: string; updatedAt: string; preview: ReturnType<typeof summarizeDocument>; usages: SavedDocument["usages"] };

/**
 * Shows the plan of a training as a card, with a link to its preview, a link to choose another plan,
 * and a button that removes the plan from the training.
 */
export default function TrainingDocumentDialog({ endpoint, documentId, coachGroupId, previewHref, chooseHref, onNavigate, onRemove, onClose }: {
  endpoint: string; documentId: string; coachGroupId?: string; previewHref: string; chooseHref: string;
  onNavigate: (event: { preventDefault: () => void }, href: string) => void;
  /** Removes the link between the plan and the training. It rejects with a message when the removal fails. */
  onRemove: () => Promise<void>; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [document, setDocument] = useState<Loaded>();
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState("");
  const dialogs = useBrowserDialogs();

  async function remove() {
    if (removing || !await dialogs.confirm("Да премахнем ли план-конспекта от тази тренировка? Той остава в библиотеката с план-конспекти.",
      { title: "Премахване на план-конспекта", confirmLabel: "Премахни" })) return;
    setRemoving(true); setRemoveError("");
    try {
      await onRemove();
    } catch (failure) {
      setRemoveError(failure instanceof Error ? failure.message : "План-конспектът не може да бъде премахнат.");
      setRemoving(false);
    }
  }

  useEffect(() => {
    const element = dialog.current;
    const trigger = globalThis.document.activeElement;
    element?.showModal();
    return () => {
      element?.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const abort = new AbortController();
    void documentRequest<{ document: SavedDocument }>(`${endpoint}/${documentId}`, "План-конспектът не може да се зареди.", { signal: abort.signal }, coachGroupId)
      .then(({ document }) => {
        if (abort.signal.aborted) return;
        const preview = summarizeDocument(document.content);
        setDocument({ id: document.id, title: document.content.session.title.trim() || "План-конспект", updatedAt: document.updatedAt, preview, usages: document.usages });
      })
      .catch((failure: Error) => { if (!abort.signal.aborted) setError(failure.message); });
    return () => abort.abort();
  }, [endpoint, documentId, coachGroupId, attempt]);

  return <dialog ref={dialog} className="tp-modal mc-doc-dialog" aria-labelledby="mc-doc-dialog-title"
    onCancel={(event) => { event.preventDefault(); if (!removing) onClose(); }}>
    <div className="tp-modal-header">
      <h2 id="mc-doc-dialog-title">План-конспект на тренировката</h2>
      <button type="button" className="tp-icon-btn" aria-label="Затвори" disabled={removing} onClick={onClose}><X size={20} aria-hidden="true" /></button>
    </div>
    {error
      ? <div role="alert" className="td-feedback">{error} <button type="button" className="tp-secondary-btn"
          onClick={() => { setError(""); setAttempt((value) => value + 1); }}>Опитай отново</button></div>
      : !document
        ? <div className="td-document-card td-document-card--skeleton" role="status" aria-label="Зареждане" aria-busy="true">
            <span className="td-skeleton td-skeleton--title" aria-hidden="true" />
            <span className="td-skeleton td-skeleton--meta" aria-hidden="true" />
          </div>
        : <div className="td-document-card">
            <div className="td-document-open"><DocumentCardContent item={document} /></div>
            <div className="td-document-footer">
              <time dateTime={document.updatedAt}><RefreshCw size={14} aria-hidden="true" />Обновен {formatUpdated(document.updatedAt)}</time>
            </div>
            <div className="mc-doc-dialog-actions">
              <Link className="tp-primary-btn" href={previewHref} onNavigate={(event) => onNavigate(event, previewHref)}><Eye size={16} aria-hidden="true" />Преглед</Link>
              <Link className="tp-secondary-btn" href={chooseHref} onNavigate={(event) => onNavigate(event, chooseHref)}><Replace size={16} aria-hidden="true" />Избери друг</Link>
              <button type="button" className="tp-danger-btn" disabled={removing} onClick={() => void remove()}>
                <Unlink size={16} aria-hidden="true" />{removing ? "Премахване…" : "Премахни от тренировката"}
              </button>
            </div>
            {removeError && <div role="alert" className="td-feedback mc-doc-dialog-error">{removeError}</div>}
          </div>}
  </dialog>;
}
