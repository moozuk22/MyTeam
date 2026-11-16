"use client";

import dynamic from "next/dynamic";
import { useRef, useState, type ReactNode } from "react";
import { ClipboardList, Info, Maximize2, Minus, Plus, X } from "lucide-react";
import type { Exercise } from "@/lib/exercise/model";

const PlanPreview = dynamic(() => import("../PlanPreview"), {
  ssr: false,
  loading: () => <div className="tp-preview-skeleton" role="status" aria-label="Зареждане" aria-busy="true" />,
});

const zoomLevels = [75, 100, 125, 150, 200];

function PitchViewport({ exercise, zoom = 100 }: { exercise: Exercise; zoom?: number }) {
  return (
    <div className="tp-review-scroll" tabIndex={zoom > 100 ? 0 : undefined}
      role="region" aria-label="Преглед на запазеното игрище">
      <div className="tp-review-zoom-area" style={{ width: `${Math.max(100, zoom)}%`, height: `${Math.max(100, zoom)}%` }}>
        <div className="tp-review-board" style={{ width: `${Math.min(100, zoom)}%`, height: `${Math.min(100, zoom)}%` }}>
          <PlanPreview exercise={exercise} />
        </div>
      </div>
    </div>
  );
}

export default function ReviewPreview({ exercise, fallback, details }: {
  exercise: Exercise | null;
  fallback: string;
  details: ReactNode;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [expanded, setExpanded] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const zoomIndex = zoomLevels.indexOf(zoom);

  return (
    <div className={showDetails ? "tp-review-layout tp-review-layout--details" : "tp-review-layout"}>
      <section className="tp-review-panel" aria-label="План за тренировка">
        <div className="tp-review-toolbar">
          <div className="tp-review-tabs" role="group" aria-label="Изглед на плана">
            <button type="button" className={showDetails ? "tp-secondary-btn" : "tp-primary-btn"}
              aria-pressed={!showDetails} onClick={() => setShowDetails(false)}>
              <ClipboardList size={18} aria-hidden="true" /> План
            </button>
            <button type="button" className={showDetails ? "tp-primary-btn" : "tp-secondary-btn"}
              aria-pressed={showDetails} onClick={() => setShowDetails(true)}>
              <Info size={18} aria-hidden="true" /> Детайли
            </button>
          </div>
          {exercise && !showDetails && (
            <div className="tp-review-zoom" role="group" aria-label="Мащаб на игрището">
              <select value={zoom} onChange={(event) => setZoom(Number(event.currentTarget.value))} aria-label="Мащаб">
                {zoomLevels.map((level) => <option key={level} value={level}>{level}%</option>)}
              </select>
              <div className="tp-review-zoom-step">
                <button type="button" className="tp-icon-btn" disabled={zoomIndex === 0}
                  aria-label="Намали" onClick={() => setZoom(zoomLevels[zoomIndex - 1])}><Minus size={18} /></button>
                <button type="button" className="tp-icon-btn" disabled={zoomIndex === zoomLevels.length - 1}
                  aria-label="Увеличи" onClick={() => setZoom(zoomLevels[zoomIndex + 1])}><Plus size={18} /></button>
              </div>
              <button type="button" className="tp-icon-btn" aria-label="Разшири игрището" onClick={() => {
                dialog.current?.showModal();
                setExpanded(true);
              }}><Maximize2 size={18} /></button>
            </div>
          )}
        </div>
        {!showDetails && (exercise ? <PitchViewport exercise={exercise} zoom={zoom} /> : <p className="tp-review-fallback">{fallback}</p>)}
      </section>
      <aside className="tp-review-sidebar" aria-label="Детайли на плана">{details}</aside>
      {exercise && (
        <dialog className="tp-review-dialog" ref={dialog} aria-label="Разширен преглед на игрището"
          onClose={() => setExpanded(false)}>
          <div className="tp-review-dialog-header">
            <h2>Игрище</h2>
            <button type="button" className="tp-icon-btn" aria-label="Затвори"
              onClick={() => dialog.current?.close()}><X size={20} /></button>
          </div>
          {expanded && <PitchViewport exercise={exercise} />}
        </dialog>
      )}
    </div>
  );
}
