"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { DrawingSnapshot } from "@/lib/exercise/document";
import type { Exercise } from "@/lib/exercise/model";
import FinanceSkeleton from "../../members/_components/FinanceSkeleton";
import { documentRequest } from "./documentRequest";

const PlanPreview = dynamic(() => import("../PlanPreview"), { ssr: false, loading: () => <FinanceSkeleton variant="chart" /> });
type DrawingSummary = { id: string; title: string; creatorName: string | null; layoutVersion: number };
type DrawingPage = { plans: DrawingSummary[]; nextCursor: string | null };

export default function DrawingPicker({ endpoint, location, onPick, onClose }: {
  endpoint: string; location: string; onPick: (drawing: DrawingSnapshot) => void; onClose: () => void;
}) {
  const [page, setPage] = useState<DrawingPage>();
  const [cursor, setCursor] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [selection, setSelection] = useState<string>();
  const [preview, setPreview] = useState<DrawingSnapshot>();
  const [listError, setListError] = useState("");
  const [previewError, setPreviewError] = useState("");

  useEffect(() => {
    const abort = new AbortController();
    const query = new URLSearchParams({ scope: "club" });
    if (cursor) query.set("cursor", cursor);
    void documentRequest<DrawingPage>(`${endpoint}?${query}`, "Рисунките не могат да се заредят.", { signal: abort.signal })
      .then(setPage)
      .catch((error: Error) => { if (!abort.signal.aborted) setListError(error.message); });
    return () => abort.abort();
  }, [endpoint, cursor, attempt]);

  useEffect(() => {
    if (!selection) return;
    const abort = new AbortController();
    void documentRequest<{ plan: { id: string; title: string; layout: Exercise } }>(
      `${endpoint}/${selection}`, "Рисунката не може да се зареди.", { signal: abort.signal },
    ).then(({ plan }) => {
      if (plan.layout?.version !== 2) throw new Error("Първо копирайте рисунката в новия редактор.");
      setPreview({ sourceId: plan.id, title: plan.title, layout: plan.layout });
    }).catch((error: Error) => { if (!abort.signal.aborted) setPreviewError(error.message); });
    return () => abort.abort();
  }, [endpoint, selection]);

  function resetPage(next: string | null) {
    setPage(undefined);
    setListError("");
    setCursor(next);
    setAttempt((value) => value + 1);
  }

  return <section className="td-picker" aria-label="Избор на рисунка">
    <div className="td-actions">
      <h3>Рисунки на клуба</h3>
      <button type="button" className="tp-secondary-btn" onClick={onClose}>Затвори избора</button>
    </div>
    {listError && <div role="alert" className="td-feedback">
      {listError} <button type="button" className="tp-secondary-btn" onClick={() => resetPage(cursor)}>Опитай отново</button>
    </div>}
    {!page && !listError && <FinanceSkeleton variant="form" />}
    {page?.plans.length === 0 && <p className="td-muted">Няма запазени рисунки на тази страница.</p>}
    {page && <ul className="td-drawing-list">
      {page.plans.map((drawing) => <li key={drawing.id}>
        {drawing.layoutVersion === 2
          ? <button type="button" className="tp-secondary-btn" aria-pressed={selection === drawing.id}
            onClick={() => { setPreview(undefined); setPreviewError(""); setSelection(drawing.id); }}
            disabled={selection === drawing.id}>
              {drawing.title}{drawing.creatorName && <small>{drawing.creatorName}</small>}
            </button>
          : <Link className="tp-secondary-btn" target="_blank" href={`/admin/training-plans/${drawing.id}?${location}`}>
              {drawing.title} <small>Отвори за копиране в новия редактор</small>
            </Link>}
      </li>)}
    </ul>}
    {(cursor || page?.nextCursor) && <div className="td-actions">
      {cursor && <button type="button" className="tp-secondary-btn" onClick={() => resetPage(null)}>Първа страница</button>}
      {page?.nextCursor && <button type="button" className="tp-secondary-btn" onClick={() => resetPage(page.nextCursor)}>Следваща страница</button>}
    </div>}
    {previewError && <p role="alert" className="td-feedback">{previewError}</p>}
    {selection && !preview && !previewError && <FinanceSkeleton variant="chart" />}
    {preview && <div className="td-picker-preview">
      <h4>{preview.title}</h4>
      <div className="td-picker-pitch"><PlanPreview exercise={preview.layout} /></div>
      <button type="button" className="tp-primary-btn" onClick={() => onPick(preview)}>Използвай рисунката</button>
    </div>}
  </section>;
}
